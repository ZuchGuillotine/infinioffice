
const { Deepgram } = require('@deepgram/sdk');

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

const getTranscription = async (audio) => {
  const response = await deepgram.transcriptions.create(
    { url: audio },
    {
      model: 'nova-2-phonecall',
      language: 'en-US',
      punctuate: true,
      smart_format: true,
      interim_results: true,
      vad_events: true,
      endpointing: 250,
      diarize: false,
    }
  );
  return response;
};

module.exports = {
  getTranscription,
};
