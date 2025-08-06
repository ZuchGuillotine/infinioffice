
const { createClient } = require('@deepgram/sdk');

const getSpeech = async (text) => {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  const response = await deepgram.speak.request(
    { text },
    {
      model: 'aura-asteria-en',
      encoding: 'mulaw',
      sample_rate: 8000,
    }
  );
  return response.getStream();
};

module.exports = {
  getSpeech,
};
