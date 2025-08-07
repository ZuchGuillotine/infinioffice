#!/usr/bin/env node

/**
 * STT Real Audio Test
 * Tests with real audio data instead of silence
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testSTTRealAudio() {
  console.log('🔍 STT Real Audio Test\n');
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
        console.log('⏰ Test timeout after 15 seconds');
        if (connection.finish) {
          connection.finish();
        }
        resolve();
      }, 15000);

      let resultsCount = 0;
      let transcriptCount = 0;

      connection.on('open', () => {
        console.log('🎉 Live connection opened!');
        
        // Create a simple tone (sine wave) instead of silence
        console.log('📤 Sending tone audio...');
        const toneBuffer = generateTone(8000, 0.1); // 100ms tone at 8kHz
        connection.send(toneBuffer);
        
        // Send more tone after a delay
        setTimeout(() => {
          console.log('📤 Sending more tone audio...');
          connection.send(toneBuffer);
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

      // Listen for Results events
      connection.on('Results', (data) => {
        resultsCount++;
        console.log(`\n📝 Results event #${resultsCount}:`);
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
            if (alt.transcript && alt.transcript.trim()) {
              transcriptCount++;
            }
          });
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

      // Summary after timeout
      setTimeout(() => {
        console.log('\n📊 Test Summary:');
        console.log(`  • Results events received: ${resultsCount}`);
        console.log(`  • Transcripts with content: ${transcriptCount}`);
      }, 14000);
    });

  } catch (error) {
    console.error('❌ Failed to create Deepgram client:', error);
    throw error;
  }
}

// Generate a simple tone (sine wave) in mulaw format
function generateTone(sampleRate, duration) {
  const numSamples = Math.floor(sampleRate * duration);
  const frequency = 440; // A4 note
  const amplitude = 0.3;
  
  const buffer = Buffer.alloc(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
    
    // Convert to mulaw (simplified - this is not perfect mulaw encoding)
    const mulawSample = Math.max(-127, Math.min(127, Math.floor(sample * 127)));
    buffer[i] = mulawSample + 128; // Convert to unsigned
  }
  
  return buffer;
}

testSTTRealAudio().then(() => {
  console.log('\n🏁 Real audio test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Real audio test failed:', error);
  process.exit(1);
}); 