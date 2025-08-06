/**
 * Integration tests for the complete voice pipeline: STT → LLM → TTS
 * Tests the coordination between services and data flow
 */

const { getTranscription } = require('../../src/services/stt');
const { getCompletion } = require('../../src/services/llm');
const { getSpeech } = require('../../src/services/tts');
const { bookingMachine } = require('../../src/services/stateMachine');
const { interpret } = require('xstate');
const { 
  createMockAudioStream,
  createMockSTTResponse,
  createMockLLMResponse,
  createMockTTSResponse,
  measureExecutionTime
} = require('../helpers/testHelpers');
const { 
  mockDeepgramSTT,
  mockOpenAI,
  mockDeepgramTTS 
} = require('../mocks/services');

// Mock all services
jest.mock('@deepgram/sdk', () => ({
  ...mockDeepgramSTT,
  createClient: mockDeepgramTTS.createClient
}));
jest.mock('openai', () => mockOpenAI);

describe('Voice Pipeline Integration', () => {
  let mockDeepgramSocket;
  let mockOpenAIInstance;
  let mockDeepgramTTSClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup STT mock
    mockDeepgramSocket = {
      on: jest.fn(),
      send: jest.fn()
    };
    
    require('@deepgram/sdk').Deepgram.mockImplementation(() => ({
      transcription: {
        live: jest.fn(() => mockDeepgramSocket)
      }
    }));

    // Setup LLM mock
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    mockOpenAI.mockImplementation(() => mockOpenAIInstance);

    // Setup TTS mock
    mockDeepgramTTSClient = {
      speak: {
        request: jest.fn()
      }
    };
    mockDeepgramTTS.createClient.mockImplementation(() => mockDeepgramTTSClient);
  });

  describe('Complete Voice Processing Chain', () => {
    it('should process audio through complete STT → LLM → TTS pipeline', async () => {
      // Setup mocks
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(
        createMockLLMResponse('What service would you like to book?')
      );
      
      mockDeepgramTTSClient.speak.request.mockResolvedValue(
        createMockTTSResponse()
      );

      // 1. STT: Process audio input
      const audioStream = createMockAudioStream();
      const transcriptionPromise = getTranscription(audioStream);
      
      // Simulate STT processing
      const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
      openHandler();
      
      const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      messageHandler(JSON.stringify(
        createMockSTTResponse('I need to book an appointment', true)
      ));
      
      const transcription = await transcriptionPromise;
      expect(transcription).toBe('I need to book an appointment');

      // 2. LLM: Generate response
      const llmResponse = await getCompletion(transcription);
      expect(llmResponse).toBe('What service would you like to book?');

      // 3. TTS: Convert response to audio
      const audioResponse = await getSpeech(llmResponse);
      expect(audioResponse).toBeDefined();

      // Verify the complete chain
      expect(mockDeepgramSocket.send).toHaveBeenCalled();
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: 'I need to book an appointment'
            })
          ])
        })
      );
      expect(mockDeepgramTTSClient.speak.request).toHaveBeenCalledWith(
        { text: 'What service would you like to book?' },
        expect.any(Object)
      );
    });

    it('should measure end-to-end pipeline latency', async () => {
      // Setup realistic latencies
      mockOpenAIInstance.chat.completions.create.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 600)); // 600ms LLM
        return createMockLLMResponse('How can I help you?');
      });
      
      mockDeepgramTTSClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms TTS
        return createMockTTSResponse();
      });

      const result = await measureExecutionTime(async () => {
        // STT
        const audioStream = createMockAudioStream();
        const transcriptionPromise = getTranscription(audioStream);
        
        setTimeout(() => {
          const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
          openHandler();
          
          setTimeout(() => {
            const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
            messageHandler(JSON.stringify(createMockSTTResponse('Hello', true)));
          }, 150); // 150ms STT
        }, 10);
        
        const transcription = await transcriptionPromise;
        
        // LLM
        const llmResponse = await getCompletion(transcription);
        
        // TTS
        const audioResponse = await getSpeech(llmResponse);
        
        return { transcription, llmResponse, audioResponse };
      });

      expect(result.result.transcription).toBe('Hello');
      expect(result.result.llmResponse).toBe('How can I help you?');
      expect(result.result.audioResponse).toBeDefined();
      
      // Total pipeline should be under target latency (1.5s)
      expect(result.timeMs).toBeLessThan(1500);
    });

    it('should handle concurrent voice pipeline requests', async () => {
      const numConcurrent = 5;
      
      // Setup mocks for concurrent requests
      mockOpenAIInstance.chat.completions.create.mockImplementation(async (params) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return createMockLLMResponse(`Response to: ${params.messages[1].content}`);
      });
      
      mockDeepgramTTSClient.speak.request.mockImplementation(async (params) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return createMockTTSResponse();
      });

      // Create multiple concurrent pipeline requests
      const pipelinePromises = Array.from({ length: numConcurrent }, async (_, index) => {
        const audioStream = createMockAudioStream();
        const transcriptionPromise = getTranscription(audioStream);
        
        // Simulate STT response
        setTimeout(() => {
          const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
          if (openHandler) openHandler();
          
          setTimeout(() => {
            const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
            if (messageHandler) {
              messageHandler(JSON.stringify(
                createMockSTTResponse(`Request ${index}`, true)
              ));
            }
          }, 50);
        }, 10);
        
        const transcription = await transcriptionPromise;
        const llmResponse = await getCompletion(transcription);
        const audioResponse = await getSpeech(llmResponse);
        
        return { transcription, llmResponse, audioResponse, index };
      });

      const start = Date.now();
      const results = await Promise.all(pipelinePromises);
      const duration = Date.now() - start;

      // All requests should complete
      expect(results).toHaveLength(numConcurrent);
      
      // Should handle concurrently (faster than sequential)
      expect(duration).toBeLessThan(numConcurrent * 500);
      
      // Verify all results
      results.forEach((result, index) => {
        expect(result.transcription).toBe(`Request ${index}`);
        expect(result.llmResponse).toBe(`Response to: Request ${index}`);
        expect(result.audioResponse).toBeDefined();
      });
    });
  });

  describe('Pipeline with State Machine Integration', () => {
    it('should coordinate voice pipeline with state machine transitions', async () => {
      const service = interpret(bookingMachine);
      service.start();

      // Setup conversation flow with pipeline
      const conversationTurns = [
        {
          input: 'Hello, I need an appointment',
          expectedLLMResponse: 'What service would you like to book?',
          expectedState: 'collectService'
        },
        {
          input: 'I need a dental cleaning',
          expectedLLMResponse: 'What time works for you?',
          expectedState: 'collectTimeWindow'
        },
        {
          input: 'Tomorrow at 2 PM',
          expectedLLMResponse: 'What\'s your contact information?',
          expectedState: 'collectContact'
        }
      ];

      for (const turn of conversationTurns) {
        // Mock LLM response for this turn
        mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(
          createMockLLMResponse(turn.expectedLLMResponse)
        );
        
        mockDeepgramTTSClient.speak.request.mockResolvedValueOnce(
          createMockTTSResponse()
        );

        // 1. Process audio through STT
        const audioStream = createMockAudioStream();
        const transcriptionPromise = getTranscription(audioStream);
        
        // Simulate STT processing
        setTimeout(() => {
          const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
          openHandler();
          
          const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
          messageHandler(JSON.stringify(
            createMockSTTResponse(turn.input, true)
          ));
        }, 10);
        
        const transcription = await transcriptionPromise;
        
        // 2. Update state machine
        service.send({
          type: 'HEAR_SPEECH',
          speech: transcription
        });
        
        // 3. Generate LLM response based on current state
        const llmResponse = await getCompletion(transcription);
        
        // 4. Convert response to speech
        const audioResponse = await getSpeech(llmResponse);
        
        // Verify state transition and responses
        expect(service.getSnapshot().value).toBe(turn.expectedState);
        expect(transcription).toBe(turn.input);
        expect(llmResponse).toBe(turn.expectedLLMResponse);
        expect(audioResponse).toBeDefined();
      }

      service.stop();
    });

    it('should maintain conversation context across pipeline iterations', async () => {
      const service = interpret(bookingMachine);
      service.start();

      // Simulate full conversation with context building
      const fullConversation = [
        { user: 'Hi there', bot: 'How can I help you?' },
        { user: 'Book haircut', bot: 'When would you like your haircut?' },
        { user: 'Friday 3pm', bot: 'What\'s your contact info?' },
        { user: 'John 555-1234', bot: 'Confirm: Haircut Friday 3pm for John 555-1234?' }
      ];

      for (let i = 0; i < fullConversation.length; i++) {
        const turn = fullConversation[i];
        
        // Mock responses
        mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(
          createMockLLMResponse(turn.bot)
        );
        
        mockDeepgramTTSClient.speak.request.mockResolvedValueOnce(
          createMockTTSResponse()
        );

        // Process user input
        const audioStream = createMockAudioStream();
        const transcriptionPromise = getTranscription(audioStream);
        
        setTimeout(() => {
          const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
          openHandler();
          
          const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
          messageHandler(JSON.stringify(createMockSTTResponse(turn.user, true)));
        }, 10);
        
        const transcription = await transcriptionPromise;
        
        // Update state machine with transcription
        service.send({ type: 'HEAR_SPEECH', speech: transcription });
        
        // Generate contextual response
        const llmResponse = await getCompletion(transcription);
        const audioResponse = await getSpeech(llmResponse);
        
        expect(transcription).toBe(turn.user);
        expect(llmResponse).toBe(turn.bot);
        
        // Check that context is building up
        const context = service.getSnapshot().context;
        if (i >= 1) expect(context.service).toBeTruthy();
        if (i >= 2) expect(context.timeWindow).toBeTruthy();
        if (i >= 3) expect(context.contact).toBeTruthy();
      }

      // Final context should contain all information
      const finalContext = service.getSnapshot().context;
      expect(finalContext.service).toBe('Book haircut');
      expect(finalContext.timeWindow).toBe('Friday 3pm');
      expect(finalContext.contact).toBe('John 555-1234');

      service.stop();
    });
  });

  describe('Pipeline Error Handling', () => {
    it('should handle STT failures gracefully', async () => {
      // Mock STT error
      const sttError = new Error('Deepgram STT service unavailable');
      
      const audioStream = createMockAudioStream();
      const transcriptionPromise = getTranscription(audioStream);
      
      // Simulate STT error
      setTimeout(() => {
        const errorHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'error')[1];
        errorHandler(sttError);
      }, 10);
      
      await expect(transcriptionPromise).rejects.toThrow('Deepgram STT service unavailable');
    });

    it('should handle LLM failures with fallback', async () => {
      // Mock LLM error
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API timeout')
      );

      await expect(getCompletion('Test input')).rejects.toThrow('OpenAI API timeout');
    });

    it('should handle TTS failures gracefully', async () => {
      // Mock TTS error
      mockDeepgramTTSClient.speak.request.mockRejectedValue(
        new Error('Deepgram TTS service unavailable')
      );

      await expect(getSpeech('Test text')).rejects.toThrow('Deepgram TTS service unavailable');
    });

    it('should handle partial pipeline failures', async () => {
      // STT succeeds
      const audioStream = createMockAudioStream();
      const transcriptionPromise = getTranscription(audioStream);
      
      setTimeout(() => {
        const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
        openHandler();
        
        const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
        messageHandler(JSON.stringify(createMockSTTResponse('Hello', true)));
      }, 10);
      
      const transcription = await transcriptionPromise;
      expect(transcription).toBe('Hello');

      // LLM fails
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('LLM service down')
      );

      await expect(getCompletion(transcription)).rejects.toThrow('LLM service down');
      
      // TTS should still be callable independently
      mockDeepgramTTSClient.speak.request.mockResolvedValue(createMockTTSResponse());
      const audioResponse = await getSpeech('Fallback message');
      expect(audioResponse).toBeDefined();
    });
  });

  describe('Pipeline Performance', () => {
    it('should maintain performance under load', async () => {
      const numRequests = 10;
      
      // Setup mocks with realistic delays
      mockOpenAIInstance.chat.completions.create.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return createMockLLMResponse('Response');
      });
      
      mockDeepgramTTSClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return createMockTTSResponse();
      });

      const start = Date.now();
      
      // Run multiple pipeline requests concurrently
      const results = await Promise.all(
        Array.from({ length: numRequests }, async (_, index) => {
          const audioStream = createMockAudioStream();
          const transcriptionPromise = getTranscription(audioStream);
          
          setTimeout(() => {
            const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
            openHandler();
            
            const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
            messageHandler(JSON.stringify(createMockSTTResponse(`Input ${index}`, true)));
          }, 10);
          
          const transcription = await transcriptionPromise;
          const llmResponse = await getCompletion(transcription);
          const audioResponse = await getSpeech(llmResponse);
          
          return { transcription, llmResponse, audioResponse };
        })
      );
      
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(numRequests);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      
      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.transcription).toBe(`Input ${index}`);
        expect(result.llmResponse).toBe('Response');
        expect(result.audioResponse).toBeDefined();
      });
    });
  });
});