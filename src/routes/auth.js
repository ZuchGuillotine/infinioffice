const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const prisma = new PrismaClient();

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function authRoutes(fastify, options) {
  // Register user with email/password
  fastify.post('/register', async (request, reply) => {
    const { email, password, organizationName } = request.body;
    
    try {
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
}

module.exports = authRoutes; 