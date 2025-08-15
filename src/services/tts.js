
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
      model: options.model || 'aura-asteria-en',
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

      // Extract audio buffer from the response
      if (!response) {
        throw new Error('Failed to get response from Deepgram TTS');
      }

      let audioBuffer;
      let usedMethod;
      
      // For newer Deepgram SDK v4+, the response should have a getStream() method
      if (response.getStream && typeof response.getStream === 'function') {
        // Method 1: Use getStream() method - it returns a Promise that resolves to a ReadableStream
        try {
          const audioStream = await response.getStream();
          
          // Handle Web Streams API ReadableStream
          if (audioStream && typeof audioStream.getReader === 'function') {
            const reader = audioStream.getReader();
            const chunks = [];
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            
            audioBuffer = Buffer.concat(chunks);
            usedMethod = 'getStream() ReadableStream';
          } else {
            throw new Error('Stream is not a ReadableStream');
          }
        } catch (streamError) {
          console.log('getStream() failed, trying alternative method:', streamError.message);
          // Fall through to other methods
        }
      }
      
      if (!audioBuffer && response.result && response.result instanceof ArrayBuffer) {
        // Method 2: Handle ArrayBuffer result
        audioBuffer = Buffer.from(response.result);
        usedMethod = 'response.result (ArrayBuffer)';
      } else if (!audioBuffer && response.result && response.result instanceof Uint8Array) {
        // Method 3: Handle Uint8Array result
        audioBuffer = Buffer.from(response.result);
        usedMethod = 'response.result (Uint8Array)';
      } else if (!audioBuffer && response.result && Buffer.isBuffer(response.result)) {
        // Method 4: Handle Buffer result
        audioBuffer = response.result;
        usedMethod = 'response.result (Buffer)';
      } else if (!audioBuffer && Buffer.isBuffer(response)) {
        // Method 5: Treat response as buffer directly
        audioBuffer = response;
        usedMethod = 'response direct (buffer)';
      } else if (!audioBuffer && response instanceof Uint8Array) {
        // Method 6: Handle Uint8Array response
        audioBuffer = Buffer.from(response);
        usedMethod = 'response direct (Uint8Array)';
      } else if (!audioBuffer && response instanceof ArrayBuffer) {
        // Method 7: Handle ArrayBuffer response
        audioBuffer = Buffer.from(response);
        usedMethod = 'response direct (ArrayBuffer)';
      } else if (!audioBuffer) {
        // Log the actual response structure for debugging
        console.error('Unexpected response structure:', {
          responseType: typeof response,
          responseKeys: response && typeof response === 'object' ? Object.keys(response) : 'not object',
          hasResult: !!response.result,
          resultType: response.result ? typeof response.result : 'none'
        });
        throw new Error(`Unable to extract audio data from response. Response type: ${typeof response}, keys: ${response && typeof response === 'object' ? Object.keys(response).join(', ') : 'none'}`);
      }

      if (!audioBuffer) {
        throw new Error('Failed to get audio data from Deepgram TTS response');
      }

      const ttsLatency = Date.now() - startTime;
      console.log(`TTS generation completed using method: ${usedMethod}`);
      console.log(`TTS generation latency: ${ttsLatency}ms, audio buffer size: ${audioBuffer.length} bytes`);

      // Convert buffer to readable stream for compatibility with existing streaming code
      const { Readable } = require('stream');
      const audioStream = new Readable({
        read() {}
      });
      
      // Push the entire buffer as a single chunk
      audioStream.push(audioBuffer);
      audioStream.push(null); // End the stream

      this.currentStream = audioStream;
      this.isStreaming = true;

      // Emit TTS started event
      this.emit('ttsStarted', { 
        text, 
        latency: ttsLatency,
        audioSize: audioBuffer.length,
        timestamp: Date.now()
      });

      return audioStream;
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
