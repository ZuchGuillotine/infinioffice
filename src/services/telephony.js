
const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;

const handleIncomingCall = (req, res) => {
  const voiceResponse = new VoiceResponse();

  voiceResponse.say(
    {
      voice: 'Polly.Joanna-Neural',
    },
    'Hello! How can I help you today?'
  );

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
