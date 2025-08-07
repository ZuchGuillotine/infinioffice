#!/usr/bin/env node

/**
 * Deepgram API Key and Connectivity Test
 * Tests basic Deepgram API connectivity
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testDeepgramAPI() {
  console.log('🔍 Deepgram API Connectivity Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');
  console.log('API Key prefix:', process.env.DEEPGRAM_API_KEY.substring(0, 10) + '...');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram client created successfully');

    // Test basic API connectivity with a simple request
    console.log('\n🧪 Testing API connectivity...');
    
    try {
      // Test with a simple prerecorded transcription
      const testAudio = Buffer.alloc(1600); // 100ms of silence at 16kHz
      
      console.log('📤 Sending test prerecorded transcription request...');
      const response = await deepgram.listen.prerecorded.transcribeBuffer(
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
        statusCode: error.statusCode,
        response: error.response
      });
    }

    // Test live transcription with a different approach
    console.log('\n🧪 Testing live transcription with WebSocket...');
    
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

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Live connection timeout after 5 seconds');
          connection.finish();
          resolve();
        }, 5000);

        connection.on('open', () => {
          console.log('🎉 Live connection opened!');
          clearTimeout(timeout);
          
          // Send test audio
          const testBuffer = Buffer.alloc(320);
          connection.send(testBuffer);
          
          setTimeout(() => {
            connection.finish();
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

        // Check if connection has a WebSocket
        if (connection.socket) {
          console.log('🔌 WebSocket found on connection');
          console.log('WebSocket readyState:', connection.socket.readyState);
        } else {
          console.log('⚠️  No WebSocket found on connection');
        }
      });

    } catch (error) {
      console.error('❌ Live connection failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testDeepgramAPI().then(() => {
  console.log('\n🏁 API test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 API test failed:', error);
  process.exit(1);
}); 