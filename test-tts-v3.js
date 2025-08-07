#!/usr/bin/env node

/**
 * Deepgram TTS v3 API Test
 * Tests the correct v3 TTS API methods
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testTTSService() {
  console.log('🔍 Deepgram TTS v3 API Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram client created successfully');

    // Check available methods
    console.log('\n🔍 Available methods on deepgram:');
    console.log(Object.keys(deepgram));

    // Check if speak method exists
    if (deepgram.speak) {
      console.log('\n🔍 Available methods on deepgram.speak:');
      console.log(Object.keys(deepgram.speak));
    } else {
      console.log('\n❌ deepgram.speak does not exist');
    }

    // Test TTS with different approaches
    console.log('\n🧪 Testing TTS generation...');
    
    const testText = "Hello, this is a test of the TTS service.";
    
    try {
      // Try different TTS methods
      if (deepgram.speak && deepgram.speak.request) {
        console.log('📤 Trying deepgram.speak.request...');
        const response = await deepgram.speak.request(
          { text: testText },
          {
            model: 'aura-asteria-en',
            voice: 'asteria',
            encoding: 'linear16',
            container: 'wav',
            sample_rate: 24000
          }
        );
        console.log('✅ TTS request successful');
        console.log('Response type:', typeof response);
        console.log('Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'not object');
      }
    } catch (error) {
      console.error('❌ TTS request failed:', error.message);
    }

    try {
      if (deepgram.speak && deepgram.speak.synthesize) {
        console.log('📤 Trying deepgram.speak.synthesize...');
        const response = await deepgram.speak.synthesize(
          { text: testText },
          {
            model: 'aura-asteria-en',
            voice: 'asteria',
            encoding: 'linear16',
            container: 'wav',
            sample_rate: 24000
          }
        );
        console.log('✅ TTS synthesize successful');
        console.log('Response type:', typeof response);
        console.log('Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'not object');
      }
    } catch (error) {
      console.error('❌ TTS synthesize failed:', error.message);
    }

    // Try direct method call
    try {
      console.log('📤 Trying direct method call...');
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
      console.log('✅ Direct TTS call successful');
      console.log('Response type:', typeof response);
      console.log('Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'not object');
    } catch (error) {
      console.error('❌ Direct TTS call failed:', error.message);
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