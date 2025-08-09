const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

async function servicesRoutes(fastify, options) {
  // Authentication is already handled at the parent level

  // Get organization's services
  fastify.get('/', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const businessConfig = await prisma.businessConfig.findUnique({
        where: { organizationId },
        select: {
          services: true
        }
      });

      // Services are stored in the businessConfig.services JSON field
      const services = businessConfig?.services || [];
      
      // Transform to match frontend expectations if needed
      const transformedServices = Array.isArray(services) ? services.map((service, index) => ({
        id: service.id || `service-${index}`,
        name: service.name || service,
        duration: service.duration || 60, // Default 60 minutes
        price: service.price || 0,
        description: service.description || '',
        active: service.active !== false, // Default to active
        category: service.category || 'General'
      })) : [];

      return transformedServices;
    } catch (error) {
      fastify.log.error('Error fetching services:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Create new service
  fastify.post('/', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { name, duration, price, description, category } = request.body;
    
    // Validate required fields
    if (!name) {
      return reply.code(400).send({ error: 'Service name is required' });
    }

    try {
      // Get current business config
      const currentConfig = await prisma.businessConfig.findUnique({
        where: { organizationId }
      });

      const currentServices = currentConfig?.services || [];
      const newService = {
        id: `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        duration: duration || 60,
        price: price || 0,
        description: description || '',
        active: true,
        category: category || 'General',
        createdAt: new Date().toISOString()
      };

      const updatedServices = [...(Array.isArray(currentServices) ? currentServices : []), newService];

      // Update or create business config
      const updatedConfig = await prisma.businessConfig.upsert({
        where: { organizationId },
        update: {
          services: updatedServices
        },
        create: {
          organizationId,
          services: updatedServices
        }
      });

      return newService;
    } catch (error) {
      fastify.log.error('Error creating service:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update service
  fastify.put('/:id', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;
    const { name, duration, price, description, category, active } = request.body;
    
    try {
      // Get current business config
      const currentConfig = await prisma.businessConfig.findUnique({
        where: { organizationId }
      });

      if (!currentConfig || !currentConfig.services) {
        return reply.code(404).send({ error: 'No services found' });
      }

      const currentServices = Array.isArray(currentConfig.services) ? currentConfig.services : [];
      const serviceIndex = currentServices.findIndex(service => service.id === id);
      
      if (serviceIndex === -1) {
        return reply.code(404).send({ error: 'Service not found' });
      }

      // Update the service
      const updatedService = {
        ...currentServices[serviceIndex],
        name: name !== undefined ? name : currentServices[serviceIndex].name,
        duration: duration !== undefined ? duration : currentServices[serviceIndex].duration,
        price: price !== undefined ? price : currentServices[serviceIndex].price,
        description: description !== undefined ? description : currentServices[serviceIndex].description,
        category: category !== undefined ? category : currentServices[serviceIndex].category,
        active: active !== undefined ? active : currentServices[serviceIndex].active,
        updatedAt: new Date().toISOString()
      };

      const updatedServices = [...currentServices];
      updatedServices[serviceIndex] = updatedService;

      // Update business config
      await prisma.businessConfig.update({
        where: { organizationId },
        data: {
          services: updatedServices
        }
      });

      return updatedService;
    } catch (error) {
      fastify.log.error('Error updating service:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Delete service
  fastify.delete('/:id', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;
    
    try {
      // Get current business config
      const currentConfig = await prisma.businessConfig.findUnique({
        where: { organizationId }
      });

      if (!currentConfig || !currentConfig.services) {
        return reply.code(404).send({ error: 'No services found' });
      }

      const currentServices = Array.isArray(currentConfig.services) ? currentConfig.services : [];
      const serviceIndex = currentServices.findIndex(service => service.id === id);
      
      if (serviceIndex === -1) {
        return reply.code(404).send({ error: 'Service not found' });
      }

      // Remove the service
      const updatedServices = currentServices.filter(service => service.id !== id);

      // Update business config
      await prisma.businessConfig.update({
        where: { organizationId },
        data: {
          services: updatedServices
        }
      });

      return { success: true, message: 'Service deleted successfully' };
    } catch (error) {
      fastify.log.error('Error deleting service:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get service categories
  fastify.get('/categories', async (request, reply) => {
    try {
      // Return predefined service categories
      const categories = [
        'General',
        'Consultation',
        'Treatment',
        'Follow-up',
        'Emergency',
        'Wellness',
        'Diagnostic',
        'Therapy',
        'Assessment',
        'Planning'
      ];

      return categories;
    } catch (error) {
      fastify.log.error('Error fetching service categories:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Bulk update services
  fastify.put('/bulk', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { services } = request.body;
    
    if (!Array.isArray(services)) {
      return reply.code(400).send({ error: 'Services must be an array' });
    }

    try {
      // Validate all services have required fields
      for (const service of services) {
        if (!service.name) {
          return reply.code(400).send({ error: 'All services must have a name' });
        }
      }

      // Add metadata to services
      const processedServices = services.map(service => ({
        id: service.id || `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: service.name,
        duration: service.duration || 60,
        price: service.price || 0,
        description: service.description || '',
        active: service.active !== false,
        category: service.category || 'General',
        updatedAt: new Date().toISOString()
      }));

      // Update business config
      const updatedConfig = await prisma.businessConfig.upsert({
        where: { organizationId },
        update: {
          services: processedServices
        },
        create: {
          organizationId,
          services: processedServices
        }
      });

      return processedServices;
    } catch (error) {
      fastify.log.error('Error bulk updating services:', error);
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = servicesRoutes;