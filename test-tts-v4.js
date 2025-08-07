#!/usr/bin/env node

/**
 * Deepgram TTS v4 API Test
 * Tests the correct v4 TTS API methods
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testTTSService() {
  console.log('🔍 Deepgram TTS v4 API Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram client created successfully');

    // Check TTS methods
    console.log('\n🔍 TTS methods available:');
    console.log('deepgram.speak keys:', Object.keys(deepgram.speak));

    // Test TTS with different approaches
    console.log('\n🧪 Testing TTS generation...');
    
    const testText = "Hello, this is a test of the TTS service.";
    
    try {
      // Try the speak method directly
      console.log('📤 Trying deepgram.speak...');
      const response = await deepgram.speak(
        { text: testText },
        {
          model: 'aura-asteria-en',
          voice: 'asteria',
          encoding: 'linear16',
          container: 'wav',
          sample_rate: 24000
        }
      );
      
      console.log('✅ TTS generation successful');
      console.log('Response type:', typeof response);
      console.log('Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'not object');
      
      if (response && typeof response === 'object') {
        // Check for different response structures
        if (response.result) {
          console.log('✅ Response has result property');
          console.log('Result type:', typeof response.result);
          if (response.result instanceof ArrayBuffer) {
            console.log('✅ Result is ArrayBuffer, size:', response.result.byteLength);
          } else if (response.result instanceof Uint8Array) {
            console.log('✅ Result is Uint8Array, size:', response.result.length);
          } else if (Buffer.isBuffer(response.result)) {
            console.log('✅ Result is Buffer, size:', response.result.length);
          }
        }
        
        if (response.getStream && typeof response.getStream === 'function') {
          console.log('✅ Response has getStream method');
          try {
            const stream = await response.getStream();
            console.log('✅ getStream successful, stream type:', typeof stream);
            if (stream && typeof stream.getReader === 'function') {
              console.log('✅ Stream is ReadableStream');
            }
          } catch (streamError) {
            console.log('❌ getStream failed:', streamError.message);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ TTS generation failed:', error.message);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      });
    }

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testTTSService().then(() => {
  console.log('\n🏁 TTS test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 TTS test failed:', error);
  process.exit(1);
}); 