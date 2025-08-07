#!/usr/bin/env node

/**
 * STT Simulation Test
 * Simulates actual speech transcripts to verify the pipeline works
 */

require('dotenv').config();

const { STTService } = require('./src/services/stt');
const { processMessage, sessionManager } = require('./src/services/llm');

class STTSimulationTester {
  constructor() {
    this.sttService = new STTService();
    this.sessionId = `simulation_${Date.now()}`;
    this.transcriptCount = 0;
    this.turnCount = 0;
  }

  async testSTTSimulation() {
    console.log('🔍 STT Pipeline Simulation Test\n');
    console.log('=' .repeat(60));

    try {
      // Step 1: Test STT connection
      console.log('\n1️⃣ Testing STT Connection...');
      await this.testSTTConnection();

      // Step 2: Simulate speech transcripts
      console.log('\n2️⃣ Simulating Speech Transcripts...');
      await this.simulateSpeechTranscripts();

      // Step 3: Test full pipeline
      console.log('\n3️⃣ Testing Full Pipeline...');
      await this.testFullPipeline();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }

  async testSTTConnection() {
    console.log('  • Starting STT service...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('  ⚠️  STT ready event not emitted within 5 seconds');
        resolve();
      }, 5000);

      this.sttService.on('ready', () => {
        console.log('  ✅ STT service ready');
        clearTimeout(timeout);
        resolve();
      });

      this.sttService.on('error', (error) => {
        console.log('  ❌ STT service error:', error.message);
        clearTimeout(timeout);
        resolve();
      });

      // Start listening
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

  async simulateSpeechTranscripts() {
    console.log('  • Simulating speech transcripts...');
    
    // Simulate interim transcript
    console.log('  📝 Simulating interim transcript...');
    this.sttService.emit('transcript', {
      text: 'I would like to',
      isFinal: false,
      confidence: 0.8,
      timestamp: Date.now()
    });

    // Simulate final transcript
    console.log('  📝 Simulating final transcript...');
    this.sttService.emit('transcript', {
      text: 'I would like to book an appointment for tomorrow',
      isFinal: true,
      confidence: 0.9,
      timestamp: Date.now()
    });

    // Simulate speech ended
    console.log('  🔇 Simulating speech ended...');
    this.sttService.emit('speechEnded', {
      timestamp: Date.now(),
      finalTranscript: 'I would like to book an appointment for tomorrow'
    });

    console.log('  ✅ Speech simulation completed');
  }

  async testFullPipeline() {
    console.log('  • Testing full pipeline with simulated transcript...');
    
    const testTranscript = "I would like to book an appointment for tomorrow";
    console.log(`  📝 Processing transcript: "${testTranscript}"`);
    
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
      
      console.log('  🎉 Full pipeline test successful!');
      
    } catch (error) {
      console.log('  ❌ Pipeline processing failed:', error.message);
    }
  }
}

// Run the simulation test
const tester = new STTSimulationTester();
tester.testSTTSimulation().then(() => {
  console.log('\n🏁 Simulation test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Simulation test failed:', error);
  process.exit(1);
}); 