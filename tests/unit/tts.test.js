
const { getSpeech } = require('../src/services/tts');

jest.mock('@deepgram/sdk', () => ({
  createClient: jest.fn(() => ({
    speak: {
      request: jest.fn().mockResolvedValue({
        getStream: () => 'mock-audio-stream',
      }),
    },
  })),
}));

describe('TTS Service', () => {
  it('should get speech from Deepgram', async () => {
    const audioStream = await getSpeech('Hello world');
    expect(audioStream).toBe('mock-audio-stream');
  });
});
