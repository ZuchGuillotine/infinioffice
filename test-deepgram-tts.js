#!/usr/bin/env node

/**
 * Test script to validate Deepgram TTS response handling
 * Run: node test-deepgram-tts.js
 */

const { TTSService } = require('./src/services/tts.js');

async function testDeepgramTTS() {
  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('DEEPGRAM_API_KEY environment variable is required');
    process.exit(1);
  }

  const ttsService = new TTSService();
  
  try {
    console.log('Testing Deepgram TTS response handling...');
    
    const testText = 'Hello, this is a test of the Deepgram TTS service.';
    
    console.log(`Generating speech for: "${testText}"`);
    
    const audioStream = await ttsService.getSpeech(testText, {
      model: 'aura-asteria-en',
      encoding: 'mulaw',
      sample_rate: 8000,
      container: 'none'
    });
    
    if (audioStream) {
      console.log('✅ TTS service successfully generated audio stream');
      
      // Test streaming audio data
      let totalBytes = 0;
      audioStream.on('data', (chunk) => {
        totalBytes += chunk.length;
      });
      
      audioStream.on('end', () => {
        console.log(`✅ Audio stream completed. Total bytes: ${totalBytes}`);
        console.log('🎉 Test completed successfully!');
      });
      
      audioStream.on('error', (error) => {
        console.error('❌ Audio stream error:', error);
      });
      
    } else {
      console.error('❌ Failed to generate audio stream');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDeepgramTTS().catch(console.error);