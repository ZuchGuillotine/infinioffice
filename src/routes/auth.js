const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const PipedriveService = require('../services/pipedrive');
const HubSpotService = require('../services/hubspot');
const SalesforceService = require('../services/salesforce');
const GoogleCalendarService = require('../services/googleCalendar');
const GoogleAuthService = require('../services/googleAuth');

const prisma = new PrismaClient();

// Google OAuth clients
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const googleAuthService = new GoogleAuthService();

async function authRoutes(fastify, options) {
  // Register user with email/password
  fastify.post('/register', async (request, reply) => {
    const { email, password, organizationName } = request.body;
    
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return reply.code(409).send({ error: 'An account with this email already exists' });
      }

      // Create organization first
      const organization = await prisma.organization.create({
        data: {
          name: organizationName,
          users: {
            create: {
              email,
              role: 'admin',
              // Note: In production, hash the password
            }
          }
        },
        include: {
          users: true
        }
      });

      const user = organization.users[0];
      const token = jwt.sign(
        { userId: user.id, organizationId: organization.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { token, user, organization };
    } catch (error) {
      console.error('Registration error:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Login with email/password
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true }
      });

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Note: In production, verify password hash
      
      const token = jwt.sign(
        { userId: user.id, organizationId: user.organizationId, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { token, user, organization: user.organization };
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  // Google OAuth login
  fastify.post('/google', async (request, reply) => {
    const { idToken } = request.body;
    
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      const { email, sub: googleId, name } = payload;

      let user = await prisma.user.findFirst({
        where: { 
          OR: [
            { email },
            { googleId }
          ]
        },
        include: { organization: true }
      });

      if (!user) {
        // Create new user and organization
        const organization = await prisma.organization.create({
          data: {
            name: `${name}'s Business`,
            users: {
              create: {
                email,
                googleId,
                role: 'admin'
              }
            }
          },
          include: {
            users: true
          }
        });
        user = organization.users[0];
      }

      const token = jwt.sign(
        { userId: user.id, organizationId: user.organizationId, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { token, user, organization: user.organization };
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  // Google OAuth user authentication routes (new separate client)
  fastify.get('/google', async (request, reply) => {
    const { state } = request.query;
    const authUrl = googleAuthService.getAuthUrl(state);
    reply.redirect(authUrl);
  });

  fastify.get('/google/callback', async (request, reply) => {
    const { code, state } = request.query;
    
    if (!code) {
      return reply.code(400).send({ error: 'Missing authorization code' });
    }

    try {
      const tokens = await googleAuthService.getTokensFromCode(code);
      const userInfo = await googleAuthService.verifyToken(tokens.id_token);
      
      const { email, sub: googleId, name } = userInfo;

      let user = await prisma.user.findFirst({
        where: { 
          OR: [
            { email },
            { googleId }
          ]
        },
        include: { organization: true }
      });

      if (!user) {
        // Create new user and organization
        const organization = await prisma.organization.create({
          data: {
            name: `${name}'s Business`,
            users: {
              create: {
                email,
                googleId,
                role: 'admin'
              }
            }
          },
          include: {
            users: true
          }
        });
        user = organization.users[0];
      }

      const token = jwt.sign(
        { userId: user.id, organizationId: user.organizationId, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Redirect back to frontend with success
      reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/dashboard?success=google-login`);
    } catch (error) {
      console.error('Google OAuth error:', error);
      reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/login?error=google`);
    }
  });

  // Verify JWT token
  fastify.get('/verify', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { organization: true }
      });

      if (!user) {
        return reply.code(401).send({ error: 'User not found' });
      }

      return { user, organization: user.organization };
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
    }
  });

  // Pipedrive OAuth routes
  fastify.get('/pipedrive', async (request, reply) => {
    const { organizationId } = request.query;
    if (!organizationId) {
      return reply.code(400).send({ error: 'Organization ID required' });
    }
    
    const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');
    const authUrl = PipedriveService.getAuthUrl(state);
    
    reply.redirect(authUrl);
  });

  fastify.get('/pipedrive/callback', async (request, reply) => {
    const { code, state } = request.query;
    
    if (!code || !state) {
      return reply.code(400).send({ error: 'Missing authorization code or state' });
    }

    try {
      const { organizationId } = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Exchange code for tokens
      const tokens = await PipedriveService.getTokensFromCode(code);
      
      // Validate token and get account info
      const isValid = await PipedriveService.validateToken(tokens.access_token);
      if (!isValid) {
        throw new Error('Invalid access token');
      }

      const accountInfo = await PipedriveService.getAccountInfo(tokens.access_token);

      // Store integration in database
      const integration = await prisma.integration.upsert({
        where: {
          organizationId_type: {
            organizationId,
            type: 'pipedrive'
          }
        },
        update: {
          oauthTokens: tokens,
          scopes: PipedriveService.scopes,
          status: 'active',
          externalId: accountInfo.id,
          updatedAt: new Date()
        },
        create: {
          organizationId,
          type: 'pipedrive',
          oauthTokens: tokens,
          scopes: PipedriveService.scopes,
          status: 'active',
          externalId: accountInfo.id
        }
      });

                   // Redirect back to frontend with success
             reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?success=pipedrive`);
      
    } catch (error) {
      console.error('Pipedrive OAuth error:', error);
                   reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=pipedrive`);
    }
  });

  // HubSpot OAuth routes
  fastify.get('/hubspot', async (request, reply) => {
    const { organizationId } = request.query;
    if (!organizationId) {
      return reply.code(400).send({ error: 'Organization ID required' });
    }
    
    const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');
    const authUrl = HubSpotService.getAuthUrl(state);
    
    reply.redirect(authUrl);
  });

  fastify.get('/hubspot/callback', async (request, reply) => {
    const { code, state } = request.query;
    
    if (!code || !state) {
      return reply.code(400).send({ error: 'Missing authorization code or state' });
    }

    try {
      const { organizationId } = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Exchange code for tokens
      const tokens = await HubSpotService.getTokensFromCode(code);
      
      // Validate token and get account info
      const accountInfo = await HubSpotService.getAccountInfo(tokens.access_token);
      
      // Store integration in database
      const integration = await prisma.integration.upsert({
        where: {
          organizationId_type: {
            organizationId,
            type: 'hubspot'
          }
        },
        update: {
          oauthTokens: tokens,
          scopes: HubSpotService.scopes,
          status: 'active',
          externalId: accountInfo.hub_id,
          updatedAt: new Date()
        },
        create: {
          organizationId,
          type: 'hubspot',
          oauthTokens: tokens,
          scopes: HubSpotService.scopes,
          status: 'active',
          externalId: accountInfo.hub_id
        }
      });

                   // Redirect back to frontend with success
             reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?success=hubspot`);
      
    } catch (error) {
      console.error('HubSpot OAuth error:', error);
                   reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=hubspot`);
    }
  });

  // Salesforce OAuth routes
  fastify.get('/salesforce', async (request, reply) => {
    const { organizationId } = request.query;
    if (!organizationId) {
      return reply.code(400).send({ error: 'Organization ID required' });
    }
    
    const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');
    const authUrl = SalesforceService.getAuthUrl(state);
    
    reply.redirect(authUrl);
  });

  fastify.get('/salesforce/callback', async (request, reply) => {
    const { code, state } = request.query;
    
    if (!code || !state) {
      return reply.code(400).send({ error: 'Missing authorization code or state' });
    }

    try {
      const { organizationId } = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Exchange code for tokens
      const tokens = await SalesforceService.getTokensFromCode(code);
      
      // Validate token and get account info
      const accountInfo = await SalesforceService.getAccountInfo(tokens.access_token, tokens.instance_url);
      
      // Store integration in database
      const integration = await prisma.integration.upsert({
        where: {
          organizationId_type: {
            organizationId,
            type: 'salesforce'
          }
        },
        update: {
          oauthTokens: tokens,
          scopes: SalesforceService.scopes,
          status: 'active',
          externalId: accountInfo.id,
          updatedAt: new Date()
        },
        create: {
          organizationId,
          type: 'salesforce',
          oauthTokens: tokens,
          scopes: SalesforceService.scopes,
          status: 'active',
          externalId: accountInfo.id
        }
      });

                   // Redirect back to frontend with success
             reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?success=salesforce`);
      
    } catch (error) {
      console.error('Salesforce OAuth error:', error);
                   reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=salesforce`);
    }
  });

  // Google Calendar OAuth routes
  fastify.get('/google-calendar', async (request, reply) => {
    const { organizationId } = request.query;
    if (!organizationId) {
      return reply.code(400).send({ error: 'Organization ID required' });
    }
    
    const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');
    const authUrl = GoogleCalendarService.getAuthUrl(state);
    
    reply.redirect(authUrl);
  });

  fastify.get('/google-calendar/callback', async (request, reply) => {
    const { code, state } = request.query;
    
    if (!code || !state) {
      return reply.code(400).send({ error: 'Missing authorization code or state' });
    }

    try {
      const { organizationId } = JSON.parse(Buffer.from(state, 'base64').toString());
      
      console.log('🔍 OAuth Callback Debug:');
      console.log('  - Organization ID:', organizationId);
      console.log('  - Authorization Code:', code ? `${code.substring(0, 20)}...` : 'NOT SET');
      
      // Exchange code for tokens
      const tokens = await GoogleCalendarService.getTokensFromCode(code);
      console.log('  - Tokens received:', {
        access_token: tokens.access_token ? 'Set' : 'NOT SET',
        refresh_token: tokens.refresh_token ? 'Set' : 'NOT SET',
        token_type: tokens.token_type,
        expires_in: tokens.expires_in
      });
      
      // Validate token and get account info
      const accountInfo = await GoogleCalendarService.getAccountInfo(tokens.access_token);
      
      // Store integration in database
      const integration = await prisma.integration.upsert({
        where: {
          organizationId_type: {
            organizationId,
            type: 'google-calendar'
          }
        },
        update: {
          oauthTokens: tokens,
          scopes: GoogleCalendarService.scopes,
          status: 'active',
          externalId: accountInfo.id,
          updatedAt: new Date()
        },
        create: {
          organizationId,
          type: 'google-calendar',
          oauthTokens: tokens,
          scopes: GoogleCalendarService.scopes,
          status: 'active',
          externalId: accountInfo.id
        }
      });

                   // Redirect back to frontend with success
             reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?success=google-calendar`);
      
    } catch (error) {
      console.error('Google Calendar OAuth error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        status: error.status
      });
      reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=google-calendar`);
    }
  });
}

module.exports = authRoutes; 