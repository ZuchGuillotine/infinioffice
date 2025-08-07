#!/usr/bin/env node

/**
 * Deepgram Model Test
 * Tests different Deepgram models and configurations
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testDeepgramModels() {
  console.log('🔍 Testing Deepgram Models\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  // Test different model configurations
  const modelConfigs = [
    {
      name: 'nova-2-phonecall',
      config: {
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
      }
    },
    {
      name: 'nova-2',
      config: {
        model: 'nova-2',
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
      }
    },
    {
      name: 'nova-3',
      config: {
        model: 'nova-3',
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
      }
    },
    {
      name: 'nova-3-phonecall',
      config: {
        model: 'nova-3-phonecall',
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
      }
    }
  ];

  for (const modelTest of modelConfigs) {
    console.log(`\n🧪 Testing model: ${modelTest.name}`);
    
    try {
      const connection = deepgram.listen.live(modelTest.config);
      
      let connectionOpened = false;
      let connectionError = null;
      
      const timeout = setTimeout(() => {
        if (!connectionOpened) {
          console.log(`  ⚠️  ${modelTest.name}: Connection timeout after 5 seconds`);
          connection.finish();
        }
      }, 5000);

      connection.on('open', () => {
        console.log(`  ✅ ${modelTest.name}: Connection opened successfully`);
        connectionOpened = true;
        clearTimeout(timeout);
        connection.finish();
      });

      connection.on('error', (error) => {
        console.log(`  ❌ ${modelTest.name}: Connection error:`, error.message);
        connectionError = error;
        clearTimeout(timeout);
      });

      connection.on('close', (data) => {
        console.log(`  🔒 ${modelTest.name}: Connection closed`);
      });

    } catch (error) {
      console.log(`  ❌ ${modelTest.name}: Failed to create connection:`, error.message);
    }
  }

  // Test with different audio encodings
  console.log('\n🎵 Testing different audio encodings...');
  
  const encodingTests = [
    { encoding: 'mulaw', sample_rate: 8000 },
    { encoding: 'linear16', sample_rate: 16000 },
    { encoding: 'linear16', sample_rate: 8000 }
  ];

  for (const encodingTest of encodingTests) {
    console.log(`\n🧪 Testing encoding: ${encodingTest.encoding} at ${encodingTest.sample_rate}Hz`);
    
    try {
      const connection = deepgram.listen.live({
        model: 'nova-2',
        language: 'en-US',
        punctuate: true,
        smart_format: true,
        interim_results: true,
        encoding: encodingTest.encoding,
        sample_rate: encodingTest.sample_rate,
        channels: 1,
        diarize: false,
        filler_words: false,
        vad_events: true,
      });
      
      let connectionOpened = false;
      
      const timeout = setTimeout(() => {
        if (!connectionOpened) {
          console.log(`  ⚠️  ${encodingTest.encoding}/${encodingTest.sample_rate}: Connection timeout`);
          connection.finish();
        }
      }, 5000);

      connection.on('open', () => {
        console.log(`  ✅ ${encodingTest.encoding}/${encodingTest.sample_rate}: Connection opened`);
        connectionOpened = true;
        clearTimeout(timeout);
        connection.finish();
      });

      connection.on('error', (error) => {
        console.log(`  ❌ ${encodingTest.encoding}/${encodingTest.sample_rate}: Error:`, error.message);
        clearTimeout(timeout);
      });

    } catch (error) {
      console.log(`  ❌ ${encodingTest.encoding}/${encodingTest.sample_rate}: Failed:`, error.message);
    }
  }
}

testDeepgramModels().then(() => {
  console.log('\n🏁 Model testing completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Model testing failed:', error);
  process.exit(1);
}); 