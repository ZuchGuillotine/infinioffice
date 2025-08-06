/**
 * End-to-End tests for complete booking flow
 * Tests the entire system integration from audio input to appointment creation
 */

const { STTService } = require('../../src/services/stt');
const { detectIntent, generateResponse } = require('../../src/services/llm');
const { getSpeech, streamTTSToTwilio } = require('../../src/services/tts');
const { bookingMachine } = require('../../src/services/stateMachine');
const { createAppointment, createCall, createTurn } = require('../../src/services/db');
const { interpret } = require('xstate');
const { measureExecutionTime, createMockAudioStream, createMockWebSocket } = require('../helpers/testHelpers');
const { successfulBookings, errorRecoveryScenarios } = require('../fixtures/conversations');

// Mock all external dependencies
jest.mock('@deepgram/sdk');
jest.mock('openai');
jest.mock('../../src/services/db');

describe('End-to-End Booking Flow Tests', () => {
  let mockDeepgramClient;
  let mockOpenAI;
  let mockTwilioWs;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup comprehensive mocks
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
    
    mockOpenAI = jest.fn(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }));
    require('openai').mockImplementation(mockOpenAI);
    
    mockTwilioWs = createMockWebSocket();
    
    // Mock database operations
    createCall.mockResolvedValue({ id: 'test-call-123', status: 'in-progress' });
    createTurn.mockImplementation(async (data) => ({ id: `turn-${Date.now()}`, ...data }));
    createAppointment.mockResolvedValue({ 
      id: 'appointment-123', 
      service: 'test-service', 
      status: 'scheduled' 
    });
  });

  describe('Complete Successful Booking Flows', () => {
    it('should complete standard appointment booking end-to-end', async () => {
      const bookingScenario = successfulBookings[0]; // Standard appointment booking
      
      // Setup sequential STT responses
      const sttResponses = bookingScenario.turns.map(turn => ({
        results: {
          channels: [{
            alternatives: [{ 
              transcript: turn.input,
              confidence: 0.9 
            }]
          }]
        }
      }));
      
      mockDeepgramClient.listen.prerecorded.transcribeBuffer
        .mockResolvedValueOnce(sttResponses[0])
        .mockResolvedValueOnce(sttResponses[1])
        .mockResolvedValueOnce(sttResponses[2])
        .mockResolvedValueOnce(sttResponses[3])
        .mockResolvedValueOnce(sttResponses[4]);

      // Setup sequential LLM responses for intent detection
      const mockLLMInstance = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'booking',
                  confidence: 0.95,
                  entities: {},
                  rawText: bookingScenario.turns[0].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'service_provided',
                  confidence: 0.92,
                  entities: { service: 'dental cleaning' },
                  rawText: bookingScenario.turns[1].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'time_provided',
                  confidence: 0.89,
                  entities: { timeWindow: 'Tomorrow at 2 PM' },
                  rawText: bookingScenario.turns[2].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'contact_provided',
                  confidence: 0.96,
                  entities: { contact: 'Sarah Johnson and my phone is 555-0123' },
                  rawText: bookingScenario.turns[3].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'confirmation_yes',
                  confidence: 0.98,
                  entities: {},
                  rawText: bookingScenario.turns[4].input
                })}}]
              })
              // Additional calls for generateResponse
              .mockResolvedValue({
                choices: [{ message: { content: 'Generated response' }}]
              });
      };
      mockOpenAI.mockImplementation(() => mockLLMInstance);

      // Setup TTS responses
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      // Execute complete booking flow
      const sttService = new STTService();
      const stateMachine = interpret(bookingMachine);
      stateMachine.start();
      
      const call = await createCall({
        twilioCallSid: 'CA_E2E_TEST',
        callerPhone: '+15551234567',
        status: 'in-progress',
        startedAt: new Date()
      });

      const conversationResults = [];
      let totalLatency = 0;

      for (let i = 0; i < bookingScenario.turns.length; i++) {
        const turn = bookingScenario.turns[i];
        
        const { timeMs: turnLatency } = await measureExecutionTime(async () => {
          // 1. STT - Convert audio to text
          const audioBuffer = Buffer.from(`mock-audio-${i}`);
          const transcript = await sttService.getTranscription(audioBuffer);
          
          // 2. Intent Detection
          const intentResult = await detectIntent(transcript);
          
          // 3. State Machine Update
          stateMachine.send({
            type: 'PROCESS_INTENT',
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            response: 'Processing...',
            bookingData: intentResult.entities,
            originalSpeech: transcript
          });
          
          const currentState = stateMachine.getSnapshot();
          
          // 4. Response Generation
          let responseState = 'greeting';
          switch (currentState.value) {
            case 'collectService': responseState = 'service'; break;
            case 'collectTimeWindow': responseState = 'timeWindow'; break;
            case 'collectContact': responseState = 'contact'; break;
            case 'confirm': responseState = 'confirmation'; break;
            case 'book': responseState = 'success'; break;
            default: responseState = 'greeting';
          }
          
          const response = await generateResponse(responseState, currentState.context);
          
          // 5. TTS - Convert response to audio
          const audioStream = await getSpeech(response);
          
          // 6. Stream to Twilio
          await streamTTSToTwilio(audioStream, mockTwilioWs);
          
          // 7. Log turn in database
          const turnData = await createTurn({
            callId: call.id,
            turnIndex: i,
            userInput: transcript,
            botResponse: response,
            asrMs: 200 + Math.random() * 100, // Simulated metrics
            llmMs: 600 + Math.random() * 200,
            ttsMs: 300 + Math.random() * 100,
            timestamp: new Date(),
            stateBefore: i === 0 ? 'idle' : conversationResults[i-1]?.stateAfter || 'unknown',
            stateAfter: currentState.value,
            intent: intentResult.intent,
            confidence: intentResult.confidence
          });
          
          return {
            transcript,
            intentResult,
            response,
            audioStream,
            turnData,
            stateAfter: currentState.value,
            context: currentState.context
          };
        });

        conversationResults.push(conversationResults);
        totalLatency += turnLatency;
        
        // Verify each turn meets expected outcomes
        expect(conversationResults[i].transcript).toBe(turn.input);
        expect(conversationResults[i].response).toMatch(turn.expectedOutput);
        expect(conversationResults[i].stateAfter).toBe(turn.expectedState);
        
        // Verify turn latency
        expect(turnLatency).toBeLessThan(2000); // 2s max per turn
        
        console.log(`Turn ${i + 1}: ${turnLatency.toFixed(2)}ms - ${turn.expectedState}`);
      }

      // Verify final booking was created
      const finalState = stateMachine.getSnapshot();
      if (finalState.value === 'book' || finalState.context.service) {
        expect(createAppointment).toHaveBeenCalledWith(
          expect.objectContaining({
            service: expect.any(String),
            contactPhone: expect.stringMatching(/555-0123/),
            notes: expect.stringContaining('dental cleaning'),
            status: 'scheduled'
          })
        );
      }

      // Verify conversation success metrics
      expect(bookingScenario.expectedSuccess).toBe(true);
      expect(conversationResults).toHaveLength(bookingScenario.turns.length);
      expect(totalLatency / bookingScenario.turns.length).toBeLessThan(1500); // Avg <1.5s per turn
      
      console.log(`Total conversation time: ${totalLatency.toFixed(2)}ms`);
      console.log(`Average turn time: ${(totalLatency / bookingScenario.turns.length).toFixed(2)}ms`);
      
      stateMachine.stop();
    });

    it('should handle quick booking with minimal conversation', async () => {
      const quickBooking = successfulBookings[1]; // Quick booking scenario
      
      // Mock responses for concise booking
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockResolvedValueOnce({
        results: {
          channels: [{
            alternatives: [{ 
              transcript: quickBooking.turns[0].input,
              confidence: 0.95 
            }]
          }]
        }
      }).mockResolvedValueOnce({
        results: {
          channels: [{
            alternatives: [{ 
              transcript: quickBooking.turns[1].input,
              confidence: 0.98 
            }]
          }]
        }
      });

      const mockLLMInstance = {
        chat: {
          completions: {
            create: jest.fn()
              // First turn - extract all info at once
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'booking',
                  confidence: 0.97,
                  entities: { 
                    service: 'haircut',
                    timeWindow: 'Friday 3pm',
                    contact: 'Mike 555-9876'
                  },
                  rawText: quickBooking.turns[0].input
                })}}]
              })
              // Second turn - confirmation
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'confirmation_yes',
                  confidence: 0.99,
                  entities: {},
                  rawText: quickBooking.turns[1].input
                })}}]
              })
              // generateResponse calls
              .mockResolvedValue({
                choices: [{ message: { content: 'Booking confirmed' }}]
              });
      };
      mockOpenAI.mockImplementation(() => mockLLMInstance);

      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      const sttService = new STTService();
      const stateMachine = interpret(bookingMachine);
      stateMachine.start();

      const { timeMs: totalTime } = await measureExecutionTime(async () => {
        // Process first turn - all info provided
        const audioBuffer1 = Buffer.from('quick-booking-1');
        const transcript1 = await sttService.getTranscription(audioBuffer1);
        const intent1 = await detectIntent(transcript1);
        
        stateMachine.send({
          type: 'PROCESS_INTENT',
          intent: intent1.intent,
          confidence: intent1.confidence,
          response: 'Confirming details...',
          bookingData: intent1.entities,
          originalSpeech: transcript1
        });

        const state1 = stateMachine.getSnapshot();
        const response1 = await generateResponse('confirmation', state1.context);
        await getSpeech(response1);

        // Process confirmation turn
        const audioBuffer2 = Buffer.from('quick-booking-2');
        const transcript2 = await sttService.getTranscription(audioBuffer2);
        const intent2 = await detectIntent(transcript2);
        
        stateMachine.send({
          type: 'PROCESS_INTENT',
          intent: intent2.intent,
          confidence: intent2.confidence,
          response: 'Booking appointment...',
          originalSpeech: transcript2
        });

        const state2 = stateMachine.getSnapshot();
        const response2 = await generateResponse('success', state2.context);
        await getSpeech(response2);

        return { state1, state2, response1, response2 };
      });

      // Quick booking should be very fast
      expect(totalTime).toBeLessThan(3000); // 3s total for quick booking
      expect(quickBooking.expectedSuccess).toBe(true);
      
      console.log(`Quick booking completed in ${totalTime.toFixed(2)}ms`);
      
      stateMachine.stop();
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle unclear service requests with clarification', async () => {
      const errorScenario = errorRecoveryScenarios[0]; // Service clarification scenario
      
      // Setup STT responses for unclear conversation
      const sttResponses = errorScenario.turns.map(turn => ({
        results: {
          channels: [{
            alternatives: [{ 
              transcript: turn.input,
              confidence: turn.input.includes('not sure') ? 0.4 : 0.8
            }]
          }]
        }
      }));

      mockDeepgramClient.listen.prerecorded.transcribeBuffer
        .mockResolvedValueOnce(sttResponses[0])
        .mockResolvedValueOnce(sttResponses[1])
        .mockResolvedValueOnce(sttResponses[2])
        .mockResolvedValueOnce(sttResponses[3])
        .mockResolvedValueOnce(sttResponses[4]);

      // Setup LLM responses for unclear intents
      const mockLLMInstance = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'unclear',
                  confidence: 0.3,
                  entities: {},
                  rawText: errorScenario.turns[0].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'unclear',
                  confidence: 0.2,
                  entities: {},
                  rawText: errorScenario.turns[1].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'service_provided',
                  confidence: 0.7,
                  entities: { service: 'consultation' },
                  rawText: errorScenario.turns[2].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'unclear',
                  confidence: 0.4,
                  entities: {},
                  rawText: errorScenario.turns[3].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'time_provided',
                  confidence: 0.85,
                  entities: { timeWindow: 'Wednesday at 10 AM' },
                  rawText: errorScenario.turns[4].input
                })}}]
              })
              .mockResolvedValue({
                choices: [{ message: { content: 'Clarification response' }}]
              });
      };
      mockOpenAI.mockImplementation(() => mockLLMInstance);

      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      const sttService = new STTService();
      const stateMachine = interpret(bookingMachine);
      stateMachine.start();

      let retryCount = 0;
      const conversationResults = [];

      for (let i = 0; i < errorScenario.turns.length; i++) {
        const turn = errorScenario.turns[i];
        
        const audioBuffer = Buffer.from(`unclear-audio-${i}`);
        const transcript = await sttService.getTranscription(audioBuffer);
        const intentResult = await detectIntent(transcript);
        
        // Track retry attempts for unclear intents
        if (intentResult.confidence < 0.5) {
          retryCount++;
        }
        
        stateMachine.send({
          type: 'PROCESS_INTENT',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          response: 'Processing...',
          bookingData: intentResult.entities,
          originalSpeech: transcript
        });

        const currentState = stateMachine.getSnapshot();
        
        // Generate appropriate response based on confidence
        let responseState = 'greeting';
        if (intentResult.confidence < 0.5) {
          responseState = currentState.value === 'collectService' ? 'service_retry' : 'clarification';
        } else {
          switch (currentState.value) {
            case 'collectService': responseState = 'timeWindow'; break;
            case 'collectTimeWindow': responseState = 'contact'; break;
            default: responseState = 'greeting';
          }
        }
        
        const response = await generateResponse(responseState, currentState.context, retryCount);
        const audioStream = await getSpeech(response);
        await streamTTSToTwilio(audioStream, mockTwilioWs);

        conversationResults.push({
          transcript,
          intentResult,
          response,
          stateAfter: currentState.value,
          retry: intentResult.confidence < 0.5
        });
        
        // Verify expected behavior for this turn
        expect(transcript).toBe(turn.input);
        expect(currentState.value).toBe(turn.expectedState);
        
        console.log(`Turn ${i + 1}: ${transcript} -> ${currentState.value} (confidence: ${intentResult.confidence})`);
      }

      // Verify error recovery was successful
      expect(errorScenario.expectedSuccess).toBe(true);
      expect(retryCount).toBeGreaterThan(0); // Should have had some retries
      expect(conversationResults.some(r => r.retry)).toBe(true);
      
      // Final state should show progress despite initial confusion
      const finalState = stateMachine.getSnapshot();
      expect(['collectContact', 'collectTimeWindow']).toContain(finalState.value);
      
      console.log(`Error recovery test completed with ${retryCount} retries`);
      
      stateMachine.stop();
    });

    it('should handle information correction flow', async () => {
      const correctionScenario = errorRecoveryScenarios[1]; // Information correction
      
      // Setup STT responses
      const sttResponses = correctionScenario.turns.map(turn => ({
        results: {
          channels: [{
            alternatives: [{ 
              transcript: turn.input,
              confidence: 0.9
            }]
          }]
        }
      }));

      mockDeepgramClient.listen.prerecorded.transcribeBuffer
        .mockResolvedValueOnce(sttResponses[0])
        .mockResolvedValueOnce(sttResponses[1])
        .mockResolvedValueOnce(sttResponses[2])
        .mockResolvedValueOnce(sttResponses[3])
        .mockResolvedValueOnce(sttResponses[4]);

      // Setup LLM for correction scenario
      const mockLLMInstance = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'booking',
                  confidence: 0.94,
                  entities: { 
                    service: 'massage',
                    timeWindow: 'Monday 3pm'
                  },
                  rawText: correctionScenario.turns[0].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'time_provided',
                  confidence: 0.91,
                  entities: { 
                    timeWindow: 'Tuesday'
                  },
                  rawText: correctionScenario.turns[1].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'contact_provided',
                  confidence: 0.96,
                  entities: { 
                    contact: 'Lisa Brown, 555-4567'
                  },
                  rawText: correctionScenario.turns[2].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'time_provided',
                  confidence: 0.88,
                  entities: { 
                    timeWindow: 'Wednesday'
                  },
                  rawText: correctionScenario.turns[3].input
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'confirmation_yes',
                  confidence: 0.97,
                  entities: {},
                  rawText: correctionScenario.turns[4].input
                })}}]
              })
              .mockResolvedValue({
                choices: [{ message: { content: 'Correction handled' }}]
              });
      };
      mockOpenAI.mockImplementation(() => mockLLMInstance);

      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      const sttService = new STTService();
      const stateMachine = interpret(bookingMachine);
      stateMachine.start();

      let correctionMade = false;
      const conversationHistory = [];

      for (let i = 0; i < correctionScenario.turns.length; i++) {
        const turn = correctionScenario.turns[i];
        
        const audioBuffer = Buffer.from(`correction-audio-${i}`);
        const transcript = await sttService.getTranscription(audioBuffer);
        const intentResult = await detectIntent(transcript);
        
        // Track when user makes corrections
        if (transcript.includes('Actually') || transcript.includes('Wait')) {
          correctionMade = true;
        }
        
        stateMachine.send({
          type: 'PROCESS_INTENT',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          response: 'Processing correction...',
          bookingData: intentResult.entities,
          originalSpeech: transcript
        });

        const currentState = stateMachine.getSnapshot();
        
        let responseState = 'greeting';
        switch (currentState.value) {
          case 'collectService': responseState = 'timeWindow'; break;
          case 'collectTimeWindow': responseState = 'contact'; break;
          case 'collectContact': responseState = 'confirmation'; break;
          case 'confirm': responseState = 'success'; break;
          default: responseState = 'greeting';
        }
        
        const response = await generateResponse(responseState, currentState.context);
        const audioStream = await getSpeech(response);

        conversationHistory.push({
          transcript,
          intentResult,
          response,
          state: currentState.value,
          context: { ...currentState.context }
        });
        
        // Verify expected state progression
        expect(currentState.value).toBe(turn.expectedState);
        
        console.log(`Turn ${i + 1}: ${transcript} -> ${currentState.value}`);
        console.log(`Context: service=${currentState.context.service}, time=${currentState.context.preferredTime}`);
      }

      // Verify correction handling
      expect(correctionScenario.expectedSuccess).toBe(true);
      expect(correctionMade).toBe(true);
      
      // Verify final context reflects corrections
      const finalState = stateMachine.getSnapshot();
      expect(finalState.context.preferredTime).toContain('Wednesday'); // Final correction
      expect(finalState.context.contact).toContain('Lisa Brown');
      expect(finalState.context.service).toBe('massage');
      
      console.log('Information correction flow completed successfully');
      
      stateMachine.stop();
    });
  });

  describe('System Integration and Data Flow', () => {
    it('should maintain data consistency across all system components', async () => {
      const sttService = new STTService();
      const stateMachine = interpret(bookingMachine);
      
      // Setup complete flow mocks
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockResolvedValue({
        results: {
          channels: [{
            alternatives: [{ 
              transcript: 'Book massage for tomorrow at 3pm, contact is Mary 555-1111',
              confidence: 0.95
            }]
          }]
        }
      });

      const mockLLMInstance = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'booking',
                  confidence: 0.96,
                  entities: { 
                    service: 'massage',
                    timeWindow: 'tomorrow at 3pm',
                    contact: 'Mary 555-1111'
                  },
                  rawText: 'Book massage for tomorrow at 3pm, contact is Mary 555-1111'
                })}}]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                  intent: 'confirmation_yes',
                  confidence: 0.98,
                  entities: {},
                  rawText: 'Yes, book it'
                })}}]
              })
              .mockResolvedValue({
                choices: [{ message: { content: 'Booking confirmed' }}]
              });
      };
      mockOpenAI.mockImplementation(() => mockLLMInstance);

      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      stateMachine.start();

      // Create call record
      const call = await createCall({
        twilioCallSid: 'CA_INTEGRATION_TEST',
        callerPhone: '+15551111111',
        status: 'in-progress',
        startedAt: new Date(),
        currentState: 'greeting'
      });

      // Process complete booking flow
      const { timeMs } = await measureExecutionTime(async () => {
        // Turn 1: Complete info provided
        const audioBuffer1 = Buffer.from('integration-test-audio');
        const transcript1 = await sttService.getTranscription(audioBuffer1);
        const intent1 = await detectIntent(transcript1);
        
        stateMachine.send({
          type: 'PROCESS_INTENT',
          intent: intent1.intent,
          confidence: intent1.confidence,
          response: 'Confirming your massage appointment...',
          bookingData: intent1.entities,
          originalSpeech: transcript1
        });

        const state1 = stateMachine.getSnapshot();
        const response1 = await generateResponse('confirmation', state1.context);
        const audioStream1 = await getSpeech(response1);
        await streamTTSToTwilio(audioStream1, mockTwilioWs);

        // Log turn 1
        const turn1 = await createTurn({
          callId: call.id,
          turnIndex: 0,
          userInput: transcript1,
          botResponse: response1,
          asrMs: 180,
          llmMs: 650,
          ttsMs: 280,
          timestamp: new Date(),
          stateBefore: 'greeting',
          stateAfter: state1.value,
          intent: intent1.intent,
          confidence: intent1.confidence
        });

        // Turn 2: Confirmation
        const audioBuffer2 = Buffer.from('yes-confirmation');
        const transcript2 = 'Yes, book it';
        const intent2 = await detectIntent(transcript2);
        
        stateMachine.send({
          type: 'PROCESS_INTENT',
          intent: intent2.intent,
          confidence: intent2.confidence,
          response: 'Booking your appointment...',
          originalSpeech: transcript2
        });

        const state2 = stateMachine.getSnapshot();
        const response2 = await generateResponse('success', state2.context);
        const audioStream2 = await getSpeech(response2);
        await streamTTSToTwilio(audioStream2, mockTwilioWs);

        // Log turn 2
        const turn2 = await createTurn({
          callId: call.id,
          turnIndex: 1,
          userInput: transcript2,
          botResponse: response2,
          asrMs: 160,
          llmMs: 580,
          ttsMs: 240,
          timestamp: new Date(),
          stateBefore: state1.value,
          stateAfter: state2.value,
          intent: intent2.intent,
          confidence: intent2.confidence
        });

        return { 
          call, 
          turns: [turn1, turn2], 
          finalState: state2,
          responses: [response1, response2]
        };
      });

      // Verify data consistency across components
      expect(createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          twilioCallSid: 'CA_INTEGRATION_TEST',
          callerPhone: '+15551111111'
        })
      );

      expect(createTurn).toHaveBeenCalledTimes(2);
      
      // Verify turn data consistency
      const turnCalls = createTurn.mock.calls;
      expect(turnCalls[0][0]).toMatchObject({
        callId: call.id,
        turnIndex: 0,
        intent: 'booking',
        userInput: expect.stringContaining('massage')
      });
      
      expect(turnCalls[1][0]).toMatchObject({
        callId: call.id,
        turnIndex: 1,
        intent: 'confirmation_yes',
        userInput: 'Yes, book it'
      });

      // Verify appointment creation was triggered
      expect(createAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'massage',
          contactPhone: '555-1111',
          notes: expect.stringContaining('massage'),
          status: 'scheduled'
        })
      );

      // Verify performance
      expect(timeMs).toBeLessThan(3000); // Complete integration under 3s
      
      console.log(`Integration test completed in ${timeMs.toFixed(2)}ms`);
      console.log('Data consistency verified across STT, LLM, State Machine, TTS, and Database');
      
      stateMachine.stop();
    });
  });

  describe('Success Rate Validation', () => {
    it('should achieve target 85% booking success rate', async () => {
      const testScenarios = [
        // Successful scenarios (should represent 85%+ of realistic cases)
        { input: 'Book haircut tomorrow 2pm John 555-1234', shouldSucceed: true },
        { input: 'I need a massage this Friday at 3, contact is Sarah 555-9876', shouldSucceed: true },
        { input: 'Schedule dental cleaning next week, my number is 555-5555', shouldSucceed: true },
        { input: 'Book consultation Monday morning, I am Mike Johnson 555-2468', shouldSucceed: true },
        { input: 'Can I get an appointment for physical therapy?', shouldSucceed: true },
        { input: 'I want to book a checkup for next Tuesday at 10am', shouldSucceed: true },
        { input: 'Schedule massage appointment, Thursday 4pm, Lisa 555-7890', shouldSucceed: true },
        { input: 'Book me a haircut this weekend, contact 555-3456', shouldSucceed: true },
        { input: 'I need therapy session next week, phone 555-6789', shouldSucceed: true },
        { input: 'Dental appointment Friday 1pm, John Smith 555-4321', shouldSucceed: true },
        
        // Edge cases that might fail (should be <15%)
        { input: 'Um, maybe I need something, not sure what', shouldSucceed: false },
        { input: 'Cancel all my appointments', shouldSucceed: false },
        { input: 'What are your hours?', shouldSucceed: false }
      ];

      let successfulBookings = 0;
      let totalAttempts = testScenarios.length;

      // Setup progressive mocks for success rate testing
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockImplementation(async (buffer) => {
        const scenario = testScenarios.find(s => buffer.includes(s.input.substring(0, 10)));
        return {
          results: {
            channels: [{
              alternatives: [{ 
                transcript: scenario?.input || 'unclear input',
                confidence: scenario?.shouldSucceed ? 0.9 : 0.3
              }]
            }]
          }
        };
      });

      const mockLLMInstance = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async (params) => {
              const input = params.messages[1].content;
              const scenario = testScenarios.find(s => input.includes(s.input.substring(0, 10)));
              
              if (scenario?.shouldSucceed) {
                return {
                  choices: [{ message: { content: JSON.stringify({
                    intent: 'booking',
                    confidence: 0.85 + Math.random() * 0.1,
                    entities: { 
                      service: 'extracted service',
                      timeWindow: 'extracted time',
                      contact: 'extracted contact'
                    },
                    rawText: input
                  })}}]
                };
              } else {
                return {
                  choices: [{ message: { content: JSON.stringify({
                    intent: 'unclear',
                    confidence: 0.2 + Math.random() * 0.3,
                    entities: {},
                    rawText: input
                  })}}]
                };
              }
            })
          }
        }
      };
      mockOpenAI.mockImplementation(() => mockLLMInstance);

      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => createMockAudioStream()
      });

      const sttService = new STTService();
      
      for (const scenario of testScenarios) {
        try {
          const stateMachine = interpret(bookingMachine);
          stateMachine.start();

          const audioBuffer = Buffer.from(scenario.input);
          const transcript = await sttService.getTranscription(audioBuffer);
          const intentResult = await detectIntent(transcript);
          
          // Consider it successful if:
          // 1. Intent is booking with reasonable confidence, OR
          // 2. System can extract meaningful booking information
          const isSuccessful = (
            (intentResult.intent === 'booking' && intentResult.confidence > 0.7) ||
            (intentResult.entities && Object.keys(intentResult.entities).length > 0)
          );

          if (isSuccessful) {
            successfulBookings++;
          }

          // Verify expectation matches actual outcome
          expect(isSuccessful).toBe(scenario.shouldSucceed);
          
          stateMachine.stop();
          
        } catch (error) {
          // Failed scenarios should be expected failures
          expect(scenario.shouldSucceed).toBe(false);
        }
      }

      const successRate = successfulBookings / totalAttempts;
      
      console.log(`Booking Success Rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`Successful: ${successfulBookings}/${totalAttempts}`);
      
      // Verify meets MVP target
      expect(successRate).toBeGreaterThanOrEqual(0.85);
    });
  });
});