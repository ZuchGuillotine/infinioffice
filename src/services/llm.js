const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      ...result,
      rawText: transcript
    };
  } catch (error) {
    console.error('Intent detection error:', error);
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
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-0125',
    messages: [{ role: 'system', content: 'You are a scheduling agent. Be concise and directive. Goal: complete booking/reschedule/cancel with minimal words. No chit-chat. Offer at most top 2–3 options. Avoid long explanations.' }, { role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 120,
    presence_penalty: 0,
    frequency_penalty: 0,
  });
  return response.choices[0].message.content;
};

module.exports = {
  getCompletion,
  detectIntent,
  generateResponse,
};