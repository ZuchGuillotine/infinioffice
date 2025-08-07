#!/usr/bin/env node

/**
 * STT Pipeline Debug
 * Focuses on the actual issue: STT connected but no tokens generated
 */

require('dotenv').config();

const { STTService } = require('./src/services/stt');

class STTPipelineDebugger {
  constructor() {
    this.sttService = new STTService();
    this.transcriptCount = 0;
    this.audioChunksSent = 0;
    this.lastSpeechTime = null;
  }

  async debugSTTPipeline() {
    console.log('🔍 STT Pipeline Debug - Focused on Token Generation\n');
    console.log('=' .repeat(60));

    try {
      // Step 1: Test STT connection with detailed logging
      console.log('\n1️⃣ Testing STT Connection with Detailed Logging...');
      await this.testSTTConnection();

      // Step 2: Test audio processing with real audio simulation
      console.log('\n2️⃣ Testing Audio Processing with Speech Simulation...');
      await this.testAudioProcessing();

      // Step 3: Test VAD and turn triggering
      console.log('\n3️⃣ Testing VAD and Turn Triggering...');
      await this.testVADAndTurns();

    } catch (error) {
      console.error('❌ Debug test failed:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }

  async testSTTConnection() {
    console.log('  • Starting STT service with detailed event logging...');
    
    return new Promise((resolve, reject) => {
      let readyEmitted = false;
      let errorEmitted = false;
      let connectionOpened = false;
      
      const timeout = setTimeout(() => {
        if (!readyEmitted && !errorEmitted) {
          console.log('  ⚠️  STT ready event not emitted within 15 seconds');
          console.log('  📊 Connection state:', {
            readyEmitted,
            errorEmitted,
            connectionOpened,
            isListening: this.sttService.isListening,
            hasConnection: !!this.sttService.connection
          });
          this.sttService.stopListening();
          resolve();
        }
      }, 15000);

      // Listen for all possible events
      this.sttService.on('ready', () => {
        console.log('  ✅ STT service ready event emitted');
        readyEmitted = true;
        clearTimeout(timeout);
        resolve();
      });

      this.sttService.on('error', (error) => {
        console.log('  ❌ STT service error:', error.message);
        console.log('  📊 Error details:', {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode
        });
        errorEmitted = true;
        clearTimeout(timeout);
        reject(error);
      });

      this.sttService.on('transcript', (data) => {
        this.transcriptCount++;
        this.lastSpeechTime = Date.now();
        console.log(`  📝 Transcript #${this.transcriptCount}:`, {
          text: data.text,
          isFinal: data.isFinal,
          confidence: data.confidence,
          timestamp: new Date().toISOString()
        });
      });

      this.sttService.on('speechStarted', () => {
        console.log('  🎤 Speech started detected');
        this.lastSpeechTime = Date.now();
      });

      this.sttService.on('speechEnded', () => {
        console.log('  🔇 Speech ended detected');
        console.log('  📊 Final transcript:', this.sttService.currentTranscript);
      });

      this.sttService.on('silence', () => {
        console.log('  🤐 Silence detected');
      });

      this.sttService.on('bargeIn', () => {
        console.log('  🎯 Barge-in detected');
      });

      // Start listening with the same config as production
      const connection = this.sttService.startListening({
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
      });

      if (connection) {
        connection.on('open', () => {
          console.log('  🔗 STT connection opened successfully');
          connectionOpened = true;
        });

        connection.on('connecting', () => {
          console.log('  🔄 STT connecting...');
        });

        connection.on('warning', (warning) => {
          console.log('  ⚠️  STT warning:', warning);
        });

        connection.on('close', (data) => {
          console.log('  🔒 STT connection closed:', data);
        });
      }
    });
  }

  async testAudioProcessing() {
    console.log('  • Testing audio processing with simulated speech...');
    
    // Create audio buffers that simulate speech
    const speechPatterns = [
      Buffer.alloc(160), // 20ms of silence
      Buffer.alloc(160), // 20ms of silence
      Buffer.alloc(160), // 20ms of silence
      Buffer.alloc(160), // 20ms of silence
      Buffer.alloc(160), // 20ms of silence
    ];
    
    for (let i = 0; i < speechPatterns.length; i++) {
      const audioBuffer = speechPatterns[i];
      this.audioChunksSent++;
      
      console.log(`  📤 Sending audio chunk #${this.audioChunksSent} (${audioBuffer.length} bytes)`);
      this.sttService.sendAudio(audioBuffer);
      
      // Wait between chunks to simulate real-time audio
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Wait for processing
    console.log('  ⏳ Waiting for audio processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`  📊 Audio processing summary:`);
    console.log(`    • Audio chunks sent: ${this.audioChunksSent}`);
    console.log(`    • Transcripts received: ${this.transcriptCount}`);
    console.log(`    • Last speech time: ${this.lastSpeechTime ? new Date(this.lastSpeechTime).toISOString() : 'None'}`);
    console.log(`    • Current transcript: "${this.sttService.currentTranscript}"`);
    console.log(`    • Interim transcript: "${this.sttService.interimTranscript}"`);
  }

  async testVADAndTurns() {
    console.log('  • Testing VAD and turn triggering...');
    
    // Send more audio to trigger VAD
    console.log('  📤 Sending additional audio to test VAD...');
    
    for (let i = 0; i < 10; i++) {
      const audioBuffer = Buffer.alloc(160);
      this.audioChunksSent++;
      this.sttService.sendAudio(audioBuffer);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Wait for VAD events
    console.log('  ⏳ Waiting for VAD events...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`  📊 VAD test summary:`);
    console.log(`    • Total audio chunks sent: ${this.audioChunksSent}`);
    console.log(`    • Total transcripts received: ${this.transcriptCount}`);
    console.log(`    • STT service state:`, this.sttService.getTranscriptionState());
  }
}

// Run the debug test
const pipelineDebugger = new STTPipelineDebugger();
pipelineDebugger.debugSTTPipeline().then(() => {
  console.log('\n🏁 STT pipeline debug completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 STT pipeline debug failed:', error);
  process.exit(1);
}); 