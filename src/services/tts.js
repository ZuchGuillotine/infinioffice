
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

const getSpeech = async (text) => {
  const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
  const params = {
    OutputFormat: 'pcm',
    SampleRate: '8000',
    Text: text,
    TextType: 'ssml',
    VoiceId: 'Joanna',
    Engine: 'neural',
  };

  const command = new SynthesizeSpeechCommand(params);
  const response = await pollyClient.send(command);
  return response.AudioStream;
};

module.exports = {
  getSpeech,
};
