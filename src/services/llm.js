const OpenAI = require('openai');

// Create OpenAI client lazily to avoid module-level instantiation
let openai = null;
const getOpenAIClient = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

// Enhanced intent detection system
const detectIntent = async (transcript, conversationContext = {}) => {
  // Extract organization-specific services for better intent detection
  const orgServices = conversationContext.businessConfig?.services || [];
  const serviceList = orgServices
    .filter(service => service.active)
    .map(service => service.name)
    .join(', ');
  
  const orgName = conversationContext.organizationContext?.organizationName || 'our business';
  
  const systemPrompt = `You are an intent detection system for appointment booking at ${orgName}. Analyze the user's speech and return a JSON response with:
{
  "intent": "booking|service_provided|time_provided|contact_provided|confirmation_yes|confirmation_no|affirmative|negative|unclear",
  "confidence": 0.0-1.0,
  "entities": {
    "service": "extracted service type if mentioned",
    "timeWindow": "extracted time/date if mentioned",
    "contact": "extracted contact info if mentioned"
  },
  "rawText": "original transcript"
}

Available services at this business: ${serviceList || 'General appointments'}
Organization: ${conversationContext.organizationContext?.organizationName || 'Default Organization'}
Current conversation context: ${JSON.stringify(conversationContext)}

Intent definitions:
- booking: User wants to book an appointment (e.g., "I need an appointment", "Do you have availability?", "Can I schedule?")
- service_provided: User specified what service they need (e.g., "I need a haircut", "consultation", "repair", "perm", "a perm", "I want a perm")  
- time_provided: User specified when they want the appointment (e.g., "tomorrow at 2pm", "next Friday")
- contact_provided: User provided contact information (phone number, name, email)
- confirmation_yes: User confirmed/agreed (yes, correct, that's right, etc.)
- confirmation_no: User declined/disagreed (no, that's wrong, etc.)
- affirmative: General positive response when user confirms they want to proceed
- negative: General negative response
- unclear: Cannot determine intent

IMPORTANT: 
- "Do you have availability for [time]?" should be classified as 'booking' intent, not 'time_provided'.
- If user mentions any service from the available services list, classify as 'service_provided' and extract the exact service name
- Match service names flexibly (e.g., "cut" matches "Haircut", "cleaning" matches "Dental Cleaning")
- If user mentions a service type in any form, classify as 'service_provided' and extract the service
- For ${orgName}, pay special attention to their specific service offerings

Be strict with confidence scores. Only use >0.7 for very clear intents.`;

  try {
    console.log('🔍 LLM Intent Detection Request:', {
      model: 'gpt-4o',
      transcript: transcript,
      context: conversationContext
    });

    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { "type": "json_object" },
    });

    console.log('✅ LLM Intent Detection Response:', {
      usage: response.usage,
      rawResponse: response.choices[0].message.content
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log('📋 Parsed Intent Result:', result);
    
    return {
      ...result,
      rawText: transcript
    };
  } catch (error) {
    console.error('❌ Intent detection error:', error);
    return {
      intent: 'unclear',
      confidence: 0.0,
      entities: {},
      rawText: transcript
    };
  }
};

// Generate contextual responses based on state machine state
const generateResponse = async (state, context, retryCount = 0) => {
  // Use organization-specific scripts if available
  const orgScripts = context.businessConfig?.scripts || {};
  const availableServices = context.businessConfig?.services?.filter(s => s.active)?.map(s => s.name) || [];
  const serviceList = availableServices.length > 0 ? availableServices.slice(0, 3).join(', ') : 'general appointments';
  
  const prompts = {
    greeting: orgScripts.greeting || context.businessConfig?.greeting || "Hello! This is the infinioffice after hours agent, I'm here to help you schedule an appointment. What service would you like to book?",
    
    service: orgScripts.service || `What type of service are you looking to schedule today? We offer ${serviceList}${availableServices.length > 3 ? ' and more' : ''}.`,
    service_after_time: `Great! I see you're looking for availability on ${context.preferredTime || context.timeWindow || 'your preferred date'}. What type of service do you need? We offer ${serviceList}${availableServices.length > 3 ? ' and more' : ''}.`,
    service_retry: retryCount === 1 
      ? `I didn't quite catch that. Could you please tell me what service you need? We offer ${serviceList}${availableServices.length > 3 ? ' and other services' : ''}.`
      : `I'm having trouble understanding the service type. Could you be more specific? Our main services include ${serviceList}.`,
    service_invalid: `I want to make sure we can provide exactly what you need. We currently offer ${serviceList}${availableServices.length > 3 ? ' and other services' : ''}. Could you choose one of these, or would you like someone to call you back to discuss your specific needs?`,
    
    timeWindow: orgScripts.timeWindow || `Great! You'd like to book a ${context.service || 'service'}. When would you prefer to schedule this?`,
    timeWindow_retry: retryCount === 1
      ? "I didn't get the timing. When would work best for you? You can say something like 'tomorrow morning' or 'next Friday at 2pm'."
      : "Let me try again - what day and time would you prefer for your appointment?",
    
    contact: orgScripts.contact || `Perfect! So that's ${context.service || 'your appointment'} for ${context.timeWindow || context.preferredTime || 'your preferred time'}. Can I get your name and phone number?`,
    contact_retry: retryCount === 1
      ? "I need your contact information to complete the booking. Could you please provide your name and phone number?"
      : "I'm sorry, I didn't catch your contact details. Please share your name and phone number.",
    
    confirmation: orgScripts.confirmation || `Let me confirm: ${context.service || 'appointment'} for ${context.timeWindow || context.preferredTime || 'your preferred time'}, and I have your contact as ${context.contact}. Is this correct?`,
    confirmation_retry: retryCount === 1
      ? "I need to confirm these details are correct before booking. Please say 'yes' if everything looks good, or 'no' if we need to make changes."
      : "Please confirm if these details are correct by saying 'yes' or 'no'.",
    
    clarification: "I want to make sure I understand correctly. Are you looking to schedule an appointment?",
    
    timeout: "I didn't hear a response. Are you still there?",
    general_timeout: "It seems like we lost connection. Would you like to try scheduling again?",
    
    fallback: orgScripts.fallback || "I'm having trouble completing your booking over the phone. Let me take down your information and someone will call you back within the hour.",
    
    booking_error: "I'm sorry, there was an issue completing your booking. Let me try that again.",
    
    calendar_unavailable: "I'm having some difficulty accessing our scheduling system right now. I can still help you by taking down your information and having someone call you back to confirm your appointment.",
    
    message_complete: "Thank you! I've taken down your information and someone from our team will contact you within the hour to complete your booking.",
    message_error: "I apologize, but I'm experiencing technical difficulties. Please call back or visit our website to schedule.",
    
    success: orgScripts.success || `Excellent! Your ${context.service} appointment is confirmed for ${context.timeWindow || context.preferredTime}. You'll receive a confirmation message at ${context.contact}. Is there anything else I can help you with?`,
    
    // Callback scheduling responses
    callback_scheduled: "Perfect! I've noted all your information and someone from our team will call you back within the hour to finalize your appointment. Is there anything else I can help you with today?",
    
    service_callback: `I want to make sure we can provide exactly what you need. I've noted your request and someone knowledgeable about our services will call you back within the hour to discuss your options and schedule your appointment.`,
    
    calendar_callback: "I'm experiencing some technical difficulties with our scheduling system, but I don't want to keep you waiting. I've taken down your information and someone will call you back within the hour to confirm your appointment time.",
  };

  return prompts[state] || "I'm here to help you schedule an appointment. What can I do for you?";
};

// Legacy function for backward compatibility
const getCompletion = async (prompt) => {
  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: 'You are a scheduling agent. Be concise and directive. Goal: complete booking/reschedule/cancel with minimal words. No chit-chat. Offer at most top 2–3 options. Avoid long explanations.' }, { role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 120,
    presence_penalty: 0,
    frequency_penalty: 0,
  });
  return response.choices[0].message.content;
};

// Session management
const sessionManager = {
  sessions: new Map(),
  
  getSession: function(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        messages: [],
        context: {},
        startTime: Date.now()
      });
    }
    return this.sessions.get(sessionId);
  },
  
  updateSession: function(sessionId, updates) {
    const session = this.getSession(sessionId);
    Object.assign(session, updates);
    return session;
  },
  
  clearSession: function(sessionId) {
    this.sessions.delete(sessionId);
  },
  
  addMessage: function(sessionId, message) {
    const session = this.getSession(sessionId);
    session.messages.push({
      ...message,
      timestamp: Date.now()
    });
    return session;
  }
};

// Main processing function that integrates intent detection and response generation
const processMessage = async (transcript, sessionId, context = {}, callId = null, turnIndex = 0) => {
  const { createTurn, updateTurn } = require('./db');
  
  try {
    console.log('🚀 ProcessMessage started:', {
      transcript: transcript,
      sessionId: sessionId,
      context: context,
      callId: callId,
      turnIndex: turnIndex
    });
    
    const startTime = Date.now();
    
    // Create turn record for tracking
    let turnId = null;
    if (callId) {
      try {
        const turn = await createTurn({
          callId,
          turnIndex,
          transcriptIn: transcript
        });
        turnId = turn.id;
      } catch (error) {
        console.error('Failed to create turn record:', error);
      }
    }
    
    // Get session for context
    const session = sessionManager.getSession(sessionId);
    
    // Step 1: Intent Detection
    const intentResult = await detectIntent(transcript, {
      ...context,
      sessionHistory: session.messages.slice(-3) // Last 3 messages for context
    });
    
    const intentMs = Date.now() - startTime;
    
    // Step 2: Extract and validate booking data from entities (before response generation)
    const bookingData = extractBookingData(intentResult.entities, context);
    
    // Step 2.5: Validate service if provided and update context
    if (bookingData.service && context.businessConfig) {
      const { validateService } = require('./stateMachine');
      const isValid = validateService(bookingData.service, context.businessConfig);
      bookingData.serviceValidated = isValid;
      
      if (!isValid) {
        console.log(`🚫 Service validation failed for: "${bookingData.service}"`);
      }
    }
    
    // Step 3: Generate contextual response
    const responseStartTime = Date.now();
    let responseText;
    
    // Determine current state for response generation
    const currentState = context.state || 'greeting';
    const retryCount = session.context.retryCount || 0;
    
    // More sophisticated handling of unclear intents and low confidence
    if (intentResult.intent === 'unclear' && retryCount > 4) { // Increased threshold from 2 to 4
      responseText = await generateResponse('fallback', context, retryCount);
    } else if (intentResult.confidence < 0.3 && retryCount > 2) { // Lower confidence threshold and higher retry count
      responseText = await generateResponse('clarification', context, retryCount);
      session.context.retryCount = (retryCount || 0) + 1;
    } else if (intentResult.confidence < 0.5 && retryCount <= 2) {
      // Give LLM more chances at medium confidence levels
      responseText = await generateResponse('clarification', context, retryCount);
      session.context.retryCount = (retryCount || 0) + 1;
    } else {
      // Generate response based on current state and intent
      const stateKey = mapIntentToStateKey(intentResult.intent, currentState, context);
      
      // Merge existing context with new booking data for response generation
      const contextForResponse = {
        ...context,
        ...bookingData  // Include newly extracted data
      };
      
      console.log('🎯 Response Generation:', {
        intent: intentResult.intent,
        stateKey: stateKey,
        contextForResponse: contextForResponse,
        currentState: currentState
      });
      
      responseText = await generateResponse(stateKey, contextForResponse, retryCount);
      session.context.retryCount = 0; // Reset retry count on successful intent
    }
    
    const responseMs = Date.now() - responseStartTime;
    
    // Step 3: Update session
    sessionManager.addMessage(sessionId, {
      type: 'user',
      content: transcript,
      intent: intentResult.intent,
      confidence: intentResult.confidence
    });
    
    sessionManager.addMessage(sessionId, {
      type: 'assistant',
      content: responseText,
      processingTime: {
        intent: intentMs,
        response: responseMs,
        total: Date.now() - startTime
      }
    });
    
    // Step 4: Booking data already extracted above
    
    // Step 5: Update turn record with processing times
    if (turnId && callId) {
      try {
        await updateTurn(turnId, {
          transcriptOut: responseText,
          llmMs: Date.now() - startTime
        });
      } catch (error) {
        console.error('Failed to update turn record:', error);
      }
    }
    
    const finalResult = {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      response: responseText,
      bookingData,
      entities: intentResult.entities,
      processingTime: {
        intent: intentMs,
        response: responseMs,
        total: Date.now() - startTime
      },
      sessionId,
      turnId
    };
    
    console.log('✅ ProcessMessage completed successfully:', {
      intent: finalResult.intent,
      confidence: finalResult.confidence,
      response: finalResult.response?.substring(0, 100) + '...',
      bookingData: finalResult.bookingData,
      processingTime: finalResult.processingTime
    });
    
    return finalResult;
    
  } catch (error) {
    console.error('Error in processMessage:', error);
    
    // Return fallback response
    return {
      intent: 'error',
      confidence: 0.0,
      response: "I'm sorry, I'm having trouble processing your request. Could you please repeat that?",
      bookingData: {},
      entities: {},
      processingTime: { total: Date.now() - startTime },
      error: error.message,
      sessionId,
      turnId
    };
  }
};

// Enhanced helper function to map intents to state response keys with logical validation
const mapIntentToStateKey = (intent, currentState, context = {}) => {
  const { validateContext } = require('./llm');
  
  // Validate context before proceeding
  const contextValidation = validateContext(context);
  if (!contextValidation.isValid) {
    console.warn('⚠️ Context validation failed:', contextValidation.issues);
  }

  // Log the mapping attempt for debugging
  console.log(`🎯 Mapping intent "${intent}" in state "${currentState}" with context:`, {
    service: context.service,
    serviceValidated: context.serviceValidated,
    retryCount: context.retryCount,
    hasBusinessConfig: !!context.businessConfig
  });

  // Check for fallback conditions - but be more conservative
  if (shouldTriggerFallback(context, intent)) {
    console.log(`🔄 Fallback triggered for intent: ${intent}`);
    return determineFallbackResponse(context, intent, currentState);
  }
  
  // If user provided time but no service yet, ask for service first
  if (intent === 'time_provided' && !context.service) {
    return 'service_after_time';
  }
  
  // Enhanced service validation logic - be more lenient initially
  if (intent === 'service_provided') {
    // Give the service a chance to be processed first before marking as invalid
    if (context.service && context.serviceValidated === false && (context.retryCount || 0) < 2) {
      // First attempt - try to re-validate rather than marking as invalid immediately
      console.log(`🔄 Re-attempting service validation for: "${context.service}"`);
      return 'service'; // Ask again rather than marking invalid
    }
    
    // Only mark as invalid after multiple attempts
    if (context.service && context.serviceValidated === false && (context.retryCount || 0) >= 2) {
      return 'service_invalid';
    }
    
    // If we have validated service but no time, ask for time
    if (context.service && context.serviceValidated && !context.preferredTime && !context.timeWindow) {
      return 'timeWindow';
    }
    // If we have service and time but no contact, ask for contact
    if (context.service && context.serviceValidated && (context.preferredTime || context.timeWindow) && !context.contact) {
      return 'contact';
    }
    // If service validation is still pending or successful, proceed to time collection
    if (!context.preferredTime && !context.timeWindow) {
      return 'timeWindow';
    }
  }
  
  // Handle affirmative responses with enhanced logic
  if (intent === 'affirmative') {
    // Apply progressive information gathering
    if (currentState === 'collectService' || currentState === 'idle') {
      return 'service';
    }
    
    // Check for service validation
    if (context.service && !context.serviceValidated) {
      return 'service_invalid';
    }
    
    // If we have validated service but no time, ask for time
    if (context.service && context.serviceValidated && !context.preferredTime && !context.timeWindow) {
      return 'timeWindow';
    }
    // If we have service and time but no contact, ask for contact
    if (context.service && context.serviceValidated && (context.preferredTime || context.timeWindow) && !context.contact) {
      return 'contact';
    }
  }
  
  // Enhanced error recovery logic
  if (intent === 'unclear' || intent === 'error') {
    return handleUnclearIntent(context, currentState);
  }
  
  // Calendar integration failure handling
  if (context.calendarError || context.integrationFailure) {
    return 'calendar_unavailable';
  }
  
  const mapping = {
    'booking': 'service',
    'service_provided': context.serviceValidated ? 'timeWindow' : 'service_invalid', 
    'time_provided': 'contact',
    'contact_provided': 'confirmation',
    'confirmation_yes': 'success',
    'confirmation_no': 'service',
    'unclear': 'clarification',
    'timeout': currentState === 'greeting' ? 'general_timeout' : 'timeout'
  };
  
  return mapping[intent] || 'clarification';
};

// Helper function to determine if fallback should be triggered
const shouldTriggerFallback = (context, intent) => {
  const highRetryCount = (context.retryCount || 0) >= 5; // Increased from 3 to 5 
  const persistentServiceIssue = context.service && context.serviceValidated === false && (context.retryCount || 0) >= 3;
  const integrationFailure = context.calendarError || context.integrationFailure;
  
  // Be more lenient - don't trigger fallback immediately
  const shouldFallback = highRetryCount || persistentServiceIssue || integrationFailure;
  
  if (shouldFallback) {
    console.log(`🔄 LLM Triggering fallback: retries=${context.retryCount}, service="${context.service}", validated=${context.serviceValidated}, intent="${intent}"`);
  }
  
  return shouldFallback;
};

// Helper function to determine appropriate fallback response
const determineFallbackResponse = (context, intent, currentState) => {
  if (context.calendarError || context.integrationFailure) {
    return 'calendar_callback';
  }
  
  if (context.service && context.serviceValidated === false) {
    return 'service_callback';
  }
  
  if ((context.retryCount || 0) >= 3) {
    return 'callback_scheduled';
  }
  
  return 'fallback';
};

// Helper function to handle unclear intents with context-aware recovery
const handleUnclearIntent = (context, currentState) => {
  const retryCount = context.retryCount || 0;
  
  // Progressive clarification based on what we already have
  // Increased threshold before giving up
  if (retryCount >= 5) {
    return 'callback_scheduled';
  }
  
  // Context-aware clarification with more attempts before escalation
  if (!context.service) {
    if (retryCount <= 1) {
      return 'service';
    } else if (retryCount <= 3) {
      return 'service_retry';
    } else {
      return 'service_invalid'; // Offer service options or callback
    }
  }
  
  if (context.service && !context.serviceValidated) {
    // Give the LLM more chances to validate the service
    if (retryCount <= 2) {
      return 'service_invalid';
    } else {
      return 'service_callback'; // Escalate to human for service discussion
    }
  }
  
  if (context.service && context.serviceValidated && !context.preferredTime) {
    return retryCount <= 2 ? 'timeWindow' : 'timeWindow_retry';
  }
  
  if (context.service && context.preferredTime && !context.contact) {
    return retryCount <= 2 ? 'contact' : 'contact_retry';
  }
  
  return 'clarification';
};

// Helper function to extract booking data from entities with enhanced persistence
const extractBookingData = (entities, existingContext = {}) => {
  const extractedData = {
    service: entities.service || existingContext.service,
    preferredTime: entities.timeWindow || existingContext.preferredTime || existingContext.timeWindow,
    contact: entities.contact || existingContext.contact,
    serviceValidated: existingContext.serviceValidated || false,
    calendarError: existingContext.calendarError || false,
    integrationFailure: existingContext.integrationFailure || false,
    retryCount: existingContext.retryCount || 0,
    businessConfig: existingContext.businessConfig || null,
    fallbackReason: existingContext.fallbackReason || null,
  };

  // Log context preservation for debugging
  if (extractedData.service) {
    console.log(`📋 Context preserved - Service: "${extractedData.service}", Validated: ${extractedData.serviceValidated}`);
  }
  if (extractedData.preferredTime) {
    console.log(`📋 Context preserved - Time: "${extractedData.preferredTime}"`);
  }
  if (extractedData.contact) {
    console.log(`📋 Context preserved - Contact: "${extractedData.contact}"`);
  }

  return extractedData;
};

// Enhanced context validation function
const validateContext = (context) => {
  const issues = [];
  
  if (!context) {
    issues.push('Context is null or undefined');
    return { isValid: false, issues };
  }

  // Check for required business configuration
  if (!context.businessConfig) {
    issues.push('Missing businessConfig in context');
  } else {
    if (!context.businessConfig.services || context.businessConfig.services.length === 0) {
      issues.push('No services configured in businessConfig');
    }
  }

  // Check for context consistency
  if (context.service && context.serviceValidated === undefined) {
    issues.push('Service provided but validation status unknown');
  }

  if (context.serviceValidated === true && !context.service) {
    issues.push('Service marked as validated but no service provided');
  }

  const isValid = issues.length === 0;
  return { isValid, issues };
};

module.exports = {
  getCompletion,
  detectIntent,
  generateResponse,
  processMessage,
  sessionManager,
  mapIntentToStateKey,
  extractBookingData,
  validateContext,
  shouldTriggerFallback,
  determineFallbackResponse,
  handleUnclearIntent,
};