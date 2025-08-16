/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 07/08/2025 - 03:15:31
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 07/08/2025
    * - Author          : 
    * - Modification    : 
**/

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
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
    this._readyEmitted = false;
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
    
    try {
      this.connection = this.deepgram.listen.live(config);
      this.isListening = true;
      this.bargeInDetected = false;
      this.currentTranscript = '';
      this.interimTranscript = '';
      this._readyEmitted = false;
    } catch (error) {
      console.error('Failed to create Deepgram connection:', error);
      this.isListening = false;
      this.emit('error', error);
      return null;
    }

    this.connection.on('open', () => {
      console.log('STT connection opened successfully with config:', config);
      this.emit('ready');
      // Flush any queued audio data
      this.flushAudioQueue();
    });

    this.connection.on('warning', (warning) => {
      console.warn('STT Warning:', warning);
    });

    this.connection.on('connecting', () => {
      console.log('STT connecting to Deepgram...');
    });

    this.connection.on(LiveTranscriptionEvents.Close, (data) => {
      console.log('STT Connection closed:', data);
      this.isListening = false;
      this.connection = null;
      this.emit('closed', data);
    });

    // Add a timeout to check if connection opens
    setTimeout(() => {
      if (!this._readyEmitted && (!this.connection || this.connection.readyState !== 1)) {
        console.log('STT connection not ready after 3 seconds, emitting ready as a fallback.');
        this._readyEmitted = true;
        this.emit('ready');
        // Try to flush any queued audio data
        this.flushAudioQueue();
      }
    }, 3000);

    // Also emit ready when the connection state changes to OPEN
    if (this.connection) {
      this.connection.on('open', () => {
        console.log('STT connection opened successfully');
        if (!this._readyEmitted) {
          this._readyEmitted = true;
          this.emit('ready');
        }
        // Flush any queued audio data
        this.flushAudioQueue();
      });
    }

    // Unified handler to process transcript events for Deepgram v4 SDK
    const handleTranscriptEvent = (data) => {
      if (!data) return;
      
      console.log('STT: Received transcript event:', {
        type: data.type,
        is_final: data.is_final,
        speech_final: data.speech_final,
        hasChannel: !!data.channel,
        hasAlternatives: !!(data.channel && data.channel.alternatives)
      });
      
      // Handle v4 SDK Results events
      if (data.type === 'Results' && data.channel && data.channel.alternatives) {
        const alt = data.channel.alternatives[0];
        if (!alt) return;
        
        const transcript = (alt.transcript || '').trim();
        const confidence = alt.confidence || 0;

        console.log('STT: Processing transcript:', {
          transcript,
          confidence,
          is_final: data.is_final,
          speech_final: data.speech_final
        });

        // Only emit if there's actual transcript content
        if (transcript) {
          this.lastSpeechTime = Date.now();

          // Deepgram v4 uses is_final and speech_final
          const isFinal = data.is_final === true;
          const isSpeechFinal = data.speech_final === true;

          if (isFinal || isSpeechFinal) {
            this.currentTranscript = transcript;
            this.interimTranscript = '';

            console.log('STT: Emitting final transcript:', transcript);

            this.emit('transcript', {
              text: transcript,
              isFinal: true,
              confidence,
              timestamp: Date.now(),
            });

            // Reset barge-in detection after a final transcript
            this.bargeInDetected = false;
            // Don't reset silence timeout here - let index.js handle it
            
            // Emit speech ended event for speech_final
            if (isSpeechFinal) {
              console.log('STT: Speech final detected, emitting speechEnded');
              this.emit('speechEnded', { 
                timestamp: Date.now(),
                finalTranscript: this.currentTranscript 
              });
            }
          } else {
            this.interimTranscript = transcript;

            console.log('STT: Emitting interim transcript:', transcript);

            this.emit('transcript', {
              text: transcript,
              isFinal: false,
              confidence,
              timestamp: Date.now(),
            });
          }
        }
      }
    };

    // Listen for the specific events that Deepgram v4 SDK emits
    this.connection.on('Results', handleTranscriptEvent);

    // Handle VAD events for Deepgram v4 SDK
    this.connection.on('SpeechStarted', (data) => {
      console.log('STT: Speech started detected');
      this.emit('speechStarted', { timestamp: Date.now() });
      this.clearSilenceTimeout();
      
      // Detect potential barge-in during TTS playback
      this.bargeInDetected = true;
      this.emit('bargeIn', { timestamp: Date.now() });
    });

    this.connection.on('UtteranceEnd', (data) => {
      console.log('STT: Speech ended detected');
      this.emit('speechEnded', { 
        timestamp: Date.now(),
        finalTranscript: this.currentTranscript 
      });
      // Don't reset silence timeout here - let index.js handle it
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
      this.connection = null;
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
      this.connection = null;
      this.emit('closed', data);
    });

    return this.connection;
  }

  // Check if we should attempt reconnection
  shouldReconnect(error) {
    const reconnectableErrors = [
      'WebSocket connection closed',
      'Connection timeout',
      'Network error',
      'Unexpected server response: 400'
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
    if (this.connection && this.isListening && this.connection.readyState === 1) {
      // console.log(`STT: Sending ${audioData.length} bytes to Deepgram`);
      this.connection.send(audioData);
      
      // If this is the first successful audio send and we haven't emitted ready yet, emit it
      if (!this._readyEmitted) {
        console.log('STT: First successful audio send - emitting ready event');
        this._readyEmitted = true;
        this.emit('ready');
      }
    } else {
      // Queue audio data if connection isn't ready yet
      if (!this.audioQueue) {
        this.audioQueue = [];
      }
      
      if (this.audioQueue.length < 100) { // Limit queue size to prevent memory issues
        this.audioQueue.push(audioData);
        console.log(`STT: Queued audio data (${this.audioQueue.length} chunks) - waiting for connection`);
      }
    }
  }

  flushAudioQueue() {
    if (this.audioQueue && this.audioQueue.length > 0 && this.connection && this.isListening && this.connection.readyState === 1) {
      console.log(`STT: Flushing ${this.audioQueue.length} queued audio chunks`);
      while (this.audioQueue.length > 0) {
        const audioData = this.audioQueue.shift();
        this.connection.send(audioData);
      }
      console.log('STT: Audio queue flushed successfully');
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
      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2-phonecall',
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
  getTranscription: async (audioBuffer) => {
    const sttService = new STTService();
    return await sttService.getTranscription(audioBuffer);
  },
};
