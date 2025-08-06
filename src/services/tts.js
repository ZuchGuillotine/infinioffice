
const { createClient } = require('@deepgram/sdk');

const getSpeech = async (text) => {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  
  try {
    const response = await deepgram.speak.request(
      { text },
      {
        model: 'aura-asteria-en',
        encoding: 'mulaw',
        sample_rate: 8000,
        container: 'none',
      }
    );

    const stream = response.getStream();
    if (!stream) {
      throw new Error('Failed to get audio stream from Deepgram');
    }

    return stream;
  } catch (error) {
    console.error('TTS Error:', error);
    throw error;
  }
};

const streamTTSToTwilio = (audioStream, twilioWs) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    audioStream.on('data', (chunk) => {
      chunks.push(chunk);
      
      // Send audio chunks to Twilio in base64 format
      const base64Audio = chunk.toString('base64');
      const mediaMessage = {
        event: 'media',
        streamSid: twilioWs.streamSid,
        media: {
          payload: base64Audio
        }
      };
      
      twilioWs.send(JSON.stringify(mediaMessage));
    });

    audioStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    audioStream.on('error', (error) => {
      reject(error);
    });
  });
};

module.exports = {
  getSpeech,
  streamTTSToTwilio,
};
