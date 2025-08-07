#!/usr/bin/env node

/**
 * STT Pipeline Debug Test
 * Simulates the actual voice call scenario to debug STT issues
 */

require('dotenv').config();

const { STTService } = require('./src/services/stt');
const { TTSService } = require('./src/services/tts');
const { processMessage, sessionManager } = require('./src/services/llm');

class STTPipelineDebugger {
  constructor() {
    this.sttService = new STTService();
    this.ttsService = new TTSService();
    this.sessionId = `debug_session_${Date.now()}`;
    this.transcriptCount = 0;
    this.turnCount = 0;
  }

  async debugPipeline() {
    console.log('🔍 STT Pipeline Debug Test\n');
    console.log('=' .repeat(50));

    try {
      // Step 1: Test STT connection
      console.log('\n1️⃣ Testing STT Connection...');
      await this.testSTTConnection();

      // Step 2: Test audio processing
      console.log('\n2️⃣ Testing Audio Processing...');
      await this.testAudioProcessing();

      // Step 3: Test full pipeline
      console.log('\n3️⃣ Testing Full Pipeline...');
      await this.testFullPipeline();

    } catch (error) {
      console.error('❌ Debug test failed:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }

  async testSTTConnection() {
    console.log('  • Starting STT service...');
    
    return new Promise((resolve, reject) => {
      let readyEmitted = false;
      let errorEmitted = false;
      
      const timeout = setTimeout(() => {
        if (!readyEmitted && !errorEmitted) {
          console.log('  ⚠️  STT ready event not emitted within 10 seconds');
          this.sttService.stopListening();
          resolve();
        }
      }, 10000);

      this.sttService.on('ready', () => {
        console.log('  ✅ STT service ready event emitted');
        readyEmitted = true;
        clearTimeout(timeout);
        resolve();
      });

      this.sttService.on('error', (error) => {
        console.log('  ❌ STT service error:', error.message);
        errorEmitted = true;
        clearTimeout(timeout);
        reject(error);
      });

      this.sttService.on('transcript', (data) => {
        this.transcriptCount++;
        console.log(`  📝 Transcript #${this.transcriptCount}:`, {
          text: data.text,
          isFinal: data.isFinal,
          confidence: data.confidence
        });
      });

      this.sttService.on('speechStarted', () => {
        console.log('  🎤 Speech started detected');
      });

      this.sttService.on('speechEnded', () => {
        console.log('  🔇 Speech ended detected');
      });

      this.sttService.on('silence', () => {
        console.log('  🤐 Silence detected');
      });

      // Start listening with the same config as production
      this.sttService.startListening({
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
    });
  }

  async testAudioProcessing() {
    console.log('  • Testing audio processing...');
    
    // Create a simple test audio buffer (mulaw encoded silence)
    const testAudioBuffer = Buffer.alloc(160); // 20ms of silence at 8kHz
    
    console.log(`  • Sending test audio buffer (${testAudioBuffer.length} bytes)`);
    this.sttService.sendAudio(testAudioBuffer);
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`  • Sent ${this.transcriptCount} transcripts during test`);
  }

  async testFullPipeline() {
    console.log('  • Testing full pipeline with simulated transcript...');
    
    const testTranscript = "I would like to book an appointment for tomorrow";
    console.log(`  • Simulating transcript: "${testTranscript}"`);
    
    try {
      const result = await processMessage(
        testTranscript,
        this.sessionId,
        { state: 'greeting' }
      );
      
      console.log('  ✅ LLM processing successful:', {
        intent: result.intent,
        confidence: result.confidence,
        response: result.response.substring(0, 100) + '...'
      });
      
      // Test TTS generation
      console.log('  • Testing TTS generation...');
      const audioStream = await this.ttsService.getSpeech(result.response);
      
      if (audioStream) {
        console.log('  ✅ TTS generation successful');
      }
      
    } catch (error) {
      console.log('  ❌ Pipeline processing failed:', error.message);
    }
  }
}

// Run the debug test
const pipelineDebugger = new STTPipelineDebugger();
pipelineDebugger.debugPipeline().then(() => {
  console.log('\n🏁 Debug test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Debug test failed:', error);
  process.exit(1);
}); 