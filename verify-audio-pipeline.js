#!/usr/bin/env node

/**
 * Audio Pipeline Verification Script
 * Tests the InfiniOffice audio pipeline components
 */

const { STTService } = require('./src/services/stt');
const { TTSService } = require('./src/services/tts');
const { processMessage, sessionManager } = require('./src/services/llm');
const { performanceMonitor } = require('./src/services/performance');

// Load environment variables
require('dotenv').config();

class AudioPipelineVerifier {
  constructor() {
    this.sttService = new STTService();
    this.ttsService = new TTSService();
    this.results = {
      deepgramConfig: false,
      openaiConfig: false,
      sttInitialization: false,
      ttsGeneration: false,
      llmProcessing: false,
      performanceMonitoring: false,
      overallHealth: false
    };
  }

  async verify() {
    console.log('🔍 InfiniOffice Audio Pipeline Verification\n');
    console.log('=' .repeat(50));

    try {
      await this.checkConfiguration();
      await this.testSTTService();
      await this.testTTSService();
      await this.testLLMService();
      await this.testPerformanceMonitoring();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      process.exit(1);
    }
  }

  async checkConfiguration() {
    console.log('\n📋 Checking Configuration...');
    
    // Check Deepgram API Key
    if (process.env.DEEPGRAM_API_KEY) {
      console.log('✅ Deepgram API key configured');
      this.results.deepgramConfig = true;
    } else {
      console.log('❌ Deepgram API key missing (DEEPGRAM_API_KEY)');
    }

    // Check OpenAI API Key
    if (process.env.OPENAI_API_KEY) {
      console.log('✅ OpenAI API key configured');
      this.results.openaiConfig = true;
    } else {
      console.log('❌ OpenAI API key missing (OPENAI_API_KEY)');
    }

    // Check Database URL
    if (process.env.DATABASE_URL) {
      console.log('✅ Database URL configured');
    } else {
      console.log('⚠️  Database URL missing (DATABASE_URL) - using fallback mode');
    }
  }

  async testSTTService() {
    console.log('\n🎤 Testing STT Service...');
    
    try {
      // Test service initialization
      console.log('  • Initializing STT service...');
      const state = this.sttService.getTranscriptionState();
      console.log(`  • STT service state: ${JSON.stringify(state)}`);
      this.results.sttInitialization = true;
      console.log('✅ STT service initialized successfully');
      
    } catch (error) {
      console.log('❌ STT service initialization failed:', error.message);
    }
  }

  async testTTSService() {
    console.log('\n🔊 Testing TTS Service...');
    
    if (!process.env.DEEPGRAM_API_KEY) {
      console.log('⏭️  Skipping TTS test - no Deepgram API key');
      return;
    }

    try {
      console.log('  • Generating test speech...');
      const testText = "Hello, this is a test of the InfiniOffice TTS service.";
      
      // Test TTS generation (but don't actually stream)
      const startTime = Date.now();
      const audioStream = await this.ttsService.getSpeech(testText);
      const generationTime = Date.now() - startTime;
      
      if (audioStream) {
        console.log(`✅ TTS generation successful (${generationTime}ms)`);
        this.results.ttsGeneration = true;
        
        // Clean up stream
        if (audioStream.destroy) {
          audioStream.destroy();
        }
      }
      
    } catch (error) {
      console.log('❌ TTS generation failed:', error.message);
    }
  }

  async testLLMService() {
    console.log('\n🧠 Testing LLM Service...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('⏭️  Skipping LLM test - no OpenAI API key');
      return;
    }

    try {
      console.log('  • Testing intent detection and response generation...');
      const testTranscript = "I would like to book an appointment for tomorrow";
      const sessionId = 'test_session_' + Date.now();
      
      const startTime = Date.now();
      const result = await processMessage(
        testTranscript,
        sessionId,
        { state: 'greeting' },
        null, // no callId for test
        0     // turnIndex 0
      );
      const processingTime = Date.now() - startTime;
      
      if (result && result.intent && result.response) {
        console.log(`  • Intent detected: ${result.intent} (confidence: ${result.confidence})`);
        console.log(`  • Response generated: "${result.response.substring(0, 100)}..."`);
        console.log(`  • Processing time: ${processingTime}ms`);
        console.log('✅ LLM processing successful');
        this.results.llmProcessing = true;
        
        // Clean up session
        sessionManager.clearSession(sessionId);
      }
      
    } catch (error) {
      console.log('❌ LLM processing failed:', error.message);
    }
  }

  async testPerformanceMonitoring() {
    console.log('\n📊 Testing Performance Monitoring...');
    
    try {
      console.log('  • Testing performance monitor...');
      
      const testTurnId = 'test_turn_' + Date.now();
      const testCallId = 'test_call_' + Date.now();
      
      // Start monitoring
      performanceMonitor.startTurn(testTurnId, testCallId);
      
      // Simulate some processing
      await new Promise(resolve => setTimeout(resolve, 100));
      performanceMonitor.recordPhase(testTurnId, 'test_phase', Date.now() - 100);
      
      // Get metrics
      const metrics = performanceMonitor.getTurnMetrics(testTurnId);
      const stats = performanceMonitor.getPerformanceStats();
      
      if (metrics && stats) {
        console.log('  • Performance metrics captured successfully');
        console.log(`  • Active turns: ${stats.activeTurns}`);
        console.log('✅ Performance monitoring working');
        this.results.performanceMonitoring = true;
      }
      
    } catch (error) {
      console.log('❌ Performance monitoring failed:', error.message);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📈 VERIFICATION REPORT');
    console.log('='.repeat(50));
    
    const passCount = Object.values(this.results).filter(Boolean).length;
    const totalCount = Object.keys(this.results).length - 1; // Exclude overallHealth
    
    console.log('\nComponent Status:');
    console.log(`• Deepgram Configuration: ${this.results.deepgramConfig ? '✅' : '❌'}`);
    console.log(`• OpenAI Configuration: ${this.results.openaiConfig ? '✅' : '❌'}`);
    console.log(`• STT Service: ${this.results.sttInitialization ? '✅' : '❌'}`);
    console.log(`• TTS Service: ${this.results.ttsGeneration ? '✅' : '❌'}`);
    console.log(`• LLM Processing: ${this.results.llmProcessing ? '✅' : '❌'}`);
    console.log(`• Performance Monitoring: ${this.results.performanceMonitoring ? '✅' : '❌'}`);
    
    this.results.overallHealth = passCount >= (totalCount * 0.8); // 80% pass rate
    
    console.log(`\nOverall Health: ${this.results.overallHealth ? '✅ GOOD' : '❌ NEEDS ATTENTION'}`);
    console.log(`Score: ${passCount}/${totalCount} components passing\n`);
    
    if (this.results.overallHealth) {
      console.log('🎉 Audio pipeline is ready for deployment!');
      console.log('\nNext steps:');
      console.log('1. Start the server: node src/index.js');
      console.log('2. Expose with ngrok: ngrok http 3000');
      console.log('3. Configure Twilio webhook with ngrok URL');
    } else {
      console.log('⚠️  Some components need attention before deployment.');
      console.log('\nPlease check:');
      if (!this.results.deepgramConfig) console.log('- Set DEEPGRAM_API_KEY environment variable');
      if (!this.results.openaiConfig) console.log('- Set OPENAI_API_KEY environment variable');
      if (!this.results.ttsGeneration) console.log('- Verify Deepgram TTS API access');
      if (!this.results.llmProcessing) console.log('- Verify OpenAI API access');
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// Run verification
if (require.main === module) {
  const verifier = new AudioPipelineVerifier();
  verifier.verify().catch(console.error);
}

module.exports = AudioPipelineVerifier;