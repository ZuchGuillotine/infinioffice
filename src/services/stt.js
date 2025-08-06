
const { createClient } = require('@deepgram/sdk');
const EventEmitter = require('events');

class STTService extends EventEmitter {
  constructor() {
    super();
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.connection = null;
    this.isListening = false;
    this.silenceTimeout = null;
    this.lastSpeechTime = null;
  }

  startListening() {
    if (this.isListening) return;

    this.connection = this.deepgram.listen.live({
      model: 'nova-2-phonecall',
      language: 'en-US',
      punctuate: true,
      smart_format: true,
      interim_results: true,
      vad_events: true,
      endpointing: 300,
      diarize: false,
      filler_words: false,
    });

    this.isListening = true;

    this.connection.on('open', () => {
      console.log('STT connection opened');
      this.emit('ready');
    });

    this.connection.on('Results', (data) => {
      if (data.channel?.alternatives?.[0]) {
        const transcript = data.channel.alternatives[0].transcript.trim();
        
        if (transcript) {
          this.lastSpeechTime = Date.now();
          
          if (data.is_final) {
            this.emit('transcript', {
              text: transcript,
              isFinal: true,
              confidence: data.channel.alternatives[0].confidence
            });
            this.resetSilenceTimeout();
          } else {
            this.emit('transcript', {
              text: transcript,
              isFinal: false,
              confidence: data.channel.alternatives[0].confidence
            });
          }
        }
      }
    });

    this.connection.on('SpeechStarted', () => {
      this.emit('speechStarted');
      this.clearSilenceTimeout();
    });

    this.connection.on('UtteranceEnd', () => {
      this.emit('speechEnded');
      this.resetSilenceTimeout();
    });

    this.connection.on('error', (error) => {
      console.error('STT Error:', error);
      this.emit('error', error);
    });

    this.connection.on('close', () => {
      this.isListening = false;
      this.emit('closed');
    });

    return this.connection;
  }

  sendAudio(audioData) {
    if (this.connection && this.isListening) {
      this.connection.send(audioData);
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
      this.connection.finish();
      this.clearSilenceTimeout();
      this.isListening = false;
    }
  }

  // Legacy method for backward compatibility
  async getTranscription(audioBuffer) {
    try {
      const response = await this.deepgram.listen.prerecorded.transcribeBuffer(
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
  getTranscription: new STTService().getTranscription.bind(new STTService()),
};
