#!/usr/bin/env node

/**
 * Deepgram SDK v4 API Test
 * Tests the correct v4 API methods
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testDeepgramV4() {
  console.log('🔍 Deepgram SDK v4 API Test\n');
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

    console.log('\n🔍 Available methods on deepgram.listen:');
    console.log(Object.keys(deepgram.listen));

    // Test prerecorded transcription with correct v4 API
    console.log('\n🧪 Testing prerecorded transcription...');
    
    try {
      const testAudio = Buffer.alloc(1600); // 100ms of silence at 16kHz
      
      // Try different API methods
      console.log('📤 Trying different prerecorded methods...');
      
      if (deepgram.listen.prerecorded.transcribeFile) {
        console.log('✅ transcribeFile method exists');
      }
      
      if (deepgram.listen.prerecorded.transcribeUrl) {
        console.log('✅ transcribeUrl method exists');
      }
      
      if (deepgram.listen.prerecorded.transcribeBuffer) {
        console.log('✅ transcribeBuffer method exists');
      }
      
      // Try the correct v4 method
      const response = await deepgram.listen.prerecorded.transcribeFile(
        testAudio,
        {
          model: 'nova-2',
          language: 'en-US',
          punctuate: true,
          smart_format: true,
        }
      );
      
      console.log('✅ Prerecorded transcription successful');
      console.log('Response:', JSON.stringify(response, null, 2));
      
    } catch (error) {
      console.error('❌ Prerecorded transcription failed:', error.message);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      });
    }

    // Test live transcription
    console.log('\n🧪 Testing live transcription...');
    
    try {
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
      console.log('Connection object keys:', Object.keys(connection));

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Live connection timeout after 5 seconds');
          if (connection.finish) {
            connection.finish();
          }
          resolve();
        }, 5000);

        // Check for available event listeners
        console.log('Available event listeners:', Object.getOwnPropertyNames(connection));

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

        // Check connection state
        setTimeout(() => {
          console.log('🔍 Connection state:', {
            readyState: connection.readyState,
            hasSocket: !!connection.socket,
            hasWebSocket: !!connection.ws
          });
        }, 1000);
      });

    } catch (error) {
      console.error('❌ Live connection failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testDeepgramV4().then(() => {
  console.log('\n🏁 v4 API test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 v4 API test failed:', error);
  process.exit(1);
}); 