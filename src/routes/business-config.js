const { getDatabase } = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

async function businessConfigRoutes(fastify, options) {
  const prisma = await getDatabase();
  // Authentication is already handled at the parent level

  // Get business configuration for an organization
  fastify.get('/', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const businessConfig = await prisma.businessConfig.findUnique({
        where: { organizationId }
      });

      return businessConfig || {};
    } catch (error) {
      fastify.log.error('Error fetching business config:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update business configuration
  fastify.post('/', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const updateData = request.body;
    
    try {
      // Get current business config
      const currentConfig = await prisma.businessConfig.findUnique({
        where: { organizationId }
      });

      // Update or create business config
      const updatedConfig = await prisma.businessConfig.upsert({
        where: { organizationId },
        update: updateData,
        create: {
          organizationId,
          ...updateData
        }
      });

      // IMPORTANT: Invalidate organization cache when config changes
      const { OrganizationContextService } = require('../services/organizationContext');
      const contextService = new OrganizationContextService();
      await contextService.invalidateOrganizationCache(organizationId);

      fastify.log.info(`Business config updated for organization: ${organizationId}`);

      return updatedConfig;
    } catch (error) {
      fastify.log.error('Error updating business config:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  
}

module.exports = businessConfigRoutes;