
const { STTService, getTranscription } = require('../../src/services/stt');
const { createClient } = require('@deepgram/sdk');
const { createMockAudioStream, createMockSTTResponse, measureExecutionTime } = require('../helpers/testHelpers');
const { mockDeepgramSTT } = require('../mocks/services');

// Mock the Deepgram SDK
jest.mock('@deepgram/sdk', () => ({
  createClient: jest.fn(() => ({
    listen: {
      live: jest.fn(),
      prerecorded: {
        transcribeBuffer: jest.fn()
      }
    }
  }))
}));

describe('STT Service', () => {
  let mockDeepgramSocket;
  let mockStream;
  let mockDeepgramClient;
  let sttService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock connection with event handlers
    mockDeepgramSocket = {
      on: jest.fn(),
      send: jest.fn(),
      finish: jest.fn()
    };
    
    // Setup mock Deepgram client
    mockDeepgramClient = {
      listen: {
        live: jest.fn(() => mockDeepgramSocket),
        prerecorded: {
          transcribeBuffer: jest.fn()
        }
      }
    };
    
    // Setup mock audio stream
    mockStream = createMockAudioStream();
    
    // Configure createClient mock
    createClient.mockImplementation(() => mockDeepgramClient);
    
    // Create fresh STT service instance
    sttService = new STTService();
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

    describe('performance metrics', () => {
      it('should track response times', async () => {
        sttService.startListening();
        
        const { timeMs } = await measureExecutionTime(async () => {
          return new Promise((resolve) => {
            sttService.on('transcript', (data) => {
              if (data.isFinal) resolve(data);
            });
            
            // Simulate realistic processing delay
            setTimeout(() => {
              const resultsHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'Results')[1];
              resultsHandler(createMockSTTResponse('performance test', true));
            }, 150); // 150ms simulated STT latency
          });
        });
        
        // Should be under target latency for STT (<500ms)
        expect(timeMs).toBeLessThan(500);
      });

      it('should handle multiple concurrent requests', async () => {
        const numRequests = 5;
        const services = Array.from({ length: numRequests }, () => new STTService());
        
        const promises = services.map(async (service, index) => {
          service.startListening();
          
          return new Promise((resolve) => {
            service.on('transcript', (data) => {
              if (data.isFinal) resolve({ index, data });
            });
            
            setTimeout(() => {
              const resultsHandler = service.connection.on.mock.calls.find(call => call[0] === 'Results')[1];
              resultsHandler(createMockSTTResponse(`Request ${index}`, true));
            }, 100);
          });
        });
        
        const results = await Promise.all(promises);
        
        expect(results).toHaveLength(numRequests);
        results.forEach((result, index) => {
          expect(result.index).toBe(index);
          expect(result.data.text).toBe(`Request ${index}`);
        });
      });
    });
  });

  describe('Legacy getTranscription function', () => {
    it('should process prerecorded audio buffer', async () => {
      const mockBuffer = Buffer.from('mock audio data');
      const expectedTranscript = 'Hello, I need an appointment';
      
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockResolvedValue({
        results: {
          channels: [{
            alternatives: [{ transcript: expectedTranscript }]
          }]
        }
      });
      
      const result = await getTranscription(mockBuffer);
      
      expect(mockDeepgramClient.listen.prerecorded.transcribeBuffer).toHaveBeenCalledWith(
        mockBuffer,
        {
          model: 'nova-2-phonecall',
          language: 'en-US',
          punctuate: true,
          smart_format: true,
        }
      );
      expect(result).toBe(expectedTranscript);
    });

    it('should handle transcription errors in legacy mode', async () => {
      const mockBuffer = Buffer.from('mock audio data');
      const testError = new Error('Deepgram API error');
      
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockRejectedValue(testError);
      
      await expect(getTranscription(mockBuffer)).rejects.toThrow('Deepgram API error');
    });

    it('should return empty string for no results', async () => {
      const mockBuffer = Buffer.from('mock audio data');
      
      mockDeepgramClient.listen.prerecorded.transcribeBuffer.mockResolvedValue({
        results: { channels: [] }
      });
      
      const result = await getTranscription(mockBuffer);
      expect(result).toBe('');
    });
  });

  describe('Audio Quality Scenarios', () => {
    beforeEach(() => {
      sttService.startListening();
    });

    it('should handle high quality audio with high confidence', (done) => {
      sttService.on('transcript', (data) => {
        expect(data.confidence).toBeGreaterThanOrEqual(0.95);
        expect(data.text).toBe('Crystal clear audio test');
        done();
      });
      
      const resultsHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'Results')[1];
      const highQualityResponse = createMockSTTResponse('Crystal clear audio test', true);
      highQualityResponse.channel.alternatives[0].confidence = 0.98;
      resultsHandler(highQualityResponse);
    });

    it('should handle noisy audio with lower confidence', (done) => {
      sttService.on('transcript', (data) => {
        expect(data.confidence).toBeLessThan(0.8);
        expect(data.text).toContain('noisy');
        done();
      });
      
      const resultsHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'Results')[1];
      const noisyResponse = createMockSTTResponse('noisy unclear audio', true);
      noisyResponse.channel.alternatives[0].confidence = 0.65;
      resultsHandler(noisyResponse);
    });

    it('should handle phone quality audio appropriately', (done) => {
      sttService.on('transcript', (data) => {
        expect(data.confidence).toBeGreaterThan(0.8);
        expect(data.confidence).toBeLessThan(0.95);
        done();
      });
      
      const resultsHandler = mockDeepgramSocket.on.mock.calls.find(call => call[0] === 'Results')[1];
      const phoneResponse = createMockSTTResponse('phone quality test', true);
      phoneResponse.channel.alternatives[0].confidence = 0.87;
      resultsHandler(phoneResponse);
    });
  });
});
