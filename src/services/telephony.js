
const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = twilio(accountSid, authToken);

const handleIncomingCall = (req, res) => {
  const voiceResponse = new VoiceResponse();

  const connect = voiceResponse.connect();
  connect.stream({
    url: `wss://${req.headers.host}/`,
  });

  res.type('text/xml');
  res.send(voiceResponse.toString());
};

module.exports = {
  handleIncomingCall,
};
