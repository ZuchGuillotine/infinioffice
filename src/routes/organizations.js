const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function organizationRoutes(fastify, options) {
  // Get organization details
  fastify.get('/', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          businessConfig: true,
          integrations: true,
          users: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true
            }
          }
        }
      });

      if (!organization) {
        return reply.code(404).send({ error: 'Organization not found' });
      }

      return organization;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Update organization
  fastify.put('/', async (request, reply) => {
    const { organizationId } = request.user;
    const { name, plan, smsBranding } = request.body;
    
    try {
      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: {
          name,
          plan,
          smsBranding
        }
      });

      return organization;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get business configuration
  fastify.get('/config', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const config = await prisma.businessConfig.findUnique({
        where: { organizationId }
      });

      return config || {};
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Update business configuration
  fastify.put('/config', async (request, reply) => {
    const { organizationId } = request.user;
    const {
      businessHours,
      holidays,
      services,
      providers,
      escalationNumber,
      smsCopy,
      greeting,
      timezone
    } = request.body;
    
    try {
      const config = await prisma.businessConfig.upsert({
        where: { organizationId },
        update: {
          businessHours,
          holidays,
          services,
          providers,
          escalationNumber,
          smsCopy,
          greeting,
          timezone
        },
        create: {
          organizationId,
          businessHours,
          holidays,
          services,
          providers,
          escalationNumber,
          smsCopy,
          greeting,
          timezone
        }
      });

      return config;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get integrations
  fastify.get('/integrations', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const integrations = await prisma.integration.findMany({
        where: { organizationId }
      });

      return integrations;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Create/update integration
  fastify.post('/integrations', async (request, reply) => {
    const { organizationId } = request.user;
    const { type, oauthTokens, scopes, externalId } = request.body;
    
    try {
      const integration = await prisma.integration.upsert({
        where: {
          organizationId_type: {
            organizationId,
            type
          }
        },
        update: {
          oauthTokens,
          scopes,
          externalId,
          status: 'active'
        },
        create: {
          organizationId,
          type,
          oauthTokens,
          scopes,
          externalId,
          status: 'active'
        }
      });

      return integration;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Delete integration
  fastify.delete('/integrations/:type', async (request, reply) => {
    const { organizationId } = request.user;
    const { type } = request.params;
    
    try {
      await prisma.integration.delete({
        where: {
          organizationId_type: {
            organizationId,
            type
          }
        }
      });

      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = organizationRoutes; 