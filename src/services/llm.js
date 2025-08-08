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
  const systemPrompt = `You are an intent detection system for appointment booking. Analyze the user's speech and return a JSON response with:
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

Current conversation context: ${JSON.stringify(conversationContext)}

Intent definitions:
- booking: User wants to book an appointment
- service_provided: User specified what service they need
- time_provided: User specified when they want the appointment
- contact_provided: User provided contact information
- confirmation_yes: User confirmed/agreed (yes, correct, that's right, etc.)
- confirmation_no: User declined/disagreed (no, that's wrong, etc.)
- affirmative: General positive response
- negative: General negative response
- unclear: Cannot determine intent

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
  const prompts = {
    greeting: "Hello! I'm here to help you schedule an appointment. What service would you like to book?",
    
    service: "What type of service are you looking to schedule today?",
    service_retry: retryCount === 1 
      ? "I didn't quite catch that. Could you please tell me what service you need? For example, consultation, maintenance, or repair?"
      : "I'm having trouble understanding the service type. Could you be more specific about what you need help with?",
    
    timeWindow: `Great! You'd like to book ${context.service}. When would you prefer to schedule this?`,
    timeWindow_retry: retryCount === 1
      ? "I didn't get the timing. When would work best for you? You can say something like 'tomorrow morning' or 'next Friday at 2pm'."
      : "Let me try again - what day and time would you prefer for your appointment?",
    
    contact: `Perfect! So that's ${context.service} for ${context.timeWindow}. Can I get your name and phone number?`,
    contact_retry: retryCount === 1
      ? "I need your contact information to complete the booking. Could you please provide your name and phone number?"
      : "I'm sorry, I didn't catch your contact details. Please share your name and phone number.",
    
    confirmation: `Let me confirm: ${context.service} appointment for ${context.timeWindow}, and I have your contact as ${context.contact}. Is this correct?`,
    confirmation_retry: retryCount === 1
      ? "I need to confirm these details are correct before booking. Please say 'yes' if everything looks good, or 'no' if we need to make changes."
      : "Please confirm if these details are correct by saying 'yes' or 'no'.",
    
    clarification: "I want to make sure I understand correctly. Are you looking to schedule an appointment?",
    
    timeout: "I didn't hear a response. Are you still there?",
    general_timeout: "It seems like we lost connection. Would you like to try scheduling again?",
    
    fallback: "I'm having trouble completing your booking over the phone. Let me take down your information and someone will call you back within the hour.",
    
    booking_error: "I'm sorry, there was an issue completing your booking. Let me try that again.",
    
    message_complete: "Thank you! I've taken down your information and someone from our team will contact you within the hour to complete your booking.",
    message_error: "I apologize, but I'm experiencing technical difficulties. Please call back or visit our website to schedule.",
    
    success: `Excellent! Your ${context.service} appointment is confirmed for ${context.timeWindow}. You'll receive a confirmation message at ${context.contact}. Is there anything else I can help you with?`
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
    
    // Step 2: Generate contextual response
    const responseStartTime = Date.now();
    let responseText;
    
    // Determine current state for response generation
    const currentState = context.state || 'greeting';
    const retryCount = session.context.retryCount || 0;
    
    if (intentResult.intent === 'unclear' && retryCount > 2) {
      responseText = await generateResponse('fallback', context, retryCount);
    } else if (intentResult.confidence < 0.5) {
      responseText = await generateResponse('clarification', context, retryCount);
      session.context.retryCount = (retryCount || 0) + 1;
    } else {
      // Generate response based on current state and intent
      const stateKey = mapIntentToStateKey(intentResult.intent, currentState);
      responseText = await generateResponse(stateKey, context, retryCount);
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
    
    // Step 4: Extract booking data from entities
    const bookingData = extractBookingData(intentResult.entities, context);
    
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

// Helper function to map intents to state response keys
const mapIntentToStateKey = (intent, currentState) => {
  const mapping = {
    'booking': 'service',
    'service_provided': 'timeWindow', 
    'time_provided': 'contact',
    'contact_provided': 'confirmation',
    'confirmation_yes': 'success',
    'confirmation_no': 'service',
    'unclear': 'clarification',
    'timeout': currentState === 'greeting' ? 'general_timeout' : 'timeout'
  };
  
  return mapping[intent] || 'clarification';
};

// Helper function to extract booking data from entities
const extractBookingData = (entities, existingContext = {}) => {
  return {
    service: entities.service || existingContext.service,
    preferredTime: entities.timeWindow || existingContext.preferredTime,
    contact: entities.contact || existingContext.contact
  };
};

module.exports = {
  getCompletion,
  detectIntent,
  generateResponse,
  processMessage,
  sessionManager,
  mapIntentToStateKey,
  extractBookingData,
};