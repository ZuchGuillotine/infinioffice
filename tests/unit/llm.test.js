
const { getCompletion } = require('../../src/services/llm');
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
});
