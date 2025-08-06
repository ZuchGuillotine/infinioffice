
const { getCompletion } = require('../src/services/llm');
const OpenAI = require('openai');

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'This is a test completion.' } }],
        }),
      },
    },
  }));
});

describe('LLM Service', () => {
  it('should get a completion from the LLM', async () => {
    const completion = await getCompletion('Test prompt');
    expect(completion).toBe('This is a test completion.');
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: process.env.OPENAI_API_KEY });
  });
});
