#!/usr/bin/env node

/**
 * STT Results Test
 * Examines the actual Results event content
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testSTTResults() {
  console.log('🔍 STT Results Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
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

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⏰ Test timeout after 10 seconds');
        if (connection.finish) {
          connection.finish();
        }
        resolve();
      }, 10000);

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

      // Listen for Results events and examine the content
      connection.on('Results', (data) => {
        console.log('\n📝 Results event received:');
        console.log('Type:', data.type);
        console.log('Duration:', data.duration);
        console.log('Start:', data.start);
        console.log('Is Final:', data.is_final);
        console.log('Speech Final:', data.speech_final);
        
        if (data.channel && data.channel.alternatives) {
          console.log('Alternatives:', data.channel.alternatives.length);
          data.channel.alternatives.forEach((alt, index) => {
            console.log(`  Alternative ${index}:`);
            console.log(`    Transcript: "${alt.transcript}"`);
            console.log(`    Confidence: ${alt.confidence}`);
            console.log(`    Words:`, alt.words ? alt.words.length : 'None');
          });
        }
        
        if (data.metadata) {
          console.log('Metadata:');
          console.log('  Request ID:', data.metadata.request_id);
          console.log('  Model Info:', data.metadata.model_info);
        }
      });

      // Listen for other events
      connection.on('Metadata', (data) => {
        console.log('\n📊 Metadata event received:', data.type);
      });

      connection.on('SpeechStarted', (data) => {
        console.log('\n🎤 SpeechStarted event received:', data);
      });

      connection.on('UtteranceEnd', (data) => {
        console.log('\n🔇 UtteranceEnd event received:', data);
      });
    });

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

testSTTResults().then(() => {
  console.log('\n🏁 Results test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Results test failed:', error);
  process.exit(1);
}); 