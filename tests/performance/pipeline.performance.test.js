/**
 * Performance tests for the voice AI pipeline
 * Target: Complete turn-around time <1.5s for MVP success
 */

const { STTService } = require('../../src/services/stt');
const { detectIntent, generateResponse } = require('../../src/services/llm');
const { getSpeech, streamTTSToTwilio } = require('../../src/services/tts');
const { bookingMachine } = require('../../src/services/stateMachine');
const { interpret } = require('xstate');
const { measureExecutionTime, createMockAudioStream } = require('../helpers/testHelpers');
const { successfulBookings, performanceScenarios } = require('../fixtures/conversations');

// Mock external services
jest.mock('@deepgram/sdk');
jest.mock('openai');

describe('Voice AI Pipeline Performance Tests', () => {
  let sttService;
  let stateMachine;
  let mockDeepgramClient;
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup STT mocks
    const mockConnection = {
      on: jest.fn(),
      send: jest.fn(),
      finish: jest.fn()
    };
    
    mockDeepgramClient = {
      listen: {
        live: jest.fn(() => mockConnection),
        prerecorded: { transcribeBuffer: jest.fn() }
      },
      speak: {
        request: jest.fn()
      }
    };
    
    require('@deepgram/sdk').createClient.mockImplementation(() => mockDeepgramClient);
    
    // Setup LLM mocks
    mockOpenAI = jest.fn(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }));
    require('openai').mockImplementation(mockOpenAI);
    
    sttService = new STTService();
    stateMachine = interpret(bookingMachine);
  });

  afterEach(() => {
    if (stateMachine?.status === 'running') {
      stateMachine.stop();
    }
  });

  describe('Individual Service Performance', () => {
    it('should meet STT latency target (<500ms)', async () => {
      // Mock realistic STT processing time
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms processing
        return {
          results: {
            channels: [{
              alternatives: [{ transcript: 'I need to book an appointment' }]
            }]
          }
        };
      });

      const audioBuffer = Buffer.from('mock audio data');
      const { timeMs, result } = await measureExecutionTime(async () => {
        return await sttService.getTranscription(audioBuffer);
      });

      expect(timeMs).toBeLessThan(500);
      expect(result).toBe('I need to book an appointment');
    });

    it('should meet LLM latency target (<800ms)', async () => {
      const mockInstance = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 600)); // 600ms processing
              return {
                choices: [{
                  message: {
                    content: JSON.stringify({
                      intent: 'booking',
                      confidence: 0.92,
                      entities: { service: 'haircut' },
                      rawText: 'I want a haircut'
                    })
                  }
                }]
              };
            })
          }
        }
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      const { timeMs, result } = await measureExecutionTime(async () => {
        return await detectIntent('I want a haircut');
      });

      expect(timeMs).toBeLessThan(800);
      expect(result.intent).toBe('booking');
      expect(result.confidence).toBe(0.92);
    });

    it('should meet TTS latency target (<400ms)', async () => {
      mockDeepgramClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 250)); // 250ms processing
        return {
          getStream: () => createMockAudioStream()
        };
      });

      const { timeMs, result } = await measureExecutionTime(async () => {
        return await getSpeech('What service would you like to book?');
      });

      expect(timeMs).toBeLessThan(400);
      expect(result).toBeDefined();
    });
  });

  describe('End-to-End Pipeline Performance', () => {
    it('should complete full pipeline within 1.5s target', async () => {
      // Setup realistic service mocks
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockResolvedValue({
        results: {
          channels: [{
            alternatives: [{ transcript: 'Book haircut tomorrow' }]
          }]
        }
      });

      const mockLLMInstance = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{
                  message: {
                    content: JSON.stringify({
                      intent: 'booking',
                      confidence: 0.95,
                      entities: { 
                        service: 'haircut',
                        timeWindow: 'tomorrow'
                      },
                      rawText: 'Book haircut tomorrow'
                    })
                  }
                }]
              })
              .mockResolvedValueOnce({
                choices: [{
                  message: {
                    content: 'What is your contact information?'
                  }
                }]
              })
          }
        }
      };
      mockOpenAI.mockImplementation(() => mockLLMInstance);

      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      const { timeMs } = await measureExecutionTime(async () => {
        // 1. STT: Audio to text
        const audioBuffer = Buffer.from('mock audio');
        const transcript = await sttService.getTranscription(audioBuffer);
        
        // 2. Intent Detection
        const intentResult = await detectIntent(transcript);
        
        // 3. State Machine Processing
        stateMachine.start();
        stateMachine.send({
          type: 'PROCESS_INTENT',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          response: 'Processing...',
          bookingData: intentResult.entities
        });
        
        // 4. Response Generation
        const context = stateMachine.getSnapshot().context;
        const response = await generateResponse('collectContact', context);
        
        // 5. TTS: Text to speech
        const audioStream = await getSpeech(response);
        
        return { transcript, intentResult, response, audioStream };
      });

      expect(timeMs).toBeLessThan(1500); // 1.5 second target
      console.log(`End-to-end pipeline completed in ${timeMs.toFixed(2)}ms`);
    });

    it('should handle concurrent requests efficiently', async () => {
      const numConcurrentRequests = 5;
      
      // Setup mocks with varying delays to simulate real conditions
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
        return {
          results: {
            channels: [{
              alternatives: [{ transcript: 'Concurrent request test' }]
            }]
          }
        };
      });

      const mockInstance = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 200));
              return {
                choices: [{
                  message: {
                    content: JSON.stringify({
                      intent: 'booking',
                      confidence: 0.88,
                      entities: {},
                      rawText: 'Concurrent request test'
                    })
                  }
                }]
              };
            })
          }
        }
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      mockDeepgramClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
        return { getStream: () => createMockAudioStream() };
      });

      const promises = Array.from({ length: numConcurrentRequests }, async (_, index) => {
        const { timeMs } = await measureExecutionTime(async () => {
          const transcript = await sttService.getTranscription(Buffer.from(`audio-${index}`));
          const intentResult = await detectIntent(transcript);
          const response = await generateResponse('greeting', {});
          const audioStream = await getSpeech(response);
          return { transcript, intentResult, response, audioStream };
        });
        return { index, timeMs };
      });

      const results = await Promise.all(promises);

      // All requests should complete
      expect(results).toHaveLength(numConcurrentRequests);
      
      // Each individual request should meet target
      results.forEach(({ index, timeMs }) => {
        expect(timeMs).toBeLessThan(2000); // Allow some overhead for concurrency
        console.log(`Request ${index}: ${timeMs.toFixed(2)}ms`);
      });

      // Average should be reasonable
      const avgTime = results.reduce((sum, { timeMs }) => sum + timeMs, 0) / results.length;
      expect(avgTime).toBeLessThan(1500);
      console.log(`Average concurrent request time: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Conversation Flow Performance', () => {
    it('should maintain performance across multi-turn conversations', async () => {
      const conversationTurns = [
        {
          userInput: 'Hello, I need an appointment',
          expectedResponse: /service.*need/i,
          targetLatency: 1500
        },
        {
          userInput: 'I need a haircut',
          expectedResponse: /time.*prefer/i,
          targetLatency: 1200 // Subsequent turns should be faster
        },
        {
          userInput: 'Tomorrow at 2 PM',
          expectedResponse: /contact.*information/i,
          targetLatency: 1200
        },
        {
          userInput: 'John Smith, 555-1234',
          expectedResponse: /confirm.*details/i,
          targetLatency: 1200
        },
        {
          userInput: 'Yes, that is correct',
          expectedResponse: /booking.*appointment/i,
          targetLatency: 1000 // Final confirmation should be fast
        }
      ];

      // Setup progressive mocks for conversation
      const sttResponses = conversationTurns.map(turn => ({
        results: {
          channels: [{
            alternatives: [{ transcript: turn.userInput }]
          }]
        }
      }));
      
      mockDeepgramClient.listen.prerecorded.transcribeBuffer
        .mockResolvedValueOnce(sttResponses[0])
        .mockResolvedValueOnce(sttResponses[1])
        .mockResolvedValueOnce(sttResponses[2])
        .mockResolvedValueOnce(sttResponses[3])
        .mockResolvedValueOnce(sttResponses[4]);

      const mockInstance = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'booking', confidence: 0.95, entities: {}, rawText: conversationTurns[0].userInput
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'service_provided', confidence: 0.92, entities: { service: 'haircut' }, rawText: conversationTurns[1].userInput
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'time_provided', confidence: 0.89, entities: { timeWindow: 'tomorrow at 2 PM' }, rawText: conversationTurns[2].userInput
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'contact_provided', confidence: 0.96, entities: { contact: 'John Smith, 555-1234' }, rawText: conversationTurns[3].userInput
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'confirmation_yes', confidence: 0.98, entities: {}, rawText: conversationTurns[4].userInput
                })}}]
              })
              .mockResolvedValue({
                choices: [{ message: { content: 'Default response for generateResponse calls' }}]
              });
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      stateMachine.start();
      const turnResults = [];

      for (let i = 0; i < conversationTurns.length; i++) {
        const turn = conversationTurns[i];
        
        const { timeMs } = await measureExecutionTime(async () => {
          // Process user input through pipeline
          const transcript = await sttService.getTranscription(Buffer.from(`audio-turn-${i}`));
          const intentResult = await detectIntent(transcript);
          
          // Update state machine
          stateMachine.send({
            type: 'PROCESS_INTENT',
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            response: 'Processing...',
            bookingData: intentResult.entities,
            originalSpeech: transcript
          });
          
          // Generate response based on current state
          const currentState = stateMachine.getSnapshot();
          let responseState = 'greeting';
          if (currentState.value === 'collectService') responseState = 'service';
          else if (currentState.value === 'collectTimeWindow') responseState = 'timeWindow';
          else if (currentState.value === 'collectContact') responseState = 'contact';
          else if (currentState.value === 'confirm') responseState = 'confirmation';
          else if (currentState.value === 'book') responseState = 'booking';
          
          const response = await generateResponse(responseState, currentState.context);
          const audioStream = await getSpeech(response);
          
          return { transcript, intentResult, response, audioStream };
        });

        turnResults.push({ turnIndex: i, timeMs, targetLatency: turn.targetLatency });
        
        // Verify performance meets target for this turn
        expect(timeMs).toBeLessThan(turn.targetLatency);
        console.log(`Turn ${i + 1}: ${timeMs.toFixed(2)}ms (target: ${turn.targetLatency}ms)`);
      }

      // Verify conversation completed successfully
      const finalState = stateMachine.getSnapshot();
      expect(['book', 'success', 'confirm']).toContain(finalState.value);
      
      // Verify performance improvement over conversation
      const laterTurns = turnResults.slice(1);
      const avgLaterTurnTime = laterTurns.reduce((sum, { timeMs }) => sum + timeMs, 0) / laterTurns.length;
      expect(avgLaterTurnTime).toBeLessThan(turnResults[0].timeMs); // Later turns should be faster
      console.log(`First turn: ${turnResults[0].timeMs.toFixed(2)}ms, Later turns avg: ${avgLaterTurnTime.toFixed(2)}ms`);
    });
  });

  describe('Load and Stress Testing', () => {
    it('should handle multiple concurrent conversations', async () => {
      const numConversations = 3;
      const turnsPerConversation = 3;
      
      // Setup mocks for load testing
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
        return {
          results: {
            channels: [{ alternatives: [{ transcript: 'Load test input' }] }]
          }
        };
      });

      const mockInstance = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
              return {
                choices: [{
                  message: {
                    content: JSON.stringify({
                      intent: 'booking',
                      confidence: 0.85,
                      entities: {},
                      rawText: 'Load test input'
                    })
                  }
                }]
              };
            })
          }
        }
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      mockDeepgramClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
        return { getStream: () => createMockAudioStream() };
      });

      const conversationPromises = Array.from({ length: numConversations }, async (_, convIndex) => {
        const stateMachine = interpret(bookingMachine);
        stateMachine.start();
        
        const turnPromises = Array.from({ length: turnsPerConversation }, async (_, turnIndex) => {
          const { timeMs } = await measureExecutionTime(async () => {
            const transcript = await sttService.getTranscription(Buffer.from(`conv-${convIndex}-turn-${turnIndex}`));
            const intentResult = await detectIntent(transcript);
            const response = await generateResponse('greeting', {});
            const audioStream = await getSpeech(response);
            return { transcript, intentResult, response, audioStream };
          });
          return { conversationId: convIndex, turnId: turnIndex, timeMs };
        });
        
        const turns = await Promise.all(turnPromises);
        stateMachine.stop();
        return turns;
      });

      const allResults = await Promise.all(conversationPromises);
      const flatResults = allResults.flat();

      // All turns should complete
      expect(flatResults).toHaveLength(numConversations * turnsPerConversation);
      
      // Performance should degrade gracefully under load
      const avgLatency = flatResults.reduce((sum, { timeMs }) => sum + timeMs, 0) / flatResults.length;
      expect(avgLatency).toBeLessThan(2000); // Allow higher latency under load
      
      // No individual turn should exceed maximum acceptable latency
      flatResults.forEach(({ conversationId, turnId, timeMs }) => {
        expect(timeMs).toBeLessThan(3000); // 3s maximum under load
      });

      console.log(`Load test: ${numConversations} conversations, ${turnsPerConversation} turns each`);
      console.log(`Average latency under load: ${avgLatency.toFixed(2)}ms`);
    });

    it('should maintain performance with rapid successive requests', async () => {
      const numRapidRequests = 10;
      const requests = [];

      // Setup fast mocks for rapid testing
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          results: { channels: [{ alternatives: [{ transcript: 'Rapid test' }] }] }
        };
      });

      const mockInstance = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 200));
              return {
                choices: [{ message: { content: JSON.stringify({
                  intent: 'booking', confidence: 0.9, entities: {}, rawText: 'Rapid test'
                })}}]
              };
            })
          }
        }
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      mockDeepgramClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { getStream: () => createMockAudioStream() };
      });

      // Fire requests in rapid succession
      for (let i = 0; i < numRapidRequests; i++) {
        requests.push(
          measureExecutionTime(async () => {
            const transcript = await sttService.getTranscription(Buffer.from(`rapid-${i}`));
            const intentResult = await detectIntent(transcript);
            const response = await generateResponse('greeting', {});
            const audioStream = await getSpeech(response);
            return { requestIndex: i, transcript, intentResult, response, audioStream };
          })
        );
        
        // Small delay between requests to simulate rapid but realistic timing
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const results = await Promise.all(requests);
      
      // All requests should complete successfully
      expect(results).toHaveLength(numRapidRequests);
      
      // Performance should remain reasonable
      results.forEach(({ timeMs }, index) => {
        expect(timeMs).toBeLessThan(1000); // Should be faster due to rapid execution
        console.log(`Rapid request ${index}: ${timeMs.toFixed(2)}ms`);
      });

      const totalTime = results.reduce((sum, { timeMs }) => sum + timeMs, 0);
      const avgTime = totalTime / results.length;
      expect(avgTime).toBeLessThan(800); // Average should be good for rapid requests
      console.log(`Rapid requests average: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Performance Regression Testing', () => {
    it('should not regress below baseline performance', async () => {
      const baselineTargets = {
        stt: 500,      // 500ms STT target
        llm: 800,      // 800ms LLM target  
        tts: 400,      // 400ms TTS target
        pipeline: 1500 // 1.5s end-to-end target
      };

      // Test STT performance
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 180));
        return {
          results: { channels: [{ alternatives: [{ transcript: 'Baseline test' }] }] }
        };
      });

      const { timeMs: sttTime } = await measureExecutionTime(() =>
        sttService.getTranscription(Buffer.from('baseline audio'))
      );

      // Test LLM performance
      const mockInstance = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 450));
              return {
                choices: [{ message: { content: JSON.stringify({
                  intent: 'booking', confidence: 0.9, entities: {}, rawText: 'Baseline test'
                })}}]
              };
            })
          }
        }
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      const { timeMs: llmTime } = await measureExecutionTime(() =>
        detectIntent('Baseline test')
      );

      // Test TTS performance
      mockDeepgramClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 220));
        return { getStream: () => createMockAudioStream() };
      });

      const { timeMs: ttsTime } = await measureExecutionTime(() =>
        getSpeech('Baseline response')
      );

      // Test full pipeline performance
      const { timeMs: pipelineTime } = await measureExecutionTime(async () => {
        const transcript = await sttService.getTranscription(Buffer.from('pipeline test'));
        const intentResult = await detectIntent(transcript);
        const response = await generateResponse('greeting', {});
        const audioStream = await getSpeech(response);
        return { transcript, intentResult, response, audioStream };
      });

      // Verify all components meet baseline targets
      expect(sttTime).toBeLessThan(baselineTargets.stt);
      expect(llmTime).toBeLessThan(baselineTargets.llm);
      expect(ttsTime).toBeLessThan(baselineTargets.tts);
      expect(pipelineTime).toBeLessThan(baselineTargets.pipeline);

      // Log performance metrics for monitoring
      console.log('Performance Baseline Results:');
      console.log(`STT: ${sttTime.toFixed(2)}ms (target: ${baselineTargets.stt}ms)`);
      console.log(`LLM: ${llmTime.toFixed(2)}ms (target: ${baselineTargets.llm}ms)`);
      console.log(`TTS: ${ttsTime.toFixed(2)}ms (target: ${baselineTargets.tts}ms)`);
      console.log(`Pipeline: ${pipelineTime.toFixed(2)}ms (target: ${baselineTargets.pipeline}ms)`);

      // Performance score calculation (lower is better)
      const performanceScore = (sttTime + llmTime + ttsTime) / 3;
      expect(performanceScore).toBeLessThan(600); // Average component time should be <600ms
      console.log(`Overall Performance Score: ${performanceScore.toFixed(2)}ms`);
    });
  });
});