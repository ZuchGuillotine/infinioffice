/**
 * Enhanced LLM Service with Tool Calling Interface
 * 
 * Features:
 * - Tool-based function calling for structured outputs
 * - Location-aware intent detection and processing
 * - Three-strike confirmation system integration
 * - Progressive summarization and context building
 * - Tenant-specific customization support
 * - Sub-2-second response times with ≤50 token outputs
 */

const OpenAI = require('openai');

// Create OpenAI client lazily
let openai = null;
const getOpenAIClient = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

// Tool/Function Schemas for structured LLM outputs
const TOOL_SCHEMAS = {
  set_slot: {
    name: 'set_slot',
    description: 'Capture and validate booking information for a specific slot',
    parameters: {
      type: 'object',
      properties: {
        slot_name: {
          type: 'string',
          enum: ['service', 'time_window', 'contact', 'location_kind', 'service_address', 'business_location_id'],
          description: 'The booking slot to update'
        },
        value: {
          type: 'string',
          description: 'The extracted value for this slot'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence in the extraction (0.0-1.0)'
        }
      },
      required: ['slot_name', 'value', 'confidence']
    }
  },

  request_slot: {
    name: 'request_slot',
    description: 'Request specific missing information from the user',
    parameters: {
      type: 'object',
      properties: {
        slot_name: {
          type: 'string',
          enum: ['service', 'time_window', 'contact', 'location_preference', 'service_address', 'business_location'],
          description: 'The missing slot to request'
        },
        message: {
          type: 'string',
          maxLength: 150,
          description: 'Concise prompt to request this information (≤150 chars)'
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of choices for the user'
        }
      },
      required: ['slot_name', 'message']
    }
  },

  confirm_slot: {
    name: 'confirm_slot',
    description: 'Confirm a specific piece of booking information with the user',
    parameters: {
      type: 'object',
      properties: {
        slot_name: {
          type: 'string',
          enum: ['service', 'time_window', 'contact', 'location', 'final_booking'],
          description: 'The slot to confirm'
        },
        value: {
          type: 'string',
          description: 'The value to confirm'
        },
        attempt_number: {
          type: 'integer',
          minimum: 1,
          maximum: 3,
          description: 'Which confirmation attempt this is (1-3)'
        },
        message: {
          type: 'string',
          maxLength: 150,
          description: 'Confirmation question (≤150 chars)'
        }
      },
      required: ['slot_name', 'value', 'attempt_number', 'message']
    }
  },

  validate_location: {
    name: 'validate_location',
    description: 'Validate location information for service delivery',
    parameters: {
      type: 'object',
      properties: {
        location_type: {
          type: 'string',
          enum: ['on_site', 'at_business', 'remote'],
          description: 'Type of service location'
        },
        address_or_branch: {
          type: 'string',
          description: 'Service address or branch identifier'
        },
        validation_message: {
          type: 'string',
          maxLength: 100,
          description: 'Brief validation message'
        }
      },
      required: ['location_type', 'validation_message']
    }
  },

  schedule_appointment: {
    name: 'schedule_appointment',
    description: 'Create the final appointment with all confirmed details',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string' },
        date_time: { type: 'string' },
        duration_minutes: { type: 'integer', minimum: 15, maximum: 480 },
        location_type: { 
          type: 'string',
          enum: ['on_site', 'at_business', 'remote']
        },
        location_details: { type: 'string' },
        contact_info: { type: 'string' },
        special_notes: { type: 'string' },
        success_message: {
          type: 'string',
          maxLength: 200,
          description: 'Confirmation message for user (≤200 chars)'
        }
      },
      required: ['service', 'date_time', 'contact_info', 'success_message']
    }
  },

  escalate: {
    name: 'escalate',
    description: 'Escalate to human agent when automated booking fails',
    parameters: {
      type: 'object',
      properties: {
        escalation_type: {
          type: 'string',
          enum: ['callback', 'transfer', 'voicemail'],
          description: 'Type of escalation needed'
        },
        reason: {
          type: 'string',
          enum: ['service_unclear', 'time_unavailable', 'contact_invalid', 'location_complex', 'technical_issue'],
          description: 'Reason for escalation'
        },
        context_summary: {
          type: 'string',
          maxLength: 300,
          description: 'Summary of conversation for human agent'
        },
        escalation_message: {
          type: 'string',
          maxLength: 150,
          description: 'Message to user about escalation'
        }
      },
      required: ['escalation_type', 'reason', 'escalation_message']
    }
  },

  fetch_business_fact: {
    name: 'fetch_business_fact',
    description: 'Retrieve business information for FAQ responses',
    parameters: {
      type: 'object',
      properties: {
        fact_type: {
          type: 'string',
          enum: ['hours', 'location', 'services', 'pricing', 'policies', 'contact'],
          description: 'Type of business information requested'
        },
        specific_query: {
          type: 'string',
          description: 'Specific aspect of the fact type'
        },
        response_message: {
          type: 'string',
          maxLength: 200,
          description: 'Formatted response with the business fact'
        }
      },
      required: ['fact_type', 'response_message']
    }
  }
};

// Enhanced Intent Detection with Location Awareness
class EnhancedIntentDetector {
  constructor() {
    this.intentHistory = new Map(); // Session -> intent history
  }

  async detectIntent(transcript, context = {}) {
    const sessionId = context.sessionId || 'default';
    const history = this.intentHistory.get(sessionId) || [];
    
    // Build context-aware system prompt
    const systemPrompt = this.buildIntentDetectionPrompt(context, history);
    
    try {
      console.log('🔍 Enhanced Intent Detection:', {
        transcript: transcript.substring(0, 100),
        sessionId,
        historyLength: history.length
      });

      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        tools: [TOOL_SCHEMAS.set_slot, TOOL_SCHEMAS.fetch_business_fact],
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });

      const result = this.parseIntentResponse(response, transcript, context);
      
      // Update history
      history.push({
        transcript,
        intent: result.intent,
        confidence: result.confidence,
        timestamp: Date.now()
      });
      this.intentHistory.set(sessionId, history.slice(-5)); // Keep last 5
      
      console.log('✅ Intent Detection Result:', {
        intent: result.intent,
        confidence: result.confidence,
        hasTools: !!result.tool_calls?.length
      });

      return result;
      
    } catch (error) {
      console.error('❌ Intent detection error:', error);
      return {
        intent: 'unclear',
        confidence: 0.0,
        entities: {},
        tool_calls: [],
        rawText: transcript
      };
    }
  }

  buildIntentDetectionPrompt(context, history) {
    const orgServices = context.businessConfig?.services || [];
    const serviceList = orgServices
      .filter(service => service.active)
      .map(service => service.name)
      .join(', ');
    
    const orgName = context.organizationContext?.organizationName || 'our business';
    const locationMode = context.businessConfig?.locations?.mode || 'at_business';
    
    const historyContext = history.length > 0 
      ? `Recent conversation: ${history.map(h => `"${h.transcript}" → ${h.intent}`).join('; ')}`
      : 'Start of conversation';

    return `You are an advanced intent classifier for ${orgName}'s voice booking system.

CURRENT CONTEXT:
- Business: ${orgName}
- Services: ${serviceList || 'General appointments'}
- Location mode: ${locationMode}
- Current booking state: service=${context.service || 'none'}, time=${context.timeWindow || 'none'}, contact=${context.contact || 'none'}
- ${historyContext}

RESPONSE FORMAT:
Return JSON with: {"intent": "intent_name", "confidence": 0.0-1.0, "entities": {...}, "reasoning": "brief explanation"}

INTENT CATEGORIES:
1. booking - User wants to schedule (e.g., "I need an appointment", "book me in")
2. service_provided - User specified service (e.g., "haircut", "consultation", "repair")
3. time_provided - User specified time (e.g., "tomorrow 2pm", "next Friday morning")
4. contact_provided - User gave contact info (name, phone, email)
5. location_provided - User specified location preference or address
6. location_preference - User indicated on-site vs at-business preference
7. confirmation_yes - User confirmed (yes, correct, that's right)
8. confirmation_no - User declined (no, wrong, change that)
9. digression_question - User asked about hours/location/services/pricing
10. unclear - Cannot determine intent clearly

ENTITY EXTRACTION:
- service: Match against available services (${serviceList})
- timeWindow: Any time/date reference
- contact: Phone numbers, names, emails
- location: Addresses, branch preferences, on-site requests

LOCATION HANDLING:
${locationMode === 'on_site' ? '- This business provides on-site services - extract addresses' : ''}
${locationMode === 'at_business' ? '- This business serves at their location - note any branch preferences' : ''}
${locationMode === 'both' ? '- This business offers both on-site and at-business - determine preference' : ''}

CONFIDENCE GUIDELINES:
- 0.9+: Very clear, unambiguous intent
- 0.7-0.8: Clear intent with minor ambiguity
- 0.5-0.6: Somewhat clear but could be interpreted differently
- 0.3-0.4: Unclear but has some indicators
- 0.0-0.2: Very unclear or random input

Keep responses under 50 tokens except for final confirmations.`;
  }

  parseIntentResponse(response, transcript, context) {
    const message = response.choices[0].message;
    
    let parsedContent = {};
    try {
      parsedContent = JSON.parse(message.content);
    } catch (e) {
      console.warn('Failed to parse intent response JSON:', message.content);
    }

    // Process tool calls if present
    const tool_calls = message.tool_calls || [];
    const entities = this.extractEntitiesFromTools(tool_calls, context);

    // Merge entities with parsed content
    if (parsedContent.entities) {
      Object.assign(entities, parsedContent.entities);
    }

    return {
      intent: parsedContent.intent || 'unclear',
      confidence: parsedContent.confidence || 0.0,
      entities,
      tool_calls,
      reasoning: parsedContent.reasoning || '',
      rawText: transcript
    };
  }

  extractEntitiesFromTools(tool_calls, context) {
    const entities = {};
    
    for (const tool_call of tool_calls) {
      if (tool_call.function.name === 'set_slot') {
        const args = JSON.parse(tool_call.function.arguments);
        const slotName = args.slot_name;
        const value = args.value;
        
        // Map slot names to entity keys
        const slotMapping = {
          'service': 'service',
          'time_window': 'timeWindow',
          'contact': 'contact',
          'location_kind': 'locationKind',
          'service_address': 'serviceAddress',
          'business_location_id': 'businessLocationId'
        };
        
        const entityKey = slotMapping[slotName] || slotName;
        entities[entityKey] = value;
      }
    }
    
    return entities;
  }

  clearHistory(sessionId) {
    this.intentHistory.delete(sessionId);
  }
}

// Enhanced Response Generator with Tool Calling
class EnhancedResponseGenerator {
  constructor() {
    this.responseCache = new Map(); // Cache for frequently used responses
  }

  async generateResponse(intent, context, attemptNumber = 1) {
    const cacheKey = `${intent}_${context.organizationId}_${attemptNumber}`;
    
    // Check cache for performance
    if (this.responseCache.has(cacheKey)) {
      return this.responseCache.get(cacheKey);
    }

    try {
      const systemPrompt = this.buildResponsePrompt(intent, context, attemptNumber);
      
      console.log('🎯 Enhanced Response Generation:', {
        intent,
        attempt: attemptNumber,
        hasContext: !!context.businessConfig
      });

      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: this.buildUserMessage(intent, context) }
        ],
        tools: this.getRelevantTools(intent, context),
        tool_choice: this.determineToolChoice(intent, context),
        temperature: 0.2,
        max_tokens: 80, // Strict token limit for low latency
      });

      const result = this.parseResponseWithTools(response, intent, context);
      
      // Cache successful responses
      if (result.message && result.message.length < 150) {
        this.responseCache.set(cacheKey, result);
      }
      
      console.log('✅ Response Generated:', {
        messageLength: result.message?.length || 0,
        hasTools: !!result.tool_calls?.length
      });

      return result;
      
    } catch (error) {
      console.error('❌ Response generation error:', error);
      return {
        message: this.getFallbackResponse(intent, context),
        tool_calls: [],
        confidence: 0.0
      };
    }
  }

  buildResponsePrompt(intent, context, attemptNumber) {
    const orgScripts = context.businessConfig?.scripts || {};
    const servicelist = context.businessConfig?.services?.filter(s => s.active)?.map(s => s.name).slice(0, 3).join(', ') || 'our services';
    const orgName = context.organizationContext?.organizationName || 'our business';
    
    const progressSummary = context.progressSummary || '';
    const confirmationAttempts = context.confirmationAttempts || {};

    return `You are ${orgName}'s professional voice booking assistant. Generate concise, helpful responses.

CURRENT SITUATION:
- Intent: ${intent}
- Attempt: ${attemptNumber}/3
- Progress: ${progressSummary || 'Just started'}
- Service: ${context.service || 'not specified'} (validated: ${context.serviceValidated || false})
- Time: ${context.timeWindow || 'not specified'} (confirmed: ${context.timeConfirmed || false})
- Contact: ${context.contact || 'not specified'} (validated: ${context.contactValidated || false})
- Location: ${context.locationKind || 'not specified'} (validated: ${context.locationValidated || false})

BUSINESS INFO:
- Name: ${orgName}
- Services: ${servicelist}
- Custom scripts: ${Object.keys(orgScripts).join(', ') || 'using defaults'}

RESPONSE REQUIREMENTS:
- Keep responses under 50 tokens
- Use tools for structured actions
- Be conversational but efficient
- Reference progress when appropriate
- Escalate after 3 attempts on any slot

THREE-STRIKE CONFIRMATION:
- Attempt 1: Direct, friendly confirmation
- Attempt 2: Clearer, more specific language
- Attempt 3: Very explicit, offer alternatives or escalation

TOOLS AVAILABLE:
- request_slot: Ask for missing information
- confirm_slot: Confirm specific details
- validate_location: Handle location logistics
- schedule_appointment: Complete booking
- escalate: Transfer to human
- fetch_business_fact: Answer FAQ questions

Use tools instead of just text when taking actions.`;
  }

  buildUserMessage(intent, context) {
    const parts = [`User intent: ${intent}`];
    
    if (context.service) parts.push(`Service mentioned: ${context.service}`);
    if (context.timeWindow) parts.push(`Time mentioned: ${context.timeWindow}`);
    if (context.contact) parts.push(`Contact provided: ${context.contact}`);
    if (context.locationKind) parts.push(`Location type: ${context.locationKind}`);
    
    return parts.join('. ');
  }

  getRelevantTools(intent, context) {
    const baseTools = [TOOL_SCHEMAS.request_slot, TOOL_SCHEMAS.escalate];
    
    switch (intent) {
      case 'service_provided':
        return [...baseTools, TOOL_SCHEMAS.confirm_slot];
      
      case 'time_provided':
        return [...baseTools, TOOL_SCHEMAS.confirm_slot];
      
      case 'contact_provided':
        return [...baseTools, TOOL_SCHEMAS.confirm_slot];
      
      case 'location_provided':
      case 'location_preference':
        return [...baseTools, TOOL_SCHEMAS.validate_location, TOOL_SCHEMAS.confirm_slot];
      
      case 'confirmation_yes':
        if (this.hasAllRequiredData(context)) {
          return [...baseTools, TOOL_SCHEMAS.schedule_appointment];
        }
        return [...baseTools, TOOL_SCHEMAS.request_slot];
      
      case 'digression_question':
        return [TOOL_SCHEMAS.fetch_business_fact, ...baseTools];
      
      default:
        return baseTools;
    }
  }

  determineToolChoice(intent, context) {
    // Force tool use for specific intents
    if (['service_provided', 'time_provided', 'contact_provided', 'location_provided'].includes(intent)) {
      return 'required';
    }
    
    if (intent === 'confirmation_yes' && this.hasAllRequiredData(context)) {
      return 'required'; // Force appointment scheduling
    }
    
    if (intent === 'digression_question') {
      return 'required'; // Force fact fetching
    }
    
    return 'auto';
  }

  parseResponseWithTools(response, intent, context) {
    const message = response.choices[0].message;
    const tool_calls = message.tool_calls || [];
    
    // Extract text response
    let textResponse = message.content || '';
    
    // If we have tool calls, use them to generate appropriate response
    if (tool_calls.length > 0) {
      const primaryTool = tool_calls[0];
      const args = JSON.parse(primaryTool.function.arguments);
      
      // Use tool-specific message if available
      if (args.message) {
        textResponse = args.message;
      } else if (args.response_message) {
        textResponse = args.response_message;
      } else if (args.success_message) {
        textResponse = args.success_message;
      } else if (args.escalation_message) {
        textResponse = args.escalation_message;
      }
    }
    
    return {
      message: textResponse,
      tool_calls,
      confidence: 0.8 // Tool-based responses are generally high confidence
    };
  }

  hasAllRequiredData(context) {
    const hasService = context.service && context.serviceValidated;
    const hasTime = context.timeWindow && context.timeConfirmed;
    const hasContact = context.contact && context.contactValidated;
    
    // Location validation depends on business type
    const businessConfig = context.businessConfig;
    let hasLocation = true; // Default to true for backwards compatibility
    
    if (businessConfig?.locations?.mode === 'on_site') {
      hasLocation = context.locationKind === 'on_site' && context.serviceAddress && context.locationValidated;
    } else if (businessConfig?.locations?.mode === 'at_business' && businessConfig?.locations?.branches?.length > 1) {
      hasLocation = context.locationKind === 'at_business' && context.businessLocationId && context.locationValidated;
    }
    
    return hasService && hasTime && hasContact && hasLocation;
  }

  getFallbackResponse(intent, context) {
    const fallbacks = {
      booking: "I'm here to help you schedule an appointment. What service do you need?",
      service_provided: `What type of service are you looking for today?`,
      time_provided: "When would you like to schedule your appointment?",
      contact_provided: "Can I get your contact information?",
      location_provided: "Where would you like the service?",
      confirmation_yes: "Great! Let me confirm those details.",
      confirmation_no: "Let me get that corrected for you.",
      unclear: "I want to make sure I understand. Are you looking to schedule an appointment?"
    };
    
    return fallbacks[intent] || "How can I help you today?";
  }
}

// Main Enhanced LLM Service
class EnhancedLLMService {
  constructor() {
    this.intentDetector = new EnhancedIntentDetector();
    this.responseGenerator = new EnhancedResponseGenerator();
    this.sessionManager = new Map(); // sessionId -> session data
  }

  async processMessage(transcript, sessionId, context = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Enhanced LLM Processing:', {
        transcript: transcript.substring(0, 50),
        sessionId,
        organizationId: context.organizationId
      });

      // Step 1: Intent Detection (parallel with context update)
      const intentPromise = this.intentDetector.detectIntent(transcript, context);
      
      // Step 2: Update session context
      this.updateSession(sessionId, context);
      
      // Wait for intent detection
      const intentResult = await intentPromise;
      const intentMs = Date.now() - startTime;

      // Step 3: Generate response based on intent and tools
      const responseStartTime = Date.now();
      const attemptNumber = this.getAttemptNumber(context, intentResult.intent);
      
      const responseResult = await this.responseGenerator.generateResponse(
        intentResult.intent,
        { ...context, ...intentResult.entities },
        attemptNumber
      );
      const responseMs = Date.now() - responseStartTime;

      // Step 4: Process tool calls if present
      const toolResults = await this.processToolCalls(responseResult.tool_calls, context);

      // Step 5: Build final result
      const finalResult = {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        response: responseResult.message,
        entities: intentResult.entities,
        bookingData: this.extractBookingData(intentResult.entities, toolResults, context),
        tool_calls: responseResult.tool_calls,
        tool_results: toolResults,
        processingTime: {
          intent: intentMs,
          response: responseMs,
          total: Date.now() - startTime
        },
        sessionId
      };

      console.log('✅ Enhanced LLM Complete:', {
        intent: finalResult.intent,
        confidence: finalResult.confidence,
        totalMs: finalResult.processingTime.total,
        toolCount: finalResult.tool_calls?.length || 0
      });

      return finalResult;
      
    } catch (error) {
      console.error('❌ Enhanced LLM Error:', error);
      
      return {
        intent: 'error',
        confidence: 0.0,
        response: "I'm sorry, I'm having trouble processing that. Could you please repeat?",
        entities: {},
        bookingData: {},
        tool_calls: [],
        tool_results: [],
        processingTime: { total: Date.now() - startTime },
        error: error.message,
        sessionId
      };
    }
  }

  updateSession(sessionId, context) {
    const session = this.sessionManager.get(sessionId) || {
      startTime: Date.now(),
      turnCount: 0,
      confirmationAttempts: {}
    };
    
    session.turnCount++;
    session.lastContext = context;
    session.lastUpdate = Date.now();
    
    this.sessionManager.set(sessionId, session);
  }

  getAttemptNumber(context, intent) {
    const attempts = context.confirmationAttempts || {};
    
    // Map intents to slot types for attempt tracking
    const intentSlotMap = {
      'service_provided': 'service',
      'time_provided': 'timeWindow',
      'contact_provided': 'contact',
      'location_provided': 'location'
    };
    
    const slotType = intentSlotMap[intent];
    return slotType ? (attempts[slotType] || 0) + 1 : 1;
  }

  async processToolCalls(tool_calls, context) {
    const results = [];
    
    for (const tool_call of tool_calls || []) {
      try {
        const args = JSON.parse(tool_call.function.arguments);
        const result = await this.executeToolCall(tool_call.function.name, args, context);
        results.push({
          tool: tool_call.function.name,
          args,
          result,
          success: true
        });
      } catch (error) {
        console.error('Tool call error:', error);
        results.push({
          tool: tool_call.function.name,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  async executeToolCall(toolName, args, context) {
    switch (toolName) {
      case 'set_slot':
        return this.handleSetSlot(args, context);
      
      case 'request_slot':
        return this.handleRequestSlot(args, context);
      
      case 'confirm_slot':
        return this.handleConfirmSlot(args, context);
      
      case 'validate_location':
        return this.handleValidateLocation(args, context);
      
      case 'schedule_appointment':
        return this.handleScheduleAppointment(args, context);
      
      case 'escalate':
        return this.handleEscalate(args, context);
      
      case 'fetch_business_fact':
        return this.handleFetchBusinessFact(args, context);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  handleSetSlot(args, context) {
    return {
      slot: args.slot_name,
      value: args.value,
      confidence: args.confidence,
      action: 'slot_updated'
    };
  }

  handleRequestSlot(args, context) {
    return {
      slot: args.slot_name,
      message: args.message,
      options: args.options || [],
      action: 'slot_requested'
    };
  }

  handleConfirmSlot(args, context) {
    return {
      slot: args.slot_name,
      value: args.value,
      attempt: args.attempt_number,
      message: args.message,
      action: 'slot_confirmation'
    };
  }

  handleValidateLocation(args, context) {
    // Basic location validation - in production, integrate with mapping services
    const isValid = args.location_type && ['on_site', 'at_business', 'remote'].includes(args.location_type);
    
    return {
      location_type: args.location_type,
      address_or_branch: args.address_or_branch,
      valid: isValid,
      message: args.validation_message,
      action: 'location_validated'
    };
  }

  handleScheduleAppointment(args, context) {
    return {
      appointment_data: {
        service: args.service,
        date_time: args.date_time,
        duration_minutes: args.duration_minutes || 60,
        location_type: args.location_type,
        location_details: args.location_details,
        contact_info: args.contact_info,
        special_notes: args.special_notes
      },
      success_message: args.success_message,
      action: 'appointment_scheduled'
    };
  }

  handleEscalate(args, context) {
    return {
      escalation_type: args.escalation_type,
      reason: args.reason,
      context_summary: args.context_summary,
      message: args.escalation_message,
      action: 'escalated_to_human'
    };
  }

  handleFetchBusinessFact(args, context) {
    const businessConfig = context.businessConfig || {};
    const facts = this.getBusinessFacts(args.fact_type, businessConfig);
    
    return {
      fact_type: args.fact_type,
      specific_query: args.specific_query,
      facts,
      response: args.response_message,
      action: 'business_fact_retrieved'
    };
  }

  getBusinessFacts(factType, businessConfig) {
    switch (factType) {
      case 'hours':
        return businessConfig.businessHours || 'Please call for our current hours';
      
      case 'location':
        return businessConfig.locations || 'Please call for location information';
      
      case 'services':
        const services = businessConfig.services?.filter(s => s.active)?.map(s => s.name) || [];
        return services.length > 0 ? services.join(', ') : 'Please call for service information';
      
      case 'pricing':
        return 'Please call for current pricing information';
      
      case 'policies':
        return businessConfig.policies || 'Please call for policy information';
      
      case 'contact':
        return businessConfig.escalationNumber || 'Please hold while I connect you';
      
      default:
        return 'Please call for more information';
    }
  }

  extractBookingData(entities, toolResults, existingContext) {
    const bookingData = { ...existingContext };
    
    // Extract from entities
    if (entities.service) bookingData.service = entities.service;
    if (entities.timeWindow) bookingData.timeWindow = entities.timeWindow;
    if (entities.contact) bookingData.contact = entities.contact;
    if (entities.locationKind) bookingData.locationKind = entities.locationKind;
    if (entities.serviceAddress) bookingData.serviceAddress = entities.serviceAddress;
    if (entities.businessLocationId) bookingData.businessLocationId = entities.businessLocationId;
    
    // Extract from tool results
    for (const result of toolResults || []) {
      if (result.success && result.result?.action === 'slot_updated') {
        const slot = result.result.slot;
        const value = result.result.value;
        
        if (slot === 'service') bookingData.service = value;
        else if (slot === 'time_window') bookingData.timeWindow = value;
        else if (slot === 'contact') bookingData.contact = value;
        else if (slot === 'location_kind') bookingData.locationKind = value;
        else if (slot === 'service_address') bookingData.serviceAddress = value;
        else if (slot === 'business_location_id') bookingData.businessLocationId = value;
      }
    }
    
    return bookingData;
  }

  clearSession(sessionId) {
    this.sessionManager.delete(sessionId);
    this.intentDetector.clearHistory(sessionId);
  }
}

// Backwards compatibility wrapper
const createEnhancedLLMService = (context = {}) => {
  return new EnhancedLLMService();
};

module.exports = {
  EnhancedLLMService,
  EnhancedIntentDetector,
  EnhancedResponseGenerator,
  createEnhancedLLMService,
  TOOL_SCHEMAS
};