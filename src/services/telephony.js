
const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;

// Temporary store for call information (in production, use Redis)
const callStore = new Map();

const handleIncomingCall = (req, res) => {
  console.log('🚨 WEBHOOK CALLED - handleIncomingCall starting');
  console.log('📋 Request body:', req.body);
  console.log('📋 Request headers:', req.headers);
  
  const voiceResponse = new VoiceResponse();

  // Extract organization info from the call
  const toNumber = req.body.To; // Twilio number that was called
  const fromNumber = req.body.From; // Caller's number
  const callSid = req.body.CallSid;

  console.log('📞 Incoming call:', {
    to: toNumber,
    from: fromNumber,
    callSid: callSid
  });

  // Start immediate streaming connection without initial TTS
  // The greeting will be handled via Deepgram TTS through the WebSocket
  const connect = voiceResponse.connect();
  
  // Use the original host from the request or ngrok forwarded host
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  
  // Build WebSocket URL (without query parameters - Twilio handles this differently)
  const wsUrl = `wss://${host}`;
  
  console.log('🔗 Generated WebSocket URL:', wsUrl);
  console.log('📋 Call parameters to store:', {
    host: host,
    to: toNumber,
    from: fromNumber,
    callSid: callSid
  });
  
  // Store call information for WebSocket to retrieve
  callStore.set(callSid, {
    to: toNumber,
    from: fromNumber,
    callSid: callSid,
    timestamp: Date.now()
  });
  
  // Pass call information via Stream custom parameters (not query params)
  // Twilio will send these in the 'start' event data
  const stream = connect.stream({ url: wsUrl });
  stream.parameter({ name: 'to', value: toNumber });
  stream.parameter({ name: 'from', value: fromNumber });
  stream.parameter({ name: 'callSid', value: callSid });

  const twimlResponse = voiceResponse.toString();
  console.log('📤 Sending TwiML response to Twilio:', twimlResponse);
  
  res.type('text/xml');
  res.send(twimlResponse);
};

const validateTwilioRequest = (req) => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  
  if (!authToken) {
    console.warn('TWILIO_AUTH_TOKEN not set - skipping validation');
    return true;
  }
  
  return twilio.validateRequest(authToken, signature, url, req.body);
};

const createOutboundCall = async (toNumber, fromNumber, webhookUrl) => {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  try {
    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: webhookUrl,
      method: 'POST',
    });
    
    return call;
  } catch (error) {
    console.error('Outbound call error:', error);
    throw error;
  }
};

module.exports = {
  handleIncomingCall,
  validateTwilioRequest,
  createOutboundCall,
  callStore, // Export for WebSocket handler to access
};
