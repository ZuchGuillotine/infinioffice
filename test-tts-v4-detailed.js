#!/usr/bin/env node

/**
 * Detailed Deepgram TTS v4 API Test
 * Explores the complete TTS structure
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testTTSServiceDetailed() {
  console.log('🔍 Detailed Deepgram TTS v4 API Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram client created successfully');

    // Explore the speak object in detail
    console.log('\n🔍 Exploring deepgram.speak structure:');
    console.log('speak type:', typeof deepgram.speak);
    console.log('speak keys:', Object.keys(deepgram.speak));
    
    // Check each property of speak
    for (const key of Object.keys(deepgram.speak)) {
      const value = deepgram.speak[key];
      console.log(`\n📁 speak.${key}:`, typeof value);
      if (typeof value === 'object' && value !== null) {
        console.log(`  Keys:`, Object.keys(value));
        
        // Check if any of these are functions
        for (const subKey of Object.keys(value)) {
          const subValue = value[subKey];
          if (typeof subValue === 'function') {
            console.log(`  ✅ speak.${key}.${subKey} is a function`);
          }
        }
      }
    }

    // Try to find TTS methods
    console.log('\n🧪 Looking for TTS methods...');
    
    // Check if there are any methods that might be TTS-related
    const allMethods = [];
    for (const key of Object.keys(deepgram.speak)) {
      const value = deepgram.speak[key];
      if (typeof value === 'object' && value !== null) {
        for (const subKey of Object.keys(value)) {
          const subValue = value[subKey];
          if (typeof subValue === 'function') {
            allMethods.push(`speak.${key}.${subKey}`);
          }
        }
      }
    }
    
    console.log('Found methods:', allMethods);

    // Try calling methods that might be TTS-related
    const testText = "Hello, this is a test.";
    
    for (const methodPath of allMethods) {
      try {
        console.log(`\n📤 Trying ${methodPath}...`);
        const parts = methodPath.split('.');
        const method = deepgram.speak[parts[1]][parts[2]];
        
        const response = await method(
          { text: testText },
          {
            model: 'aura-asteria-en',
            voice: 'asteria',
            encoding: 'linear16',
            container: 'wav',
            sample_rate: 24000
          }
        );
        
        console.log(`✅ ${methodPath} successful`);
        console.log('Response type:', typeof response);
        console.log('Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'not object');
        
      } catch (error) {
        console.log(`❌ ${methodPath} failed:`, error.message);
      }
    }

    // Also check if there are any other TTS-related properties
    console.log('\n🔍 Checking for other TTS-related properties...');
    
    // Check if there's a tts property
    if (deepgram.tts) {
      console.log('✅ deepgram.tts exists');
      console.log('tts keys:', Object.keys(deepgram.tts));
    }
    
    // Check if there's a synthesis property
    if (deepgram.synthesis) {
      console.log('✅ deepgram.synthesis exists');
      console.log('synthesis keys:', Object.keys(deepgram.synthesis));
    }

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testTTSServiceDetailed().then(() => {
  console.log('\n🏁 Detailed TTS test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Detailed TTS test failed:', error);
  process.exit(1);
}); 