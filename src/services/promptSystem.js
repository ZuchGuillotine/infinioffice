/**
 * Enhanced System Prompts and Response Generation
 * Supports tenant customization, location flows, and ≤50 token outputs
 */

const { TOOL_SCHEMAS } = require('./tools');

class PromptSystem {
  constructor(context = {}) {
    this.context = context;
    this.businessConfig = context.businessConfig || {};
    this.orgName = context.organizationContext?.organizationName || 'our business';
    this.slots = context.slots || {};
    this.confirmationAttempts = context.confirmationAttempts || {};
  }

  getSystemPrompt(currentState = 'idle') {
    const tools = Object.values(TOOL_SCHEMAS);
    const serviceList = this.getServiceList();
    const orgScripts = this.businessConfig.scripts || {};

    return `You are a voice assistant for ${this.orgName}. Your goal is to efficiently book appointments.

CORE RULES:
- Keep responses ≤50 tokens unless summarizing or confirming all details
- Always use tools to capture/validate information
- Be conversational but direct
- Handle location preferences (on-site vs at-business)
- Support three-strike confirmation logic
- Manage digressions gracefully

AVAILABLE TOOLS:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

BOOKING FLOW:
1. Greet and identify service needed
2. Collect timing preference  
3. Handle location requirements (if applicable)
4. Gather contact information
5. Confirm all details (3 attempts max)
6. Schedule appointment or escalate

LOCATION HANDLING:
- Home services: Always collect customer address
- Business services: Note customer preference (on-site vs at-business)
- Multi-location businesses: Help select correct branch

TENANT CUSTOMIZATION:
Organization: ${this.orgName}
Services: ${serviceList}
Custom greeting: ${orgScripts.greeting || 'Default greeting'}
Custom scripts: ${JSON.stringify(orgScripts)}

CURRENT STATE: ${currentState}
CAPTURED SLOTS: ${JSON.stringify(this.slots)}

RESPONSE GUIDELINES:
- Use set_slot() when user provides information
- Use request_slot() when information is missing  
- Use confirm_slot() before final booking
- Use validate_location() for addresses/branches
- Use fetch_business_fact() for FAQ questions
- Use escalate() after 3 failed confirmations

Be helpful but efficient. Get to the booking quickly.`;
  }

  getConversationPrompt(intent, entities, conversationHistory = []) {
    const recentHistory = this.formatHistory(conversationHistory);
    const intentGuidance = this.getIntentGuidance(intent, entities);

    return `CONVERSATION CONTEXT:
Recent exchanges:
${recentHistory}

CURRENT INTENT: ${intent}
EXTRACTED ENTITIES: ${JSON.stringify(entities)}

GUIDANCE: ${intentGuidance}

Respond naturally and use appropriate tools. Keep responses concise.`;
  }

  getIntentGuidance(intent, entities) {
    const guidance = {
      booking_request: "Welcome the user and ask what service they need. Use request_slot('service').",
      
      service_provided: "Acknowledge the service and use set_slot('service', value). Then ask for timing.",
      
      time_provided: "Acknowledge timing and use set_slot('time_window', value). Then handle location if needed for this service type.",
      
      contact_provided: "Use set_slot('contact', value). If you have service, time, and contact, confirm all details.",
      
      location_provided: "Use set_slot('location', value) and validate_location() if it's an address. Ask for location preference if unclear.",
      
      location_preference: "Use set_slot('location_preference', value). Continue with contact info if missing.",
      
      confirmation_yes: "Proceed with schedule_appointment() using captured slots.",
      
      confirmation_no: "Ask what needs to be changed. Use confirm_slot() with higher attempt number.",
      
      digression_question: "Use fetch_business_fact() to answer, then return to booking flow smoothly.",
      
      hours_inquiry: "Use fetch_business_fact('hours') and ask if they'd like to schedule an appointment.",
      
      location_inquiry: "Use fetch_business_fact('location') and check if they need directions for an appointment.",
      
      services_inquiry: "Use fetch_business_fact('services') and help them select one.",
      
      escalation_request: "Use escalate('transfer', 'customer requested human assistance').",
      
      unclear: "Ask for clarification. If this is the 3rd unclear response, use escalate('callback', 'multiple unclear responses')."
    };

    return guidance[intent] || "Handle the user's input appropriately and advance the booking flow.";
  }

  formatHistory(history) {
    return history
      .slice(-4) // Last 4 exchanges
      .map(msg => `${msg.role === 'user' ? 'Customer' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  }

  getServiceList() {
    const services = this.businessConfig.services || [];
    const activeServices = services
      .filter(service => service.active)
      .map(service => service.name);
    
    if (activeServices.length === 0) return 'general appointments';
    if (activeServices.length <= 3) return activeServices.join(', ');
    return `${activeServices.slice(0, 3).join(', ')} and more`;
  }

  // Template responses for quick fallbacks (all ≤50 tokens)
  getTemplateResponse(type, customData = {}) {
    const templates = {
      greeting: this.businessConfig.scripts?.greeting || 
        `Hello! I'm here to help schedule your appointment with ${this.orgName}. What service do you need?`,
      
      service_request: this.businessConfig.scripts?.service ||
        `What type of service are you looking for today? We offer ${this.getServiceList()}.`,
      
      time_request: this.businessConfig.scripts?.timeWindow ||
        `Great! When would you like to schedule your ${this.slots.service || 'appointment'}?`,
      
      location_request: "What's the address where you need this service performed?",
      
      location_preference_request: "Would you prefer this service at your location or at our business?",
      
      contact_request: this.businessConfig.scripts?.contact ||
        "Perfect! I'll need your name and phone number to complete the booking.",
      
      confirmation: `Let me confirm: ${this.formatBookingDetails()}. Is this correct?`,
      
      success: this.businessConfig.scripts?.success ||
        `Excellent! Your appointment is confirmed. You'll receive confirmation shortly.`,
      
      clarification: "I want to make sure I understand. Could you repeat that?",
      
      callback_scheduled: "I'll have someone call you back within the hour to complete your booking.",
      
      technical_difficulty: "I'm having technical difficulties. Let me get someone to help you.",
      
      // Location-specific templates
      address_validation: `I have the address as ${customData.address}. Is that correct?`,
      
      branch_selection: `We have locations at ${customData.branches}. Which location works best?`,
      
      service_location_clarification: "Would you like this service at your location or would you prefer to come to us?",
      
      // Progressive summarization templates  
      partial_summary: `So far I have: ${this.formatPartialBooking()}. What else do you need?`,
      
      full_summary: `Here's everything: ${this.formatFullBooking()}. Should I book this appointment?`
    };

    return templates[type] || "I'm here to help you schedule an appointment.";
  }

  formatBookingDetails() {
    const parts = [];
    if (this.slots.service) parts.push(this.slots.service);
    if (this.slots.time_window) parts.push(`for ${this.slots.time_window}`);
    if (this.slots.location) parts.push(`at ${this.slots.location}`);
    if (this.slots.contact) parts.push(`contact: ${this.slots.contact}`);
    
    return parts.join(', ') || 'your appointment';
  }

  formatPartialBooking() {
    const completed = [];
    if (this.slots.service) completed.push(`service: ${this.slots.service}`);
    if (this.slots.time_window) completed.push(`time: ${this.slots.time_window}`);
    if (this.slots.location) completed.push(`location: ${this.slots.location}`);
    
    return completed.join(', ') || 'partial information';
  }

  formatFullBooking() {
    return [
      this.slots.service && `Service: ${this.slots.service}`,
      this.slots.time_window && `Time: ${this.slots.time_window}`,
      this.slots.location && `Location: ${this.slots.location}`,
      this.slots.location_preference && `Type: ${this.slots.location_preference}`,
      this.slots.contact && `Contact: ${this.slots.contact}`
    ].filter(Boolean).join(', ');
  }

  // Context management for session persistence
  updateContext(newSlots = {}, confirmationAttempts = {}) {
    this.slots = { ...this.slots, ...newSlots };
    this.confirmationAttempts = { ...this.confirmationAttempts, ...confirmationAttempts };
    
    return {
      slots: this.slots,
      confirmationAttempts: this.confirmationAttempts,
      lastUpdate: new Date().toISOString()
    };
  }

  getProgressSummary() {
    const required = ['service', 'time_window', 'contact'];
    const optional = ['location', 'location_preference'];
    
    const completed = required.filter(slot => this.slots[slot]);
    const completedOptional = optional.filter(slot => this.slots[slot]);
    
    return {
      required_completed: completed.length,
      required_total: required.length,
      optional_completed: completedOptional.length,
      completion_percentage: Math.round((completed.length / required.length) * 100),
      missing_required: required.filter(slot => !this.slots[slot]),
      is_ready_to_book: completed.length === required.length
    };
  }
}

// Specialized prompt system for location-aware services
class LocationAwarePromptSystem extends PromptSystem {
  constructor(context = {}) {
    super(context);
    this.serviceCategories = this.categorizeServices();
  }

  categorizeServices() {
    const services = this.businessConfig.services || [];
    
    return {
      home_services: services.filter(s => s.location_type === 'customer_location'),
      business_services: services.filter(s => s.location_type === 'business_location'),
      flexible_services: services.filter(s => s.location_type === 'flexible' || !s.location_type)
    };
  }

  getLocationGuidance(serviceName) {
    const service = this.findService(serviceName);
    
    if (!service) {
      return {
        requires_location: false,
        guidance: "Location not required for this service"
      };
    }

    const guidance = {
      customer_location: {
        requires_location: true,
        guidance: "This service is performed at your location. I'll need your address."
      },
      business_location: {
        requires_location: false,
        guidance: "This service is performed at our location. No address needed."
      },
      flexible: {
        requires_location: true,
        guidance: "This service can be done at your location or ours. What's your preference?"
      }
    };

    return guidance[service.location_type] || guidance.flexible;
  }

  findService(serviceName) {
    const services = this.businessConfig.services || [];
    return services.find(s => 
      s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
      serviceName.toLowerCase().includes(s.name.toLowerCase())
    );
  }

  getLocationPrompt(serviceName) {
    const locationGuidance = this.getLocationGuidance(serviceName);
    
    if (!locationGuidance.requires_location) {
      return null; // No location prompt needed
    }

    const service = this.findService(serviceName);
    
    if (service?.location_type === 'customer_location') {
      return "What's the address where you need this service?";
    }
    
    if (service?.location_type === 'flexible') {
      return "Would you prefer this service at your location or would you like to come to our business?";
    }

    return "Where would you like this service performed?";
  }
}

module.exports = {
  PromptSystem,
  LocationAwarePromptSystem
};