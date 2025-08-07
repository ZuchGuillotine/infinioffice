#!/usr/bin/env node

/**
 * Detailed Deepgram Connection Test
 * Tests Deepgram connection with detailed error reporting
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testDeepgramConnection() {
  console.log('🔍 Detailed Deepgram Connection Test\n');
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

    // Test with a simple configuration
    const config = {
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
    };

    console.log('\n🧪 Testing connection with config:', JSON.stringify(config, null, 2));

    return new Promise((resolve, reject) => {
      let connectionOpened = false;
      let connectionError = null;
      let connectionClosed = false;

      const timeout = setTimeout(() => {
        if (!connectionOpened) {
          console.log('⏰ Connection timeout after 10 seconds');
          if (connection) {
            connection.finish();
          }
          resolve();
        }
      }, 10000);

      let connection;
      try {
        connection = deepgram.listen.live(config);
        console.log('✅ Connection object created');
      } catch (error) {
        console.error('❌ Failed to create connection:', error);
        clearTimeout(timeout);
        reject(error);
        return;
      }

      connection.on('open', () => {
        console.log('🎉 Connection opened successfully!');
        connectionOpened = true;
        clearTimeout(timeout);
        
        // Send a small test audio buffer
        const testBuffer = Buffer.alloc(320); // 20ms of silence at 16kHz
        console.log('📤 Sending test audio buffer...');
        connection.send(testBuffer);
        
        // Close after a short delay
        setTimeout(() => {
          console.log('🔒 Closing connection...');
          connection.finish();
        }, 1000);
      });

      connection.on('connecting', () => {
        console.log('🔄 Connection is connecting...');
      });

      connection.on('warning', (warning) => {
        console.log('⚠️  Connection warning:', warning);
      });

      connection.on('error', (error) => {
        console.error('❌ Connection error:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          response: error.response
        });
        connectionError = error;
        clearTimeout(timeout);
        reject(error);
      });

      connection.on('close', (data) => {
        console.log('🔒 Connection closed:', data);
        connectionClosed = true;
        clearTimeout(timeout);
        resolve();
      });

      // Listen for transcript events
      connection.on('Results', (data) => {
        console.log('📝 Received results:', data);
      });

      connection.on('Transcript', (data) => {
        console.log('📝 Received transcript:', data);
      });

      connection.on('transcriptReceived', (data) => {
        console.log('📝 Received transcript (v2/v3):', data);
      });

      // Check connection state
      setTimeout(() => {
        console.log('🔍 Connection state after 2 seconds:', {
          readyState: connection.readyState,
          opened: connectionOpened,
          error: connectionError,
          closed: connectionClosed
        });
      }, 2000);
    });

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testDeepgramConnection().then(() => {
  console.log('\n🏁 Connection test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Connection test failed:', error);
  process.exit(1);
}); 