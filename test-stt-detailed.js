#!/usr/bin/env node

/**
 * STT Detailed Test
 * Tests if Results events are being received but not processed
 */

require('dotenv').config();

const { STTService } = require('./src/services/stt');

class STTDetailedTester {
  constructor() {
    this.sttService = new STTService();
    this.transcriptCount = 0;
  }

  async testSTTDetailed() {
    console.log('🔍 STT Detailed Test - Checking Results Event Processing\n');
    console.log('=' .repeat(60));

    try {
      // Step 1: Test STT connection with raw event monitoring
      console.log('\n1️⃣ Testing STT Connection with Raw Event Monitoring...');
      await this.testSTTConnection();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }

  async testSTTConnection() {
    console.log('  • Starting STT service with raw event monitoring...');
    
    return new Promise((resolve, reject) => {
      let readyEmitted = false;
      let errorEmitted = false;
      
      const timeout = setTimeout(() => {
        if (!readyEmitted && !errorEmitted) {
          console.log('  ⚠️  STT ready event not emitted within 15 seconds');
          this.sttService.stopListening();
          resolve();
        }
      }, 15000);

      // Listen for all possible events
      this.sttService.on('ready', () => {
        console.log('  ✅ STT service ready event emitted');
        readyEmitted = true;
        clearTimeout(timeout);
        resolve();
      });

      this.sttService.on('error', (error) => {
        console.log('  ❌ STT service error:', error.message);
        errorEmitted = true;
        clearTimeout(timeout);
        reject(error);
      });

      this.sttService.on('transcript', (data) => {
        this.transcriptCount++;
        console.log(`  📝 Transcript #${this.transcriptCount}:`, {
          text: data.text,
          isFinal: data.isFinal,
          confidence: data.confidence
        });
      });

      this.sttService.on('speechStarted', () => {
        console.log('  🎤 Speech started detected');
      });

      this.sttService.on('speechEnded', () => {
        console.log('  🔇 Speech ended detected');
      });

      this.sttService.on('silence', () => {
        console.log('  🤐 Silence detected');
      });

      this.sttService.on('bargeIn', () => {
        console.log('  🎯 Barge-in detected');
      });

      // Start listening with the same config as production
      const connection = this.sttService.startListening({
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

      if (connection) {
        // Monitor ALL events on the connection
        const originalEmit = connection.emit;
        connection.emit = function(event, ...args) {
          console.log(`  🎯 RAW EVENT: ${event}`, args);
          return originalEmit.apply(this, [event, ...args]);
        };

        connection.on('open', () => {
          console.log('  🔗 STT connection opened successfully');
          
          // Send test audio after a delay
          setTimeout(() => {
            console.log('  📤 Sending test audio...');
            const testBuffer = Buffer.alloc(320);
            this.sttService.sendAudio(testBuffer);
            
            // Send more audio after another delay
            setTimeout(() => {
              console.log('  📤 Sending more test audio...');
              this.sttService.sendAudio(testBuffer);
            }, 2000);
          }, 1000);
        });

        connection.on('connecting', () => {
          console.log('  🔄 STT connecting...');
        });

        connection.on('warning', (warning) => {
          console.log('  ⚠️  STT warning:', warning);
        });

        connection.on('close', (data) => {
          console.log('  🔒 STT connection closed:', data);
        });
      }
    });
  }
}

// Run the test
const tester = new STTDetailedTester();
tester.testSTTDetailed().then(() => {
  console.log('\n🏁 Detailed test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Detailed test failed:', error);
  process.exit(1);
}); 