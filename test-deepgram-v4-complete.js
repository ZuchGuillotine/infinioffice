#!/usr/bin/env node

/**
 * Complete Deepgram v4 API Test
 * Tests all available methods and structures
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testDeepgramV4Complete() {
  console.log('🔍 Complete Deepgram v4 API Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram client created successfully');

    // Explore the complete client structure
    console.log('\n🔍 Complete deepgram client structure:');
    console.log('Keys:', Object.keys(deepgram));
    
    // Check if there are any nested objects
    for (const key of Object.keys(deepgram)) {
      const value = deepgram[key];
      if (typeof value === 'object' && value !== null) {
        console.log(`\n📁 ${key}:`, Object.keys(value));
      }
    }

    // Test STT methods
    console.log('\n🧪 Testing STT methods...');
    
    // Check if listen exists
    if (deepgram.listen) {
      console.log('✅ deepgram.listen exists');
      console.log('listen keys:', Object.keys(deepgram.listen));
      
      // Check prerecorded
      if (deepgram.listen.prerecorded) {
        console.log('✅ deepgram.listen.prerecorded exists');
        console.log('prerecorded keys:', Object.keys(deepgram.listen.prerecorded));
      }
      
      // Check live
      if (deepgram.listen.live) {
        console.log('✅ deepgram.listen.live exists');
        console.log('live type:', typeof deepgram.listen.live);
      }
    }

    // Test TTS methods
    console.log('\n🧪 Testing TTS methods...');
    
    // Check if speak exists
    if (deepgram.speak) {
      console.log('✅ deepgram.speak exists');
      console.log('speak keys:', Object.keys(deepgram.speak));
    } else {
      console.log('❌ deepgram.speak does not exist');
      
      // Check if TTS is under a different namespace
      console.log('\n🔍 Looking for TTS under different namespaces...');
      for (const key of Object.keys(deepgram)) {
        const value = deepgram[key];
        if (typeof value === 'object' && value !== null) {
          console.log(`Checking ${key}:`, Object.keys(value));
          if (Object.keys(value).includes('speak') || Object.keys(value).includes('tts')) {
            console.log(`🎯 Found potential TTS in ${key}:`, value.speak || value.tts);
          }
        }
      }
    }

    // Test actual API calls
    console.log('\n🧪 Testing actual API calls...');
    
    // Test prerecorded transcription
    try {
      console.log('📤 Testing prerecorded transcription...');
      const testAudio = Buffer.alloc(1600); // 100ms of silence at 16kHz
      
      // Try different methods
      if (deepgram.listen && deepgram.listen.prerecorded) {
        const prerecorded = deepgram.listen.prerecorded;
        
        if (prerecorded.transcribeFile) {
          console.log('✅ transcribeFile method exists');
          const response = await prerecorded.transcribeFile(
            testAudio,
            {
              model: 'nova-2',
              language: 'en-US',
              punctuate: true,
              smart_format: true,
            }
          );
          console.log('✅ transcribeFile successful');
          console.log('Response structure:', Object.keys(response));
        }
        
        if (prerecorded.transcribeUrl) {
          console.log('✅ transcribeUrl method exists');
        }
        
        if (prerecorded.transcribeBuffer) {
          console.log('✅ transcribeBuffer method exists');
        }
      }
    } catch (error) {
      console.error('❌ Prerecorded transcription failed:', error.message);
    }

    // Test live transcription
    try {
      console.log('📤 Testing live transcription...');
      if (deepgram.listen && typeof deepgram.listen.live === 'function') {
        const connection = deepgram.listen.live({
          model: 'nova-2',
          language: 'en-US',
          punctuate: true,
          smart_format: true,
          interim_results: true,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1,
          diarize: false,
          filler_words: false,
          vad_events: true,
        });

        console.log('✅ Live connection created');
        console.log('Connection type:', typeof connection);
        console.log('Connection keys:', Object.keys(connection));

        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('⏰ Live connection timeout after 5 seconds');
            if (connection.finish) {
              connection.finish();
            }
            resolve();
          }, 5000);

          connection.on('open', () => {
            console.log('🎉 Live connection opened!');
            clearTimeout(timeout);
            
            // Send test audio
            const testBuffer = Buffer.alloc(320);
            connection.send(testBuffer);
            
            setTimeout(() => {
              if (connection.finish) {
                connection.finish();
              }
            }, 1000);
          });

          connection.on('error', (error) => {
            console.error('❌ Live connection error:', error.message);
            clearTimeout(timeout);
            resolve();
          });

          connection.on('close', () => {
            console.log('🔒 Live connection closed');
            clearTimeout(timeout);
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('❌ Live transcription failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testDeepgramV4Complete().then(() => {
  console.log('\n🏁 Complete v4 API test finished');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Complete v4 API test failed:', error);
  process.exit(1);
}); 