
const { Deepgram } = require('@deepgram/sdk');

const getTranscription = async (stream) => {
  const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
  const deepgramSocket = deepgram.transcription.live({
    model: 'nova-2-phonecall',
    language: 'en-US',
    punctuate: true,
    smart_format: true,
    interim_results: true,
    vad_events: true,
    endpointing: 250,
    diarize: false,
  });

  deepgramSocket.on('open', () => {
    stream.on('data', (chunk) => {
      deepgramSocket.send(chunk);
    });
  });

  return new Promise((resolve, reject) => {
    deepgramSocket.on('message', (message) => {
      const data = JSON.parse(message);
      if (data.is_final) {
        resolve(data.channel.alternatives[0].transcript);
      }
    });

    deepgramSocket.on('error', (error) => {
      reject(error);
    });
  });
};

module.exports = {
  getTranscription,
};
