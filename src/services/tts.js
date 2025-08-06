
const { createClient } = require('@deepgram/sdk');
const EventEmitter = require('events');

class TTSService extends EventEmitter {
  constructor() {
    super();
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.isStreaming = false;
    this.currentStream = null;
  }

  async getSpeech(text, options = {}) {
    const config = {
      model: 'aura-asteria-en',
      encoding: 'mulaw',
      sample_rate: 8000,
      container: 'none',
      ...options
    };

    try {
      console.log('Generating TTS for text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      const startTime = Date.now();
      const response = await this.deepgram.speak.request(
        { text },
        config
      );

      const stream = response.getStream();
      if (!stream) {
        throw new Error('Failed to get audio stream from Deepgram TTS');
      }

      const ttsLatency = Date.now() - startTime;
      console.log(`TTS generation latency: ${ttsLatency}ms`);

      this.currentStream = stream;
      this.isStreaming = true;

      // Emit TTS started event
      this.emit('ttsStarted', { 
        text, 
        latency: ttsLatency,
        timestamp: Date.now()
      });

      return stream;
    } catch (error) {
      console.error('TTS Error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async streamTTSToTwilio(audioStream, twilioWs, options = {}) {
    return new Promise((resolve, reject) => {
      if (!audioStream) {
        return reject(new Error('No audio stream provided'));
      }

      const chunks = [];
      let totalBytes = 0;
      const startTime = Date.now();
      const streamId = options.streamId || twilioWs.streamSid || 'unknown';

      console.log('Starting TTS stream to Twilio, streamSid:', streamId);

      // Track streaming state
      this.isStreaming = true;

      audioStream.on('data', (chunk) => {
        try {
          chunks.push(chunk);
          totalBytes += chunk.length;
          
          // Send audio chunks to Twilio in base64 format
          const base64Audio = chunk.toString('base64');
          const mediaMessage = {
            event: 'media',
            streamSid: streamId,
            media: {
              payload: base64Audio
            }
          };
          
          if (twilioWs.readyState === 1) { // WebSocket.OPEN
            twilioWs.send(JSON.stringify(mediaMessage));
          } else {
            console.warn('Twilio WebSocket not ready, state:', twilioWs.readyState);
          }

          // Emit streaming progress
          this.emit('streamProgress', {
            bytesStreamed: totalBytes,
            timestamp: Date.now()
          });

        } catch (error) {
          console.error('Error streaming audio chunk:', error);
          this.emit('streamError', error);
        }
      });

      audioStream.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`TTS streaming completed: ${totalBytes} bytes in ${duration}ms`);
        
        this.isStreaming = false;
        this.currentStream = null;

        this.emit('ttsCompleted', {
          totalBytes,
          duration,
          timestamp: Date.now()
        });

        resolve(Buffer.concat(chunks));
      });

      audioStream.on('error', (error) => {
        console.error('TTS Stream error:', error);
        this.isStreaming = false;
        this.currentStream = null;
        this.emit('streamError', error);
        reject(error);
      });

      // Handle stream interruption (barge-in)
      this.once('interrupt', () => {
        console.log('TTS stream interrupted (barge-in detected)');
        if (audioStream && typeof audioStream.destroy === 'function') {
          audioStream.destroy();
        }
        this.isStreaming = false;
        this.currentStream = null;
        resolve(Buffer.concat(chunks));
      });
    });
  }

  // Interrupt current TTS stream (for barge-in scenarios)
  interruptStream() {
    if (this.isStreaming && this.currentStream) {
      console.log('Interrupting TTS stream');
      this.emit('interrupt');
      return true;
    }
    return false;
  }

  // Get current TTS state
  getTTSState() {
    return {
      isStreaming: this.isStreaming,
      hasCurrentStream: !!this.currentStream
    };
  }

  // Enhanced method that combines speech generation and streaming
  async generateAndStream(text, twilioWs, options = {}) {
    try {
      const startTime = Date.now();
      
      // Step 1: Generate speech
      const audioStream = await this.getSpeech(text, options.ttsConfig);
      const generationTime = Date.now() - startTime;

      // Step 2: Stream to Twilio
      const streamStartTime = Date.now();
      const audioBuffer = await this.streamTTSToTwilio(audioStream, twilioWs, options);
      const streamingTime = Date.now() - streamStartTime;

      const totalTime = Date.now() - startTime;

      return {
        audioBuffer,
        metrics: {
          generationTime,
          streamingTime,
          totalTime,
          audioSize: audioBuffer.length
        }
      };

    } catch (error) {
      console.error('Error in generateAndStream:', error);
      throw error;
    }
  }
}

// Legacy function for backward compatibility
const getSpeech = async (text, options = {}) => {
  const ttsService = new TTSService();
  return ttsService.getSpeech(text, options);
};

// Legacy function for backward compatibility
const streamTTSToTwilio = (audioStream, twilioWs) => {
  const ttsService = new TTSService();
  return ttsService.streamTTSToTwilio(audioStream, twilioWs);
};

module.exports = {
  TTSService,
  getSpeech,
  streamTTSToTwilio,
};
