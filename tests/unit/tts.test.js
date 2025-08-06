const { getSpeech, streamTTSToTwilio } = require('../../src/services/tts');
const { createClient } = require('@deepgram/sdk');
const { createMockAudioStream, measureExecutionTime } = require('../helpers/testHelpers');
const { Readable } = require('stream');

// Mock the Deepgram SDK
jest.mock('@deepgram/sdk', () => ({
  createClient: jest.fn(() => ({
    speak: {
      request: jest.fn(),
    },
  })),
}));

describe('TTS Service', () => {
  let mockDeepgramClient;
  let mockAudioStream;
  let mockTwilioWs;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Deepgram client
    mockDeepgramClient = {
      speak: {
        request: jest.fn()
      }
    };
    
    // Setup mock audio stream
    mockAudioStream = createMockAudioStream();
    
    // Setup mock Twilio WebSocket
    mockTwilioWs = {
      send: jest.fn(),
      streamSid: 'mock-stream-sid-123'
    };
    
    // Configure createClient mock
    createClient.mockImplementation(() => mockDeepgramClient);
  });

  describe('getSpeech', () => {
    it('should initialize Deepgram client with correct API key', async () => {
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => mockAudioStream
      });
      
      await getSpeech('Hello world');
      
      expect(createClient).toHaveBeenCalledWith(process.env.DEEPGRAM_API_KEY);
    });

    it('should make TTS request with correct parameters', async () => {
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => mockAudioStream
      });
      
      const testText = 'Hello, how can I help you today?';
      await getSpeech(testText);
      
      expect(mockDeepgramClient.speak.request).toHaveBeenCalledWith(
        { text: testText },
        {
          model: 'aura-asteria-en',
          encoding: 'mulaw',
          sample_rate: 8000,
          container: 'none',
        }
      );
    });

    it('should return audio stream from Deepgram response', async () => {
      const expectedStream = createMockAudioStream();
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => expectedStream
      });
      
      const result = await getSpeech('Test text');
      
      expect(result).toBe(expectedStream);
    });

    it('should throw error if no stream is returned', async () => {
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => null
      });
      
      await expect(getSpeech('Test text')).rejects.toThrow(
        'Failed to get audio stream from Deepgram'
      );
    });

    it('should handle TTS API errors', async () => {
      const testError = new Error('Deepgram TTS API error');
      mockDeepgramClient.speak.request.mockRejectedValue(testError);
      
      await expect(getSpeech('Test text')).rejects.toThrow(
        'Deepgram TTS API error'
      );
    });

    it('should measure TTS response time', async () => {
      // Mock with realistic delay
      mockDeepgramClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        return { getStream: () => mockAudioStream };
      });
      
      const { timeMs } = await measureExecutionTime(() => getSpeech('Performance test'));
      
      // Should be under target latency for TTS (<500ms)
      expect(timeMs).toBeLessThan(500);
      expect(timeMs).toBeGreaterThan(150); // Should include our mock delay
    });
  });

  describe('streamTTSToTwilio', () => {
    it('should stream audio chunks to Twilio WebSocket', async () => {
      const mockChunks = [
        Buffer.from('audio chunk 1'),
        Buffer.from('audio chunk 2'),
        Buffer.from('audio chunk 3')
      ];
      
      // Create a readable stream that emits our test chunks
      const testStream = new Readable({
        read() {
          const chunk = mockChunks.shift();
          if (chunk) {
            this.push(chunk);
          } else {
            this.push(null); // End stream
          }
        }
      });
      
      const promise = streamTTSToTwilio(testStream, mockTwilioWs);
      
      const result = await promise;
      
      // Should have sent 3 media messages to Twilio
      expect(mockTwilioWs.send).toHaveBeenCalledTimes(3);
      
      // Verify message format
      const calls = mockTwilioWs.send.mock.calls;
      calls.forEach((call, index) => {
        const message = JSON.parse(call[0]);
        expect(message).toHaveProperty('event', 'media');
        expect(message).toHaveProperty('streamSid', 'mock-stream-sid-123');
        expect(message).toHaveProperty('media');
        expect(message.media).toHaveProperty('payload');
        
        // Verify base64 encoding
        const expectedBase64 = Buffer.from(`audio chunk ${index + 1}`).toString('base64');
        expect(message.media.payload).toBe(expectedBase64);
      });
      
      // Should return concatenated buffer
      const expectedBuffer = Buffer.concat([
        Buffer.from('audio chunk 1'),
        Buffer.from('audio chunk 2'),
        Buffer.from('audio chunk 3')
      ]);
      expect(result).toEqual(expectedBuffer);
    });

    it('should handle stream errors', async () => {
      const errorStream = new Readable({
        read() {
          this.emit('error', new Error('Stream error'));
        }
      });
      
      await expect(streamTTSToTwilio(errorStream, mockTwilioWs))
        .rejects.toThrow('Stream error');
    });

    it('should handle empty streams', async () => {
      const emptyStream = new Readable({
        read() {
          this.push(null); // Immediately end stream
        }
      });
      
      const result = await streamTTSToTwilio(emptyStream, mockTwilioWs);
      
      expect(mockTwilioWs.send).not.toHaveBeenCalled();
      expect(result).toEqual(Buffer.alloc(0));
    });

    it('should handle large audio streams efficiently', async () => {
      const largeChunks = Array.from({ length: 100 }, (_, i) => 
        Buffer.alloc(1024, i) // 1KB chunks
      );
      
      const largeStream = new Readable({
        read() {
          const chunk = largeChunks.shift();
          if (chunk) {
            this.push(chunk);
          } else {
            this.push(null);
          }
        }
      });
      
      const startTime = Date.now();
      const result = await streamTTSToTwilio(largeStream, mockTwilioWs);
      const endTime = Date.now();
      
      // Should process 100KB in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockTwilioWs.send).toHaveBeenCalledTimes(100);
      expect(result.length).toBe(100 * 1024); // 100KB
    });
  });

  describe('Audio Format Validation', () => {
    it('should request correct audio encoding for phone calls', async () => {
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => mockAudioStream
      });
      
      await getSpeech('Test phone audio');
      
      expect(mockDeepgramClient.speak.request).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          encoding: 'mulaw', // μ-law encoding for phone calls
          sample_rate: 8000,  // 8kHz for telephony
          container: 'none'   // Raw audio data
        })
      );
    });

    it('should use appropriate model for natural speech', async () => {
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => mockAudioStream
      });
      
      await getSpeech('Natural sounding speech test');
      
      expect(mockDeepgramClient.speak.request).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          model: 'aura-asteria-en' // Natural English voice
        })
      );
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent TTS requests', async () => {
      const numRequests = 10;
      const testTexts = Array.from({ length: numRequests }, (_, i) => `Request ${i}`);
      
      // Mock with varying delays to simulate real conditions
      mockDeepgramClient.speak.request.mockImplementation(async (params) => {
        const delay = 100 + Math.random() * 200; // 100-300ms delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          getStream: () => {
            const stream = new Readable({
              read() {
                this.push(Buffer.from(`Audio for: ${params.text}`));
                this.push(null);
              }
            });
            return stream;
          }
        };
      });
      
      const startTime = Date.now();
      const promises = testTexts.map(text => getSpeech(text));
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All requests should complete
      expect(results).toHaveLength(numRequests);
      
      // Should handle concurrently (faster than sequential)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Each request should have been made
      expect(mockDeepgramClient.speak.request).toHaveBeenCalledTimes(numRequests);
    });

    it('should maintain quality under load', async () => {
      const longText = 'This is a longer text that will test the TTS system\'s ability to handle more substantial content without degrading performance or quality measures.'.repeat(3);
      
      mockDeepgramClient.speak.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { getStream: () => mockAudioStream };
      });
      
      const { timeMs } = await measureExecutionTime(() => getSpeech(longText));
      
      // Should handle longer text within reasonable time
      expect(timeMs).toBeLessThan(800);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      mockDeepgramClient.speak.request.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );
      
      await expect(getSpeech('Timeout test'))
        .rejects.toThrow('Network timeout');
    });

    it('should handle rate limiting errors', async () => {
      mockDeepgramClient.speak.request.mockRejectedValue(
        new Error('Rate limit exceeded')
      );
      
      await expect(getSpeech('Rate limit test'))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should handle very long text inputs', async () => {
      const veryLongText = 'A'.repeat(10000); // 10KB text
      
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => mockAudioStream
      });
      
      const result = await getSpeech(veryLongText);
      
      expect(result).toBeDefined();
      expect(mockDeepgramClient.speak.request).toHaveBeenCalledWith(
        { text: veryLongText },
        expect.any(Object)
      );
    });

    it('should handle empty text input', async () => {
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => mockAudioStream
      });
      
      const result = await getSpeech('');
      
      expect(result).toBeDefined();
      expect(mockDeepgramClient.speak.request).toHaveBeenCalledWith(
        { text: '' },
        expect.any(Object)
      );
    });

    it('should handle special characters and punctuation', async () => {
      const specialText = 'Hello! How are you? I\'m fine, thanks. 50% off - $19.99 @ store@email.com';
      
      mockDeepgramClient.speak.request.mockResolvedValue({
        getStream: () => mockAudioStream
      });
      
      const result = await getSpeech(specialText);
      
      expect(result).toBeDefined();
      expect(mockDeepgramClient.speak.request).toHaveBeenCalledWith(
        { text: specialText },
        expect.any(Object)
      );
    });
  });

  describe('Integration with Twilio Media Streams', () => {
    it('should format media messages correctly for Twilio', async () => {
      const testChunk = Buffer.from('test audio data');
      const testStream = new Readable({
        read() {
          this.push(testChunk);
          this.push(null);
        }
      });
      
      await streamTTSToTwilio(testStream, mockTwilioWs);
      
      expect(mockTwilioWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'media',
          streamSid: 'mock-stream-sid-123',
          media: {
            payload: testChunk.toString('base64')
          }
        })
      );
    });

    it('should handle WebSocket send failures gracefully', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn(); // Mock console.error to prevent test output noise
      
      mockTwilioWs.send.mockImplementation(() => {
        throw new Error('WebSocket closed');
      });
      
      const testStream = new Readable({
        read() {
          this.push(Buffer.from('test'));
          this.push(null);
        }
      });
      
      // Should not throw error but continue processing
      const result = await streamTTSToTwilio(testStream, mockTwilioWs);
      expect(result).toBeDefined();
      
      console.error = originalConsoleError; // Restore console.error
    });
  });
});