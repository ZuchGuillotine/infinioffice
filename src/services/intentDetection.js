/**
 * Enhanced Intent Detection System
 * Supports location capture, FAQ handling, and tenant customization
 */

const { getOpenAIClient } = require('./llm');

// Enhanced intent types with location support
const INTENT_TYPES = {
  // Core booking intents
  BOOKING_REQUEST: 'booking_request',
  SERVICE_PROVIDED: 'service_provided',
  TIME_PROVIDED: 'time_provided',
  CONTACT_PROVIDED: 'contact_provided',
  LOCATION_PROVIDED: 'location_provided',
  LOCATION_PREFERENCE: 'location_preference',
  
  // Confirmation intents
  CONFIRMATION_YES: 'confirmation_yes',
  CONFIRMATION_NO: 'confirmation_no',
  
  // FAQ/Digression intents
  DIGRESSION_QUESTION: 'digression_question',
  HOURS_INQUIRY: 'hours_inquiry',
  LOCATION_INQUIRY: 'location_inquiry',
  SERVICES_INQUIRY: 'services_inquiry',
  
  // Control intents
  AFFIRMATIVE: 'affirmative',
  NEGATIVE: 'negative',
  UNCLEAR: 'unclear',
  ESCALATION_REQUEST: 'escalation_request'
};

class IntentDetector {
  constructor(context = {}) {
    this.context = context;
    this.businessConfig = context.businessConfig || {};
    this.orgName = context.organizationContext?.organizationName || 'our business';
  }

  async detectIntent(transcript, conversationHistory = []) {
    const systemPrompt = this.buildSystemPrompt(conversationHistory);
    
    try {
      console.log('🔍 Enhanced Intent Detection Request:', {
        model: 'gpt-4o',
        transcript: transcript,
        orgName: this.orgName
      });

      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      console.log('✅ Enhanced Intent Detection Result:', {
        intent: result.intent,
        confidence: result.confidence,
        entities: result.entities
      });

      return this.validateAndEnhanceResult(result, transcript);
      
    } catch (error) {
      console.error('❌ Intent detection error:', error);
      return this.getFallbackResult(transcript);
    }
  }

  buildSystemPrompt(conversationHistory) {
    const serviceList = this.getServiceList();
    const recentHistory = this.formatConversationHistory(conversationHistory);
    
    return `You are an advanced intent detection system for ${this.orgName}. 

Analyze the user's speech and return a JSON response with this exact structure:
{
  "intent": "one of the defined intents below",
  "confidence": 0.0-1.0,
  "entities": {
    "service": "extracted service if mentioned",
    "time_window": "extracted date/time if mentioned", 
    "contact": "extracted name/phone if mentioned",
    "location": "extracted address if mentioned",
    "location_preference": "on_site|at_business|remote if mentioned",
    "business_fact_type": "hours|location|services|contact|parking|policies if FAQ"
  },
  "context": {
    "needs_clarification": boolean,
    "digression_type": "faq|complaint|other if applicable"
  }
}

AVAILABLE INTENTS:
- booking_request: User wants to book/schedule (e.g., "I need an appointment", "Can I schedule?")
- service_provided: User specified service type (e.g., "I need a haircut", "plumbing repair")
- time_provided: User specified timing (e.g., "tomorrow at 2pm", "next Friday")
- contact_provided: User provided name/phone (e.g., "John Smith, 555-1234")
- location_provided: User provided address for service (e.g., "123 Main St", "downtown location")
- location_preference: User specified where service happens (e.g., "at my house", "I'll come in")
- confirmation_yes: User confirmed/agreed (yes, correct, that's right, etc.)
- confirmation_no: User declined/disagreed (no, that's wrong, etc.)
- digression_question: User asked about business (hours, parking, policies, etc.)
- hours_inquiry: Specifically asking about business hours
- location_inquiry: Specifically asking about business location/address
- services_inquiry: Asking what services are offered
- affirmative: General positive response
- negative: General negative response  
- escalation_request: User wants human help (e.g., "speak to someone", "transfer me")
- unclear: Cannot determine intent

BUSINESS CONTEXT:
Organization: ${this.orgName}
Available services: ${serviceList}
Service types: ${this.getServiceTypes()}

LOCATION HANDLING:
- If user mentions an address/location for service: location_provided
- If user indicates preference for where service happens: location_preference
- If user asks about business location: location_inquiry

CONVERSATION HISTORY:
${recentHistory}

CONFIDENCE SCORING:
- >0.8: Very clear intent with explicit keywords
- 0.6-0.8: Clear intent with context clues
- 0.4-0.6: Somewhat clear intent, may need clarification
- <0.4: Unclear or ambiguous

ENTITY EXTRACTION RULES:
- Extract exact values mentioned by user
- For addresses: include full address if provided
- For services: match against available services list flexibly
- For time: preserve user's natural language format
- For contact: extract both name and phone if available

Be strict with confidence scores. Only use >0.7 for very clear intents.`;
  }

  getServiceList() {
    const services = this.businessConfig.services || [];
    const activeServices = services
      .filter(service => service.active)
      .map(service => service.name);
    return activeServices.length > 0 ? activeServices.join(', ') : 'general appointments';
  }

  getServiceTypes() {
    const services = this.businessConfig.services || [];
    const types = [...new Set(services.map(s => s.category || 'general'))];
    return types.join(', ');
  }

  formatConversationHistory(history) {
    return history
      .slice(-3) // Last 3 exchanges
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  validateAndEnhanceResult(result, transcript) {
    // Validate intent is in our defined set
    const validIntents = Object.values(INTENT_TYPES);
    if (!validIntents.includes(result.intent)) {
      console.warn(`Invalid intent detected: ${result.intent}, defaulting to unclear`);
      result.intent = INTENT_TYPES.UNCLEAR;
      result.confidence = Math.min(result.confidence || 0, 0.3);
    }

    // Enhance entities with validation
    if (result.entities) {
      result.entities = this.validateEntities(result.entities);
    }

    // Add processing metadata
    result.rawText = transcript;
    result.timestamp = new Date().toISOString();
    result.processor = 'enhanced_intent_detector';

    return result;
  }

  validateEntities(entities) {
    const validated = { ...entities };

    // Validate service against business config
    if (validated.service) {
      validated.service_valid = this.isValidService(validated.service);
    }

    // Validate location preference enum
    if (validated.location_preference) {
      const validPreferences = ['on_site', 'at_business', 'remote'];
      if (!validPreferences.includes(validated.location_preference)) {
        delete validated.location_preference;
      }
    }

    // Validate business fact type
    if (validated.business_fact_type) {
      const validFactTypes = ['hours', 'location', 'services', 'contact', 'parking', 'policies'];
      if (!validFactTypes.includes(validated.business_fact_type)) {
        delete validated.business_fact_type;
      }
    }

    return validated;
  }

  isValidService(serviceName) {
    const services = this.businessConfig.services || [];
    const activeServices = services.filter(s => s.active);
    
    const cleanService = serviceName.toLowerCase().trim();
    
    return activeServices.some(service => {
      const serviceNameLower = service.name.toLowerCase().trim();
      return serviceNameLower.includes(cleanService) || 
             cleanService.includes(serviceNameLower) ||
             this.fuzzyServiceMatch(cleanService, serviceNameLower);
    });
  }

  fuzzyServiceMatch(requested, available) {
    // Enhanced fuzzy matching for services
    const commonPatterns = [
      { service: 'hair', matches: ['cut', 'style', 'trim'] },
      { service: 'repair', matches: ['fix', 'service', 'maintenance'] },
      { service: 'clean', matches: ['cleaning', 'wash'] },
      { service: 'check', matches: ['checkup', 'exam', 'inspection'] }
    ];

    for (const pattern of commonPatterns) {
      if (available.includes(pattern.service) && 
          pattern.matches.some(match => requested.includes(match))) {
        return true;
      }
    }

    return false;
  }

  getFallbackResult(transcript) {
    return {
      intent: INTENT_TYPES.UNCLEAR,
      confidence: 0.0,
      entities: {},
      context: {
        needs_clarification: true,
        error: 'Intent detection failed'
      },
      rawText: transcript,
      timestamp: new Date().toISOString(),
      processor: 'fallback'
    };
  }
}

// Specialized intent detection for different contexts
class ContextualIntentDetector extends IntentDetector {
  constructor(context = {}) {
    super(context);
    this.currentState = context.currentState || 'idle';
    this.slots = context.slots || {};
  }

  async detectContextualIntent(transcript, conversationHistory = []) {
    // Pre-process based on current state
    const stateContext = this.getStateContext();
    
    // Add state-specific context to the detection
    const enhancedContext = {
      ...this.context,
      currentState: this.currentState,
      expectedSlots: stateContext.expectedSlots,
      completedSlots: Object.keys(this.slots)
    };

    const detector = new IntentDetector(enhancedContext);
    const result = await detector.detectIntent(transcript, conversationHistory);

    // Post-process with state-specific logic
    return this.enhanceWithStateContext(result, stateContext);
  }

  getStateContext() {
    const stateContexts = {
      idle: {
        expectedSlots: ['service'],
        primaryIntents: ['booking_request', 'digression_question']
      },
      collecting_service: {
        expectedSlots: ['service'],
        primaryIntents: ['service_provided']
      },
      collecting_time: {
        expectedSlots: ['time_window'],
        primaryIntents: ['time_provided']
      },
      collecting_contact: {
        expectedSlots: ['contact'],
        primaryIntents: ['contact_provided']
      },
      collecting_location: {
        expectedSlots: ['location', 'location_preference'],
        primaryIntents: ['location_provided', 'location_preference']
      },
      confirming: {
        expectedSlots: [],
        primaryIntents: ['confirmation_yes', 'confirmation_no']
      }
    };

    return stateContexts[this.currentState] || stateContexts.idle;
  }

  enhanceWithStateContext(result, stateContext) {
    // Boost confidence for expected intents in current state
    if (stateContext.primaryIntents.includes(result.intent)) {
      result.confidence = Math.min(result.confidence + 0.1, 1.0);
      result.state_aligned = true;
    }

    // Flag if intent doesn't match expected state flow
    if (result.confidence > 0.6 && !stateContext.primaryIntents.includes(result.intent)) {
      result.state_mismatch = true;
      result.context = result.context || {};
      result.context.unexpected_for_state = this.currentState;
    }

    return result;
  }
}

module.exports = {
  INTENT_TYPES,
  IntentDetector,
  ContextualIntentDetector
};