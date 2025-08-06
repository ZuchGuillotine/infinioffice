
const { getTranscription } = require('../../src/services/stt');
const { Deepgram } = require('@deepgram/sdk');
const { createMockAudioStream, createMockSTTResponse } = require('../helpers/testHelpers');
const { mockDeepgramSTT } = require('../mocks/services');

// Mock the Deepgram SDK
jest.mock('@deepgram/sdk', () => mockDeepgramSTT);

describe('STT Service', () => {
  let mockDeepgramSocket;
  let mockStream;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock socket with event handlers
    mockDeepgramSocket = {
      on: jest.fn(),
      send: jest.fn()
    };
    
    // Setup mock audio stream
    mockStream = createMockAudioStream();
    
    // Configure mock to return our socket
    Deepgram.mockImplementation(() => ({
      transcription: {
        live: jest.fn(() => mockDeepgramSocket)
      }
    }));
  });

  describe('getTranscription', () => {
    it('should initialize Deepgram with correct API key', async () => {
      // Setup promise that will resolve when we call the message handler
      const transcriptionPromise = getTranscription(mockStream);
      
      // Simulate the socket opening
      const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
      openHandler();
      
      // Simulate receiving a final transcript
      const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      const mockResponse = createMockSTTResponse('Hello, I need an appointment', true);
      messageHandler(JSON.stringify(mockResponse));
      
      const result = await transcriptionPromise;
      
      expect(Deepgram).toHaveBeenCalledWith(process.env.DEEPGRAM_API_KEY);
      expect(result).toBe('Hello, I need an appointment');
    });

    it('should configure live transcription with correct parameters', () => {
      getTranscription(mockStream);
      
      const mockDeepgram = Deepgram.mock.results[0].value;
      expect(mockDeepgram.transcription.live).toHaveBeenCalledWith({
        model: 'nova-2-phonecall',
        language: 'en-US',
        punctuate: true,
        smart_format: true,
        interim_results: true,
        vad_events: true,
        endpointing: 250,
        diarize: false
      });
    });

    it('should handle audio stream data correctly', async () => {
      const transcriptionPromise = getTranscription(mockStream);
      
      // Get the open handler and call it
      const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
      openHandler();
      
      // Simulate stream data event
      const streamDataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')[1];
      const testChunk = Buffer.from('test audio data');
      streamDataHandler(testChunk);
      
      // Verify data was sent to Deepgram
      expect(mockDeepgramSocket.send).toHaveBeenCalledWith(testChunk);
      
      // Complete the transcription
      const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      messageHandler(JSON.stringify(createMockSTTResponse('test transcription')));
      
      await transcriptionPromise;
    });

    it('should only resolve on final transcripts', async () => {
      const transcriptionPromise = getTranscription(mockStream);
      
      // Simulate socket opening
      const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
      openHandler();
      
      const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      
      // Send interim result (should not resolve)
      const interimResponse = createMockSTTResponse('Hello', false);
      messageHandler(JSON.stringify(interimResponse));
      
      // Send final result (should resolve)
      const finalResponse = createMockSTTResponse('Hello world', true);
      messageHandler(JSON.stringify(finalResponse));
      
      const result = await transcriptionPromise;
      expect(result).toBe('Hello world');
    });

    it('should handle transcription errors', async () => {
      const transcriptionPromise = getTranscription(mockStream);
      
      // Get the error handler
      const errorHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      const testError = new Error('Network timeout');
      errorHandler(testError);
      
      await expect(transcriptionPromise).rejects.toThrow('Network timeout');
    });

    it('should measure transcription latency', async () => {
      const start = process.hrtime.bigint();
      
      const transcriptionPromise = getTranscription(mockStream);
      
      // Simulate processing delay
      setTimeout(() => {
        const openHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'open')[1];
        openHandler();
        
        const messageHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'message')[1];
        messageHandler(JSON.stringify(createMockSTTResponse('timing test')));
      }, 100);
      
      await transcriptionPromise;
      
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;
      
      // Should complete within reasonable time (allowing for test overhead)
      expect(latencyMs).toBeLessThan(500);
    });
  });
});
