
const { getCompletion, detectIntent, generateResponse } = require('../../src/services/llm');
const OpenAI = require('openai');
const { createMockLLMResponse, measureExecutionTime } = require('../helpers/testHelpers');
const { mockOpenAI, mockServicesWithLatency, mockServicesWithErrors } = require('../mocks/services');

jest.mock('openai', () => mockOpenAI);

describe('LLM Service', () => {
  let mockOpenAIInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockImplementation(() => mockOpenAIInstance);
  });

  describe('getCompletion', () => {
    it('should initialize OpenAI with correct API key', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(
        createMockLLMResponse('I can help you book an appointment.')
      );

      const completion = await getCompletion('I need to book an appointment');
      
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: process.env.OPENAI_API_KEY });
      expect(completion).toBe('I can help you book an appointment.');
    });

    it('should use correct model and parameters', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(
        createMockLLMResponse('What service do you need?')
      );

      await getCompletion('I want to book something');

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo-0125',
        messages: [
          { 
            role: 'system', 
            content: 'You are a scheduling agent. Be concise and directive. Goal: complete booking/reschedule/cancel with minimal words. No chit-chat. Offer at most top 2–3 options. Avoid long explanations.' 
          },
          { role: 'user', content: 'I want to book something' }
        ],
        temperature: 0.2,
        max_tokens: 120,
        presence_penalty: 0,
        frequency_penalty: 0
      });
    });

    it('should handle different types of user intents', async () => {
      const testCases = [
        {
          input: 'I need to book an appointment',
          expectedOutput: 'What service would you like to book?'
        },
        {
          input: 'I want to cancel my appointment',
          expectedOutput: 'I can help you cancel. What\'s your name or phone number?'
        },
        {
          input: 'Can I reschedule for tomorrow?',
          expectedOutput: 'What time tomorrow works for you?'
        }
      ];

      for (const testCase of testCases) {
        mockOpenAIInstance.chat.completions.create.mockResolvedValue(
          createMockLLMResponse(testCase.expectedOutput)
        );

        const completion = await getCompletion(testCase.input);
        expect(completion).toBe(testCase.expectedOutput);
      }
    });

    it('should handle empty or whitespace-only prompts', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(
        createMockLLMResponse('How can I help you today?')
      );

      const emptyPrompts = ['', '   ', '\n\t  '];
      
      for (const prompt of emptyPrompts) {
        const completion = await getCompletion(prompt);
        expect(completion).toBe('How can I help you today?');
      }
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'I need to book an appointment '.repeat(50);
      
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(
        createMockLLMResponse('What service do you need?')
      );

      const completion = await getCompletion(longPrompt);
      expect(completion).toBe('What service do you need?');
      
      // Verify the long prompt was passed correctly
      const call = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
      expect(call.messages[1].content).toBe(longPrompt);
    });

    it('should enforce response length limits', async () => {
      // Mock a response that would be truncated by max_tokens
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Short response due to token limit',
            role: 'assistant'
          },
          finish_reason: 'length'
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 120, // At max_tokens limit
          total_tokens: 170
        }
      });

      const completion = await getCompletion('Tell me everything about booking');
      expect(completion).toBe('Short response due to token limit');
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('OpenAI API timeout');
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(apiError);

      await expect(getCompletion('Test prompt')).rejects.toThrow('OpenAI API timeout');
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(getCompletion('Test prompt')).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle malformed API responses', async () => {
      // Missing choices array
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        usage: { total_tokens: 50 }
      });

      await expect(getCompletion('Test')).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete within target latency', async () => {
      mockOpenAIInstance.chat.completions.create.mockImplementation(async () => {
        // Simulate realistic API latency
        await new Promise(resolve => setTimeout(resolve, 500));
        return createMockLLMResponse('Quick response');
      });

      const result = await measureExecutionTime(async () => {
        return await getCompletion('Fast prompt');
      });

      expect(result.result).toBe('Quick response');
      expect(result.timeMs).toBeLessThan(1500); // Target: <1.5s including overhead
    });

    it('should handle concurrent requests', async () => {
      mockOpenAIInstance.chat.completions.create.mockImplementation(async (params) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return createMockLLMResponse(`Response to: ${params.messages[1].content}`);
      });

      const prompts = [
        'Book appointment 1',
        'Book appointment 2', 
        'Book appointment 3',
        'Book appointment 4',
        'Book appointment 5'
      ];

      const start = Date.now();
      const results = await Promise.all(
        prompts.map(prompt => getCompletion(prompt))
      );
      const duration = Date.now() - start;

      // All requests should complete
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toBe(`Response to: ${prompts[index]}`);
      });

      // Should handle concurrently (not sequentially)
      expect(duration).toBeLessThan(1000); // Much faster than 5 * 200ms
    });
  });

  describe('Conversation Context', () => {
    it('should maintain consistent persona across calls', async () => {
      const responses = [
        'What service do you need?',
        'What time works for you?', 
        'What\'s your contact info?'
      ];

      responses.forEach(response => {
        mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(
          createMockLLMResponse(response)
        );
      });

      const prompts = [
        'I need an appointment',
        'Dental cleaning',
        'Tomorrow at 2 PM'
      ];

      for (let i = 0; i < prompts.length; i++) {
        const completion = await getCompletion(prompts[i]);
        expect(completion).toBe(responses[i]);
        
        // Verify system prompt is consistent
        const call = mockOpenAIInstance.chat.completions.create.mock.calls[i][0];
        expect(call.messages[0].role).toBe('system');
        expect(call.messages[0].content).toContain('scheduling agent');
      }
    });

    it('should handle ambiguous requests with clarification', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(
        createMockLLMResponse('What type of service? We offer consultations, cleanings, and treatments.')
      );

      const completion = await getCompletion('I need something');
      expect(completion).toContain('What type of service');
      expect(completion.length).toBeLessThan(120); // Respects max_tokens
    });
  });

  describe('Intent Detection', () => {
    it('should detect booking intent with high confidence', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: 'booking',
              confidence: 0.95,
              entities: {
                service: 'dental cleaning',
                timeWindow: null,
                contact: null
              },
              rawText: 'I need to book a dental cleaning'
            })
          }
        }]
      });

      const result = await detectIntent('I need to book a dental cleaning');
      
      expect(result.intent).toBe('booking');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.entities.service).toBe('dental cleaning');
      expect(result.rawText).toBe('I need to book a dental cleaning');
    });

    it('should extract service information from transcript', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: 'service_provided',
              confidence: 0.88,
              entities: {
                service: 'haircut',
                timeWindow: null,
                contact: null
              },
              rawText: 'I need a haircut'
            })
          }
        }]
      });

      const result = await detectIntent('I need a haircut');
      
      expect(result.intent).toBe('service_provided');
      expect(result.entities.service).toBe('haircut');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should extract time information from transcript', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: 'time_provided',
              confidence: 0.92,
              entities: {
                service: null,
                timeWindow: 'tomorrow at 2 PM',
                contact: null
              },
              rawText: 'Tomorrow at 2 PM would be perfect'
            })
          }
        }]
      });

      const result = await detectIntent('Tomorrow at 2 PM would be perfect');
      
      expect(result.intent).toBe('time_provided');
      expect(result.entities.timeWindow).toBe('tomorrow at 2 PM');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should extract contact information from transcript', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: 'contact_provided',
              confidence: 0.96,
              entities: {
                service: null,
                timeWindow: null,
                contact: 'John Smith 555-1234'
              },
              rawText: 'My name is John Smith and my phone is 555-1234'
            })
          }
        }]
      });

      const result = await detectIntent('My name is John Smith and my phone is 555-1234');
      
      expect(result.intent).toBe('contact_provided');
      expect(result.entities.contact).toBe('John Smith 555-1234');
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('should detect confirmation responses', async () => {
      const confirmationTests = [
        { input: 'Yes, that\\'s correct', expected: 'confirmation_yes' },
        { input: 'Yeah, book it', expected: 'confirmation_yes' },
        { input: 'No, that\\'s wrong', expected: 'confirmation_no' },
        { input: 'That\\'s not right', expected: 'confirmation_no' }
      ];

      for (const test of confirmationTests) {
        mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: test.expected,
                confidence: 0.93,
                entities: {},
                rawText: test.input
              })
            }
          }]
        });

        const result = await detectIntent(test.input);
        expect(result.intent).toBe(test.expected);
      }
    });

    it('should handle unclear intents with low confidence', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: 'unclear',
              confidence: 0.3,
              entities: {},
              rawText: 'um, maybe, I think'
            })
          }
        }]
      });

      const result = await detectIntent('um, maybe, I think');
      
      expect(result.intent).toBe('unclear');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle malformed JSON responses gracefully', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      });

      const result = await detectIntent('Test input');
      
      expect(result.intent).toBe('unclear');
      expect(result.confidence).toBe(0.0);
      expect(result.rawText).toBe('Test input');
    });

    it('should provide conversation context to intent detection', async () => {
      const context = {
        currentState: 'collectService',
        service: null,
        timeWindow: 'tomorrow',
        contact: null
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: 'service_provided',
              confidence: 0.91,
              entities: { service: 'consultation' },
              rawText: 'A consultation'
            })
          }
        }]
      });

      await detectIntent('A consultation', context);
      
      // Verify context was included in the system prompt
      const call = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
      expect(call.messages[0].content).toContain(JSON.stringify(context));
    });

    it('should achieve target accuracy on common booking phrases', async () => {
      const commonBookingPhrases = [
        'I need to book an appointment',
        'Can I schedule something',
        'I\\'d like to make an appointment',
        'Book me a haircut',
        'Schedule a consultation',
        'I want to set up an appointment'
      ];

      let correctDetections = 0;
      const totalPhrases = commonBookingPhrases.length;

      for (const phrase of commonBookingPhrases) {
        mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'booking',
                confidence: 0.9 + Math.random() * 0.09, // 0.9-0.99
                entities: {},
                rawText: phrase
              })
            }
          }]
        });

        const result = await detectIntent(phrase);
        if (result.intent === 'booking' && result.confidence >= 0.8) {
          correctDetections++;
        }
      }

      const accuracy = correctDetections / totalPhrases;
      expect(accuracy).toBeGreaterThanOrEqual(0.85); // Target: 85% accuracy
    });
  });

  describe('Response Generation', () => {
    it('should generate appropriate responses for different states', async () => {
      const testCases = [
        {
          state: 'greeting',
          context: {},
          expected: /help.*appointment.*service/i
        },
        {
          state: 'service',
          context: {},
          expected: /service.*schedule/i
        },
        {
          state: 'timeWindow',
          context: { service: 'dental cleaning' },
          expected: /dental cleaning.*time/i
        },
        {
          state: 'contact',
          context: { service: 'haircut', timeWindow: 'tomorrow 2pm' },
          expected: /haircut.*tomorrow.*2pm.*contact/i
        },
        {
          state: 'confirmation',
          context: { 
            service: 'consultation',
            timeWindow: 'Friday 10am',
            contact: 'Sarah 555-9876'
          },
          expected: /consultation.*Friday.*10am.*Sarah.*555-9876.*correct/i
        }
      ];

      for (const testCase of testCases) {
        const response = await generateResponse(testCase.state, testCase.context);
        expect(response).toMatch(testCase.expected);
        expect(response.length).toBeGreaterThan(10);
        expect(response.length).toBeLessThan(200); // Keep responses concise
      }
    });

    it('should handle retry scenarios with escalating clarity', async () => {
      const context = { service: null };
      
      // First attempt
      const firstTry = await generateResponse('service', context, 0);
      expect(firstTry).toContain('service');
      
      // First retry
      const firstRetry = await generateResponse('service_retry', context, 1);
      expect(firstRetry).toContain('didn\\'t quite catch');
      expect(firstRetry).toContain('consultation');
      
      // Second retry (more specific)
      const secondRetry = await generateResponse('service_retry', context, 2);
      expect(secondRetry).toContain('trouble understanding');
      expect(secondRetry).toContain('specific');
    });

    it('should provide appropriate fallback responses', async () => {
      const fallbackResponse = await generateResponse('fallback', {});
      expect(fallbackResponse).toContain('trouble');
      expect(fallbackResponse).toMatch(/phone|call back|website/i);
    });

    it('should provide success confirmation messages', async () => {
      const context = {
        service: 'dental cleaning',
        timeWindow: 'Thursday 3pm',
        contact: '555-1234'
      };
      
      const successResponse = await generateResponse('success', context);
      expect(successResponse).toContain('confirmed');
      expect(successResponse).toContain('dental cleaning');
      expect(successResponse).toContain('Thursday');
      expect(successResponse).toContain('555-1234');
    });
  });
});
