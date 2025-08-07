
const { createClient } = require('@deepgram/sdk');
const EventEmitter = require('events');

class STTService extends EventEmitter {
  constructor() {
    super();
    
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }
    
    console.log('Initializing Deepgram client with API key:', 
      process.env.DEEPGRAM_API_KEY ? 'PRESENT' : 'MISSING');
    
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.connection = null;
    this.isListening = false;
    this.silenceTimeout = null;
    this.lastSpeechTime = null;
    this.bargeInDetected = false;
    this.currentTranscript = '';
    this.interimTranscript = '';
  }

  startListening(options = {}) {
    if (this.isListening) return;

    const config = {
      model: 'nova-2-phonecall',
      language: 'en-US',
      punctuate: true,
      smart_format: true,
      interim_results: true,
      encoding: 'mulaw',
      sample_rate: 8000,
      channels: 1,
      diarize: false,
      filler_words: false,
      vad_events: true,
      ...options
    };

    console.log('Attempting to connect to Deepgram with config:', config);
    this.connection = this.deepgram.listen.live(config);
    this.isListening = true;
    this.bargeInDetected = false;
    this.currentTranscript = '';
    this.interimTranscript = '';

    this.connection.on('open', () => {
      console.log('STT connection opened successfully with config:', config);
      this.emit('ready');
    });

    this.connection.on('connecting', () => {
      console.log('STT connecting to Deepgram...');
    });

    this.connection.on('Results', (data) => {
      if (data.channel?.alternatives?.[0]) {
        const transcript = data.channel.alternatives[0].transcript.trim();
        const confidence = data.channel.alternatives[0].confidence;
        
        if (transcript) {
          this.lastSpeechTime = Date.now();
          
          if (data.is_final) {
            this.currentTranscript = transcript;
            this.interimTranscript = '';
            
            this.emit('transcript', {
              text: transcript,
              isFinal: true,
              confidence,
              timestamp: Date.now()
            });
            
            // Reset barge-in detection after final transcript
            this.bargeInDetected = false;
            this.resetSilenceTimeout();
          } else {
            this.interimTranscript = transcript;
            
            this.emit('transcript', {
              text: transcript,
              isFinal: false,
              confidence,
              timestamp: Date.now()
            });
          }
        }
      }
    });

    this.connection.on('SpeechStarted', (data) => {
      console.log('Speech started detected');
      this.emit('speechStarted', { timestamp: Date.now() });
      this.clearSilenceTimeout();
      
      // Detect potential barge-in during TTS playback
      this.bargeInDetected = true;
      this.emit('bargeIn', { timestamp: Date.now() });
    });

    this.connection.on('UtteranceEnd', (data) => {
      console.log('Speech ended detected');
      this.emit('speechEnded', { 
        timestamp: Date.now(),
        finalTranscript: this.currentTranscript 
      });
      this.resetSilenceTimeout();
    });

    this.connection.on('error', (error) => {
      console.error('STT Error details:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        response: error.response,
        stack: error.stack
      });
      this.isListening = false;
      this.emit('error', error);
      
      // Attempt reconnection on certain errors
      if (this.shouldReconnect(error)) {
        console.log('Scheduling STT reconnection...');
        setTimeout(() => this.reconnect(), 2000);
      }
    });

    this.connection.on('close', (data) => {
      console.log('STT connection closed:', data);
      this.isListening = false;
      this.emit('closed', data);
    });

    return this.connection;
  }

  // Check if we should attempt reconnection
  shouldReconnect(error) {
    const reconnectableErrors = [
      'WebSocket connection closed',
      'Connection timeout',
      'Network error'
    ];
    
    return reconnectableErrors.some(errorType => 
      error.message && error.message.includes(errorType)
    );
  }

  // Reconnect to Deepgram
  async reconnect() {
    if (this.isListening) return;
    
    console.log('Attempting STT reconnection...');
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
      this.startListening();
    } catch (error) {
      console.error('STT reconnection failed:', error);
      this.emit('reconnectFailed', error);
    }
  }

  sendAudio(audioData) {
    if (this.connection && this.isListening) {
      console.log(`STT: Sending ${audioData.length} bytes to Deepgram`);
      this.connection.send(audioData);
    } else {
      console.log(`STT: Cannot send audio - connection: ${!!this.connection}, listening: ${this.isListening}`);
    }
  }

  resetSilenceTimeout() {
    this.clearSilenceTimeout();
    this.silenceTimeout = setTimeout(() => {
      this.emit('silence');
    }, 3000); // 3 second silence timeout
  }

  clearSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  stopListening() {
    if (this.connection && this.isListening) {
      console.log('Stopping STT listening');
      this.connection.finish();
      this.clearSilenceTimeout();
      this.isListening = false;
      this.bargeInDetected = false;
      this.currentTranscript = '';
      this.interimTranscript = '';
    }
  }

  // Get current transcription state
  getTranscriptionState() {
    return {
      isListening: this.isListening,
      currentTranscript: this.currentTranscript,
      interimTranscript: this.interimTranscript,
      bargeInDetected: this.bargeInDetected,
      lastSpeechTime: this.lastSpeechTime
    };
  }

  // Reset barge-in detection (called when TTS starts playing)
  resetBargeInDetection() {
    this.bargeInDetected = false;
  }

  // Legacy method for backward compatibility
  async getTranscription(audioBuffer) {
    try {
      // For Deepgram SDK v4, we need to use the correct API
      const response = await this.deepgram.listen.prerecorded.transcribeBuffer(
        audioBuffer,
        {
          model: 'nova-3-phonecall',
          language: 'en-US',
          punctuate: true,
          smart_format: true,
        }
      );

      return response.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    } catch (error) {
      console.error('STT Error:', error);
      throw error;
    }
  }
}

module.exports = {
  STTService,
  getTranscription: new STTService().getTranscription.bind(new STTService()),
};
