#!/usr/bin/env node

/**
 * STT Events Test
 * Tests what events are actually being emitted by the STT service
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testSTTEvents() {
  console.log('🔍 STT Events Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram client created successfully');

    // Test live transcription with event monitoring
    console.log('\n🧪 Testing live transcription with event monitoring...');
    
    const connection = deepgram.listen.live({
      model: 'nova-2-phonecall',
      language: 'en-US',
      punctuate: true,
      smart_format: true,
      interim_results: true,
      encoding: 'mulaw',
      sample_rate: 8000,
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
        console.log('⏰ Test timeout after 10 seconds');
        if (connection.finish) {
          connection.finish();
        }
        resolve();
      }, 10000);

      // Monitor ALL events on the connection
      const originalEmit = connection.emit;
      connection.emit = function(event, ...args) {
        console.log(`🎯 EVENT EMITTED: ${event}`, args);
        return originalEmit.apply(this, [event, ...args]);
      };

      connection.on('open', () => {
        console.log('🎉 Live connection opened!');
        
        // Send test audio
        const testBuffer = Buffer.alloc(320);
        console.log('📤 Sending test audio buffer...');
        connection.send(testBuffer);
        
        // Send more audio after a delay
        setTimeout(() => {
          console.log('📤 Sending more test audio...');
          connection.send(testBuffer);
        }, 2000);
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

      // Listen for all possible transcript events
      const transcriptEvents = [
        'Results',
        'Transcript', 
        'transcriptReceived',
        'transcript',
        'results',
        'message',
        'data'
      ];

      transcriptEvents.forEach(eventName => {
        connection.on(eventName, (data) => {
          console.log(`📝 ${eventName} event received:`, data);
        });
      });

      // Listen for VAD events
      const vadEvents = [
        'SpeechStarted',
        'speechStarted',
        'UtteranceEnd',
        'utteranceEnd',
        'speechEnded',
        'silence'
      ];

      vadEvents.forEach(eventName => {
        connection.on(eventName, (data) => {
          console.log(`🎤 ${eventName} event received:`, data);
        });
      });

      // Check connection state periodically
      let checkCount = 0;
      const stateCheck = setInterval(() => {
        checkCount++;
        console.log(`🔍 Connection state check #${checkCount}:`, {
          readyState: connection.readyState,
          hasSocket: !!connection.socket,
          hasWebSocket: !!connection.ws
        });
        
        if (checkCount >= 5) {
          clearInterval(stateCheck);
        }
      }, 1000);
    });

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testSTTEvents().then(() => {
  console.log('\n🏁 STT events test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 STT events test failed:', error);
  process.exit(1);
}); 