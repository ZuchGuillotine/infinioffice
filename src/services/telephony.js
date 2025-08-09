
const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;

const handleIncomingCall = (req, res) => {
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
  
  // Pass call information to the WebSocket handler via query parameters
  connect.stream({
    url: `wss://${host}?to=${encodeURIComponent(toNumber)}&from=${encodeURIComponent(fromNumber)}&callSid=${encodeURIComponent(callSid)}`,
  });

  res.type('text/xml');
  res.send(voiceResponse.toString());
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
};
