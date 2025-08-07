#!/usr/bin/env node

/**
 * STT Configuration Test
 * Tests different configurations to find one that generates transcripts
 */

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

async function testSTTConfigurations() {
  console.log('🔍 STT Configuration Test\n');
  console.log('=' .repeat(50));

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ DEEPGRAM_API_KEY not found');
    return;
  }

  console.log('✅ Deepgram API key found');

  const configurations = [
    {
      name: 'nova-2-phonecall (current)',
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
      name: 'nova-2 (standard)',
      config: {
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
      }
    },
    {
      name: 'nova-2 (mulaw 8kHz)',
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
      name: 'nova-3 (latest)',
      config: {
        model: 'nova-3',
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
      }
    }
  ];

  for (const testConfig of configurations) {
    console.log(`\n🧪 Testing: ${testConfig.name}`);
    console.log('Config:', JSON.stringify(testConfig.config, null, 2));
    
    try {
      const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
      const connection = deepgram.listen.live(testConfig.config);

      let transcriptReceived = false;
      let eventsReceived = 0;

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`  ⏰ ${testConfig.name} timeout after 8 seconds`);
          console.log(`  📊 Events received: ${eventsReceived}, Transcripts: ${transcriptReceived ? 'Yes' : 'No'}`);
          if (connection.finish) {
            connection.finish();
          }
          resolve();
        }, 8000);

        connection.on('open', () => {
          console.log(`  ✅ ${testConfig.name} connection opened`);
          
          // Send test audio
          const testBuffer = Buffer.alloc(320);
          console.log(`  📤 ${testConfig.name} sending audio...`);
          connection.send(testBuffer);
          
          // Send more audio after a delay
          setTimeout(() => {
            console.log(`  📤 ${testConfig.name} sending more audio...`);
            connection.send(testBuffer);
          }, 2000);
        });

        connection.on('error', (error) => {
          console.log(`  ❌ ${testConfig.name} error:`, error.message);
          clearTimeout(timeout);
          resolve();
        });

        connection.on('close', () => {
          console.log(`  🔒 ${testConfig.name} connection closed`);
          clearTimeout(timeout);
          resolve();
        });

        // Listen for transcript events
        const transcriptEvents = ['Results', 'Transcript', 'transcriptReceived', 'transcript', 'results'];
        transcriptEvents.forEach(eventName => {
          connection.on(eventName, (data) => {
            eventsReceived++;
            transcriptReceived = true;
            console.log(`  📝 ${testConfig.name} ${eventName} event:`, data);
          });
        });

        // Listen for VAD events
        const vadEvents = ['SpeechStarted', 'speechStarted', 'UtteranceEnd', 'utteranceEnd'];
        vadEvents.forEach(eventName => {
          connection.on(eventName, (data) => {
            eventsReceived++;
            console.log(`  🎤 ${testConfig.name} ${eventName} event:`, data);
          });
        });

        // Monitor all events
        const originalEmit = connection.emit;
        connection.emit = function(event, ...args) {
          if (!['open', 'error', 'close'].includes(event)) {
            eventsReceived++;
            console.log(`  🎯 ${testConfig.name} EVENT: ${event}`, args);
          }
          return originalEmit.apply(this, [event, ...args]);
        };
      });

    } catch (error) {
      console.log(`  ❌ ${testConfig.name} failed to create connection:`, error.message);
    }
  }
}

testSTTConfigurations().then(() => {
  console.log('\n🏁 Configuration test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Configuration test failed:', error);
  process.exit(1);
}); 