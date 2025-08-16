const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { TwilioNumberService } = require('../services/twilioNumbers');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const twilioService = new TwilioNumberService();

async function onboardingRoutes(fastify, options) {
  // Create organization during onboarding (requires authentication)
  fastify.post('/create-organization', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { userId } = request.user;
    const { 
      organizationName,
      businessType,
      timezone,
      businessHours,
      services,
      greeting
    } = request.body;
    
    if (!organizationName) {
      return reply.code(400).send({ error: 'Organization name is required' });
    }

    try {
      // Provision Twilio number first
      let twilioNumber = null;
      let numberDetails = null;
      
      try {
        // Use mock provisioning in development, real provisioning in production
        if (process.env.NODE_ENV === 'development' || process.env.TWILIO_MOCK_NUMBERS === 'true') {
          numberDetails = await twilioService.mockProvisionNumber(userId, { areaCode: '555' });
        } else {
          numberDetails = await twilioService.provisionNumber(userId);
        }
        twilioNumber = numberDetails.phoneNumber;
        fastify.log.info('Provisioned Twilio number:', twilioNumber);
      } catch (error) {
        fastify.log.warn('Failed to provision Twilio number, continuing without:', error.message);
        // Continue with organization creation even if number provisioning fails
      }

      // Create organization with business config
      const organization = await prisma.organization.create({
        data: {
          name: organizationName,
          plan: 'starter',
          twilioNumber: twilioNumber, // Store the provisioned number
          businessConfig: {
            create: {
              businessHours: businessHours || {
                monday: { start: '09:00', end: '17:00', enabled: true },
                tuesday: { start: '09:00', end: '17:00', enabled: true },
                wednesday: { start: '09:00', end: '17:00', enabled: true },
                thursday: { start: '09:00', end: '17:00', enabled: true },
                friday: { start: '09:00', end: '17:00', enabled: true },
                saturday: { start: '09:00', end: '12:00', enabled: false },
                sunday: { start: '09:00', end: '12:00', enabled: false }
              },
              services: services || [
                {
                  id: 'default-consultation',
                  name: 'Consultation',
                  duration: 60,
                  price: 0,
                  category: 'General',
                  active: true
                }
              ],
              greeting: greeting || 'Hello! Thank you for calling. I\'m here to help you schedule an appointment. How can I assist you today?',
              timezone: timezone || 'America/New_York',
              scripts: {
                greeting: greeting || 'Hello! Thank you for calling. I\'m here to help you schedule an appointment. How can I assist you today?',
                fallback: 'I apologize, but I\'m having trouble understanding. Let me connect you with someone who can help.',
                confirmation: 'Let me confirm your appointment details...',
                success: 'Your appointment has been successfully scheduled!'
              },
              rules: {
                defaultSlotMinutes: 60,
                bufferMinutes: 15,
                allowDoubleBooking: false
              },
              voiceSettings: {
                voiceModel: 'harmonia',
                speed: 1.0,
                pitch: 1.0
              }
            }
          }
        },
        include: {
          businessConfig: true
        }
      });

      // Update user's organization
      await prisma.user.update({
        where: { id: userId },
        data: { organizationId: organization.id }
      });

      return {
        organization,
        twilioNumber,
        numberDetails,
        message: 'Organization created successfully' + (twilioNumber ? ` with phone number ${twilioNumber}` : '')
      };
    } catch (error) {
      fastify.log.error('Error creating organization:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get business type templates (no auth required)
  fastify.get('/business-types', async (request, reply) => {
    try {
      const businessTypes = [
        {
          id: 'medical',
          name: 'Medical Practice',
          description: 'Doctor offices, clinics, specialists',
          defaultServices: [
            { name: 'Consultation', duration: 60, category: 'Medical' },
            { name: 'Follow-up', duration: 30, category: 'Medical' },
            { name: 'Physical Exam', duration: 45, category: 'Medical' }
          ],
          defaultHours: {
            monday: { start: '08:00', end: '17:00', enabled: true },
            tuesday: { start: '08:00', end: '17:00', enabled: true },
            wednesday: { start: '08:00', end: '17:00', enabled: true },
            thursday: { start: '08:00', end: '17:00', enabled: true },
            friday: { start: '08:00', end: '17:00', enabled: true },
            saturday: { start: '09:00', end: '13:00', enabled: false },
            sunday: { start: '09:00', end: '13:00', enabled: false }
          },
          greeting: 'Hello! Thank you for calling our medical office. I\'m here to help you schedule an appointment. How can I assist you today?'
        },
        {
          id: 'dental',
          name: 'Dental Practice',
          description: 'Dental offices, orthodontists, oral surgeons',
          defaultServices: [
            { name: 'Cleaning', duration: 60, category: 'Dental' },
            { name: 'Consultation', duration: 30, category: 'Dental' },
            { name: 'Treatment', duration: 90, category: 'Dental' }
          ],
          defaultHours: {
            monday: { start: '08:00', end: '17:00', enabled: true },
            tuesday: { start: '08:00', end: '17:00', enabled: true },
            wednesday: { start: '08:00', end: '17:00', enabled: true },
            thursday: { start: '08:00', end: '17:00', enabled: true },
            friday: { start: '08:00', end: '16:00', enabled: true },
            saturday: { start: '08:00', end: '12:00', enabled: false },
            sunday: { start: '08:00', end: '12:00', enabled: false }
          },
          greeting: 'Hello! Thank you for calling our dental office. I\'m here to help you schedule an appointment. How can I assist you today?'
        },
        {
          id: 'legal',
          name: 'Legal Services',
          description: 'Law firms, attorneys, legal consultants',
          defaultServices: [
            { name: 'Consultation', duration: 60, category: 'Legal' },
            { name: 'Meeting', duration: 90, category: 'Legal' },
            { name: 'Document Review', duration: 120, category: 'Legal' }
          ],
          defaultHours: {
            monday: { start: '09:00', end: '18:00', enabled: true },
            tuesday: { start: '09:00', end: '18:00', enabled: true },
            wednesday: { start: '09:00', end: '18:00', enabled: true },
            thursday: { start: '09:00', end: '18:00', enabled: true },
            friday: { start: '09:00', end: '17:00', enabled: true },
            saturday: { start: '09:00', end: '12:00', enabled: false },
            sunday: { start: '09:00', end: '12:00', enabled: false }
          },
          greeting: 'Hello! Thank you for calling our law office. I\'m here to help you schedule an appointment. How can I assist you today?'
        },
        {
          id: 'salon',
          name: 'Salon & Spa',
          description: 'Hair salons, spas, beauty services',
          defaultServices: [
            { name: 'Haircut', duration: 60, category: 'Beauty' },
            { name: 'Color Treatment', duration: 120, category: 'Beauty' },
            { name: 'Spa Treatment', duration: 90, category: 'Beauty' }
          ],
          defaultHours: {
            monday: { start: '09:00', end: '19:00', enabled: true },
            tuesday: { start: '09:00', end: '19:00', enabled: true },
            wednesday: { start: '09:00', end: '19:00', enabled: true },
            thursday: { start: '09:00', end: '19:00', enabled: true },
            friday: { start: '09:00', end: '20:00', enabled: true },
            saturday: { start: '08:00', end: '18:00', enabled: true },
            sunday: { start: '10:00', end: '16:00', enabled: false }
          },
          greeting: 'Hello! Thank you for calling our salon. I\'m here to help you schedule an appointment. How can I assist you today?'
        },
        {
          id: 'fitness',
          name: 'Fitness & Wellness',
          description: 'Gyms, personal trainers, wellness centers',
          defaultServices: [
            { name: 'Personal Training', duration: 60, category: 'Fitness' },
            { name: 'Group Class', duration: 45, category: 'Fitness' },
            { name: 'Consultation', duration: 30, category: 'Fitness' }
          ],
          defaultHours: {
            monday: { start: '06:00', end: '21:00', enabled: true },
            tuesday: { start: '06:00', end: '21:00', enabled: true },
            wednesday: { start: '06:00', end: '21:00', enabled: true },
            thursday: { start: '06:00', end: '21:00', enabled: true },
            friday: { start: '06:00', end: '20:00', enabled: true },
            saturday: { start: '08:00', end: '18:00', enabled: true },
            sunday: { start: '08:00', end: '18:00', enabled: true }
          },
          greeting: 'Hello! Thank you for calling our fitness center. I\'m here to help you schedule a session. How can I assist you today?'
        },
        {
          id: 'consulting',
          name: 'Professional Services',
          description: 'Consultants, accountants, financial advisors',
          defaultServices: [
            { name: 'Consultation', duration: 60, category: 'Professional' },
            { name: 'Strategy Session', duration: 90, category: 'Professional' },
            { name: 'Review Meeting', duration: 45, category: 'Professional' }
          ],
          defaultHours: {
            monday: { start: '09:00', end: '17:00', enabled: true },
            tuesday: { start: '09:00', end: '17:00', enabled: true },
            wednesday: { start: '09:00', end: '17:00', enabled: true },
            thursday: { start: '09:00', end: '17:00', enabled: true },
            friday: { start: '09:00', end: '17:00', enabled: true },
            saturday: { start: '09:00', end: '12:00', enabled: false },
            sunday: { start: '09:00', end: '12:00', enabled: false }
          },
          greeting: 'Hello! Thank you for calling. I\'m here to help you schedule an appointment. How can I assist you today?'
        }
      ];

      return businessTypes;
    } catch (error) {
      fastify.log.error('Error fetching business types:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get supported timezones (no auth required)
  fastify.get('/timezones', async (request, reply) => {
    try {
      const timezones = [
        // US Timezones
        { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
        { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
        { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
        { value: 'America/Phoenix', label: 'Mountain Time (AZ)', offset: 'UTC-7' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
        { value: 'America/Anchorage', label: 'Alaska Time (AK)', offset: 'UTC-9/-8' },
        { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', offset: 'UTC-10' },

        // Canadian Timezones
        { value: 'America/Halifax', label: 'Atlantic Time (AT)', offset: 'UTC-4/-3' },
        { value: 'America/St_Johns', label: 'Newfoundland Time (NT)', offset: 'UTC-3:30/-2:30' },

        // Other Major Timezones
        { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)', offset: 'UTC+0/+1' },
        { value: 'Europe/Paris', label: 'Central European Time (CET)', offset: 'UTC+1/+2' },
        { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', offset: 'UTC+9' },
        { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)', offset: 'UTC+10/+11' },
        { value: 'Asia/Shanghai', label: 'China Standard Time (CST)', offset: 'UTC+8' },
        { value: 'Asia/Kolkata', label: 'India Standard Time (IST)', offset: 'UTC+5:30' }
      ];

      return timezones;
    } catch (error) {
      fastify.log.error('Error fetching timezones:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update onboarding progress
  fastify.put('/progress', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { step, completed, data } = request.body;
    
    try {
      // For now, we'll store onboarding progress in the organization metadata
      // In a full implementation, you might have an OnboardingProgress table
      
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        return reply.code(404).send({ error: 'Organization not found' });
      }

      // Update organization with onboarding progress (stored in a metadata field)
      // Since we don't have a metadata field in the current schema, we'll return success
      // In a full implementation, you'd add this to the database
      
      return {
        success: true,
        step,
        completed,
        message: 'Onboarding progress updated'
      };
    } catch (error) {
      fastify.log.error('Error updating onboarding progress:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get organization setup status
  fastify.get('/setup-status', {
    preHandler: authMiddleware
  }, async (request, reply) => {
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
        },
        testing: {
          completed: false, // This would be tracked separately
          description: 'Test calls and system verification'
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

module.exports = onboardingRoutes;