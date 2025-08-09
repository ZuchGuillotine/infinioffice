const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class OrganizationContextService {
  constructor() {
    this.contextCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get organization context by Twilio phone number
   * @param {string} phoneNumber - The Twilio phone number (To field)
   * @returns {object} - Organization context including config and scripts
   */
  async getOrganizationContext(phoneNumber) {
    const cacheKey = phoneNumber;
    
    // Check cache first
    if (this.contextCache.has(cacheKey)) {
      const cached = this.contextCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📋 Using cached organization context for:', phoneNumber);
        return cached.context;
      }
      this.contextCache.delete(cacheKey);
    }

    try {
      console.log('🔍 Looking up organization for phone number:', phoneNumber);
      
      const organization = await prisma.organization.findUnique({
        where: { twilioNumber: phoneNumber },
        include: {
          businessConfig: true,
          integrations: {
            where: { status: 'active' }
          }
        }
      });

      if (!organization) {
        console.log('⚠️ No organization found for phone number:', phoneNumber, 'using default context');
        return this.getDefaultContext();
      }

      const context = {
        organizationId: organization.id,
        organizationName: organization.name,
        plan: organization.plan,
        twilioNumber: organization.twilioNumber,
        businessConfig: organization.businessConfig ? {
          businessHours: organization.businessConfig.businessHours,
          holidays: organization.businessConfig.holidays,
          services: organization.businessConfig.services,
          providers: organization.businessConfig.providers,
          escalationNumber: organization.businessConfig.escalationNumber,
          smsCopy: organization.businessConfig.smsCopy,
          greeting: organization.businessConfig.greeting,
          timezone: organization.businessConfig.timezone,
          scripts: organization.businessConfig.scripts || this.getDefaultScripts(),
          rules: organization.businessConfig.rules || this.getDefaultRules(),
          voiceSettings: organization.businessConfig.voiceSettings || this.getDefaultVoiceSettings()
        } : null,
        integrations: organization.integrations.map(integration => ({
          type: integration.type,
          status: integration.status,
          externalId: integration.externalId
        }))
      };

      // Cache the context
      this.contextCache.set(cacheKey, {
        context,
        timestamp: Date.now()
      });

      console.log('✅ Retrieved organization context for:', organization.name);
      return context;

    } catch (error) {
      console.error('❌ Error fetching organization context:', error);
      return this.getDefaultContext();
    }
  }

  /**
   * Get default context when no organization is found
   */
  getDefaultContext() {
    return {
      organizationId: process.env.DEFAULT_ORG_ID || '00000000-0000-0000-0000-000000000001',
      organizationName: 'Default Organization',
      plan: 'starter',
      twilioNumber: null,
      businessConfig: {
        businessHours: {
          monday: { start: '09:00', end: '17:00', enabled: true },
          tuesday: { start: '09:00', end: '17:00', enabled: true },
          wednesday: { start: '09:00', end: '17:00', enabled: true },
          thursday: { start: '09:00', end: '17:00', enabled: true },
          friday: { start: '09:00', end: '17:00', enabled: true },
          saturday: { start: '09:00', end: '12:00', enabled: false },
          sunday: { start: '09:00', end: '12:00', enabled: false }
        },
        holidays: [],
        services: [
          {
            id: 'default-consultation',
            name: 'Consultation',
            duration: 60,
            price: 0,
            category: 'General',
            active: true
          }
        ],
        providers: ['Staff'],
        escalationNumber: null,
        smsCopy: null,
        greeting: 'Hello! Thank you for calling. I\'m here to help you schedule an appointment. How can I assist you today?',
        timezone: 'America/New_York',
        scripts: this.getDefaultScripts(),
        rules: this.getDefaultRules(),
        voiceSettings: this.getDefaultVoiceSettings()
      },
      integrations: []
    };
  }

  /**
   * Get default script templates
   */
  getDefaultScripts() {
    return {
      greeting: 'Hello! Thank you for calling. I\'m here to help you schedule an appointment. How can I assist you today?',
      service: 'What type of service are you looking to schedule today?',
      timeWindow: 'When would you prefer to schedule this appointment?',
      contact: 'Can I get your name and phone number to complete the booking?',
      confirmation: 'Let me confirm your appointment details...',
      fallback: 'I apologize, but I\'m having trouble understanding. Let me connect you with someone who can help.',
      success: 'Your appointment has been successfully scheduled! You\'ll receive a confirmation shortly.'
    };
  }

  /**
   * Get default booking rules
   */
  getDefaultRules() {
    return {
      defaultSlotMinutes: 60,
      bufferMinutes: 15,
      allowDoubleBooking: false
    };
  }

  /**
   * Get default voice settings
   */
  getDefaultVoiceSettings() {
    return {
      voiceModel: 'aura-asteria-en',
      speed: 1.0,
      pitch: 1.0
    };
  }

  /**
   * Generate dynamic LLM system prompts based on organization context
   */
  generateSystemPrompt(context) {
    const { businessConfig } = context;
    const services = businessConfig?.services || [];
    const businessHours = businessConfig?.businessHours || {};
    const timezone = businessConfig?.timezone || 'America/New_York';

    const serviceList = services
      .filter(service => service.active)
      .map(service => `${service.name} (${service.duration} minutes)`)
      .join(', ');

    const hoursList = Object.entries(businessHours)
      .filter(([_, hours]) => hours.enabled)
      .map(([day, hours]) => `${day}: ${hours.start}-${hours.end}`)
      .join(', ');

    return `You are an appointment booking assistant for ${context.organizationName}. 

AVAILABLE SERVICES: ${serviceList || 'General appointments'}

BUSINESS HOURS: ${hoursList || 'Standard business hours'}
TIMEZONE: ${timezone}

BOOKING PROCESS:
1. Greet the caller warmly
2. Ask what service they need
3. Ask when they'd like to schedule
4. Get their contact information
5. Confirm all details
6. Complete the booking

IMPORTANT GUIDELINES:
- Be professional but friendly
- Keep responses concise and clear
- Always confirm details before booking
- If you can't help, offer to connect them with staff
- Use the organization's greeting: "${businessConfig?.greeting || 'Hello! How can I help you today?'}"

ESCALATION: ${businessConfig?.escalationNumber ? `Transfer to ${businessConfig.escalationNumber} if needed` : 'Take a message if unable to help'}`;
  }

  /**
   * Update organization context (invalidate cache)
   */
  invalidateCache(phoneNumber) {
    this.contextCache.delete(phoneNumber);
    console.log('🗑️ Invalidated cache for phone number:', phoneNumber);
  }

  /**
   * Clear all cached contexts
   */
  clearCache() {
    this.contextCache.clear();
    console.log('🗑️ Cleared all organization context cache');
  }
}

module.exports = { OrganizationContextService };