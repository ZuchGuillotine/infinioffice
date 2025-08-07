#!/usr/bin/env node

/**
 * Deepgram v4 TTS API Discovery
 * Finds the correct TTS API in v4
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function discoverTTSService() {
  console.log('🔍 Deepgram v4 TTS API Discovery\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram client created successfully');

    // Explore the entire deepgram object
    console.log('\n🔍 Complete deepgram object exploration:');
    console.log('All keys:', Object.keys(deepgram));
    
    // Check if there are any methods directly on deepgram
    const methods = Object.getOwnPropertyNames(deepgram).filter(key => typeof deepgram[key] === 'function');
    console.log('Direct methods:', methods);

    // Check if there are any properties that might contain TTS
    const potentialTTSPaths = [];
    
    // Check if there's a speak method directly
    if (typeof deepgram.speak === 'function') {
      potentialTTSPaths.push('deepgram.speak');
    }
    
    // Check if there's a tts method directly
    if (typeof deepgram.tts === 'function') {
      potentialTTSPaths.push('deepgram.tts');
    }
    
    // Check if there's a synthesis method directly
    if (typeof deepgram.synthesis === 'function') {
      potentialTTSPaths.push('deepgram.synthesis');
    }

    console.log('Potential TTS paths:', potentialTTSPaths);

    // Try calling speak as a method directly
    if (typeof deepgram.speak === 'function') {
      console.log('\n🧪 Trying deepgram.speak as a method...');
      try {
        const response = await deepgram.speak(
          { text: "Hello, this is a test." },
          {
            model: 'aura-asteria-en',
            voice: 'asteria',
            encoding: 'linear16',
            container: 'wav',
            sample_rate: 24000
          }
        );
        console.log('✅ deepgram.speak method successful');
        console.log('Response:', response);
      } catch (error) {
        console.log('❌ deepgram.speak method failed:', error.message);
      }
    }

    // Check if there are any other properties that might be TTS-related
    console.log('\n🔍 Checking for TTS-related properties...');
    
    for (const key of Object.keys(deepgram)) {
      const value = deepgram[key];
      if (typeof value === 'object' && value !== null) {
        console.log(`Checking ${key}:`, Object.keys(value));
        
        // Look for TTS-related methods in nested objects
        for (const subKey of Object.keys(value)) {
          const subValue = value[subKey];
          if (typeof subValue === 'function') {
            console.log(`  Found method: ${key}.${subKey}`);
            
            // Try calling TTS-related methods
            if (subKey.toLowerCase().includes('speak') || 
                subKey.toLowerCase().includes('tts') || 
                subKey.toLowerCase().includes('synthesis')) {
              console.log(`  🎯 TTS-related method found: ${key}.${subKey}`);
              
              try {
                const response = await subValue(
                  { text: "Hello, this is a test." },
                  {
                    model: 'aura-asteria-en',
                    voice: 'asteria',
                    encoding: 'linear16',
                    container: 'wav',
                    sample_rate: 24000
                  }
                );
                console.log(`  ✅ ${key}.${subKey} successful`);
                console.log('  Response:', response);
              } catch (error) {
                console.log(`  ❌ ${key}.${subKey} failed:`, error.message);
              }
            }
          }
        }
      }
    }

    // Check if there's a factory method that might create TTS
    if (deepgram.factory) {
      console.log('\n🔍 Checking factory...');
      console.log('Factory type:', typeof deepgram.factory);
      if (typeof deepgram.factory === 'function') {
        try {
          const factoryResult = deepgram.factory();
          console.log('Factory result:', factoryResult);
        } catch (error) {
          console.log('Factory error:', error.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

discoverTTSService().then(() => {
  console.log('\n🏁 TTS discovery completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 TTS discovery failed:', error);
  process.exit(1);
}); 