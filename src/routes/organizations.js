const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

async function organizationRoutes(fastify, options) {
  // Authentication is handled at the parent level in index.js

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

  // Get voice configuration
  fastify.get('/voice-config', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const config = await prisma.businessConfig.findUnique({
        where: { organizationId },
        select: {
          greeting: true,
          escalationNumber: true,
          smsCopy: true,
          // Include any voice-specific settings from services
          services: true
        }
      });

      // Default voice configuration
      const voiceConfig = {
        greeting: config?.greeting || "Hello! Thank you for calling. I'm here to help you schedule an appointment. How can I assist you today?",
        escalationNumber: config?.escalationNumber || null,
        smsCopy: config?.smsCopy || "Thank you for calling! We'll send you a confirmation via text message.",
        voiceModel: 'aura-asteria-en', // Default voice model
        speechRate: 1.0, // Normal speech rate
        volume: 0.8, // Default volume
        confirmationPrompts: {
          appointmentBooked: "Great! I've scheduled your appointment. You should receive a confirmation shortly.",
          appointmentCancelled: "Your appointment has been cancelled. Is there anything else I can help you with?",
          transferring: "Let me transfer you to someone who can better assist you.",
          goodbye: "Thank you for calling. Have a great day!"
        },
        fallbackResponses: {
          noUnderstand: "I'm sorry, I didn't quite understand that. Could you please repeat or rephrase?",
          technicalDifficulty: "I'm experiencing some technical difficulties. Let me try again.",
          timeout: "I haven't heard from you in a while. Are you still there?",
          maxRetries: "I'm having trouble understanding. Let me transfer you to someone who can help."
        },
        services: config?.services || []
      };

      return voiceConfig;
    } catch (error) {
      fastify.log.error('Error fetching voice configuration:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update voice configuration
  fastify.put('/voice-config', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const {
      greeting,
      escalationNumber,
      smsCopy,
      voiceModel,
      speechRate,
      volume,
      confirmationPrompts,
      fallbackResponses
    } = request.body;
    
    try {
      // Update business config with voice settings
      const config = await prisma.businessConfig.upsert({
        where: { organizationId },
        update: {
          greeting,
          escalationNumber,
          smsCopy
          // Note: voiceModel, speechRate, volume, etc. would need additional fields in schema
          // For now, we'll store core voice settings in the existing fields
        },
        create: {
          organizationId,
          greeting: greeting || "Hello! Thank you for calling. I'm here to help you schedule an appointment. How can I assist you today?",
          escalationNumber,
          smsCopy: smsCopy || "Thank you for calling! We'll send you a confirmation via text message."
        }
      });

      return {
        greeting: config.greeting,
        escalationNumber: config.escalationNumber,
        smsCopy: config.smsCopy,
        voiceModel: voiceModel || 'aura-asteria-en',
        speechRate: speechRate || 1.0,
        volume: volume || 0.8,
        confirmationPrompts: confirmationPrompts || {},
        fallbackResponses: fallbackResponses || {},
        updatedAt: config.updatedAt
      };
    } catch (error) {
      fastify.log.error('Error updating voice configuration:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get schedule configuration
  fastify.get('/schedule', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const config = await prisma.businessConfig.findUnique({
        where: { organizationId },
        select: {
          businessHours: true,
          holidays: true,
          timezone: true,
          services: true,
          providers: true
        }
      });

      // Default schedule configuration
      const scheduleConfig = {
        businessHours: config?.businessHours || {
          monday: { start: '09:00', end: '17:00', enabled: true },
          tuesday: { start: '09:00', end: '17:00', enabled: true },
          wednesday: { start: '09:00', end: '17:00', enabled: true },
          thursday: { start: '09:00', end: '17:00', enabled: true },
          friday: { start: '09:00', end: '17:00', enabled: true },
          saturday: { start: '09:00', end: '12:00', enabled: false },
          sunday: { start: '09:00', end: '12:00', enabled: false }
        },
        timezone: config?.timezone || 'America/New_York',
        holidays: config?.holidays || [],
        services: config?.services || [],
        providers: config?.providers || [],
        // Additional scheduling rules
        bookingWindow: {
          minAdvanceHours: 2, // Minimum 2 hours advance booking
          maxAdvanceDays: 90, // Maximum 90 days advance booking
          bufferMinutes: 15 // 15-minute buffer between appointments
        },
        availability: {
          defaultSlotDuration: 60, // 60-minute default slots
          breakBetweenSlots: 0, // No break by default
          lunchBreak: {
            enabled: false,
            start: '12:00',
            end: '13:00'
          }
        }
      };

      return scheduleConfig;
    } catch (error) {
      fastify.log.error('Error fetching schedule configuration:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update schedule configuration
  fastify.put('/schedule', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const {
      businessHours,
      timezone,
      holidays,
      services,
      providers,
      bookingWindow,
      availability
    } = request.body;
    
    try {
      const config = await prisma.businessConfig.upsert({
        where: { organizationId },
        update: {
          businessHours,
          timezone,
          holidays,
          services,
          providers
          // Note: bookingWindow and availability would need additional fields
          // or could be stored as JSON in a metadata field
        },
        create: {
          organizationId,
          businessHours: businessHours || {
            monday: { start: '09:00', end: '17:00', enabled: true },
            tuesday: { start: '09:00', end: '17:00', enabled: true },
            wednesday: { start: '09:00', end: '17:00', enabled: true },
            thursday: { start: '09:00', end: '17:00', enabled: true },
            friday: { start: '09:00', end: '17:00', enabled: true },
            saturday: { start: '09:00', end: '12:00', enabled: false },
            sunday: { start: '09:00', end: '12:00', enabled: false }
          },
          timezone: timezone || 'America/New_York',
          holidays: holidays || [],
          services: services || [],
          providers: providers || []
        }
      });

      return {
        businessHours: config.businessHours,
        timezone: config.timezone,
        holidays: config.holidays,
        services: config.services,
        providers: config.providers,
        bookingWindow: bookingWindow || {
          minAdvanceHours: 2,
          maxAdvanceDays: 90,
          bufferMinutes: 15
        },
        availability: availability || {
          defaultSlotDuration: 60,
          breakBetweenSlots: 0,
          lunchBreak: { enabled: false, start: '12:00', end: '13:00' }
        },
        updatedAt: config.updatedAt
      };
    } catch (error) {
      fastify.log.error('Error updating schedule configuration:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update onboarding progress
  fastify.put('/onboarding-progress', async (request, reply) => {
    const { organizationId } = request.user;
    const { progress } = request.body;
    
    try {
      // In a full implementation, you might store this in a separate table
      // For now, we'll just return success
      // You could add a metadata JSON field to Organization model to store this
      
      return {
        organizationId,
        progress: progress || {},
        updatedAt: new Date().toISOString(),
        message: 'Onboarding progress updated successfully'
      };
    } catch (error) {
      fastify.log.error('Error updating onboarding progress:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get setup status
  fastify.get('/setup-status', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          businessConfig: true,
          integrations: true
        }
      });

      if (!organization) {
        return reply.code(404).send({ error: 'Organization not found' });
      }

      // Check setup completion status
      const setupStatus = {
        basicInfo: {
          completed: !!organization.name,
          description: 'Organization name and basic details'
        },
        businessHours: {
          completed: !!organization.businessConfig?.businessHours,
          description: 'Business hours and scheduling rules'
        },
        services: {
          completed: !!organization.businessConfig?.services && 
                     Array.isArray(organization.businessConfig.services) &&
                     organization.businessConfig.services.length > 0,
          description: 'Services offered and pricing'
        },
        voiceScript: {
          completed: !!organization.businessConfig?.greeting,
          description: 'Voice greeting and call flow'
        },
        integrations: {
          completed: organization.integrations.length > 0,
          description: 'Calendar and CRM integrations'
        }
      };

      const totalSteps = Object.keys(setupStatus).length;
      const completedSteps = Object.values(setupStatus).filter(step => step.completed).length;
      const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

      return {
        organizationId,
        completionPercentage,
        completedSteps,
        totalSteps,
        steps: setupStatus,
        isComplete: completionPercentage === 100
      };
    } catch (error) {
      fastify.log.error('Error fetching setup status:', error);
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = organizationRoutes; 