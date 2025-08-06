
const { getSpeech } = require('../src/services/tts');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

jest.mock('@aws-sdk/client-polly', () => ({
  PollyClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ AudioStream: 'mock-audio-stream' }),
  })),
  SynthesizeSpeechCommand: jest.fn(),
}));

describe('TTS Service', () => {
  it('should get speech from the TTS service', async () => {
    const audioStream = await getSpeech('Hello world');
    expect(audioStream).toBe('mock-audio-stream');
    expect(PollyClient).toHaveBeenCalledWith({ region: process.env.AWS_REGION });
    expect(SynthesizeSpeechCommand).toHaveBeenCalledWith({
      OutputFormat: 'pcm',
      SampleRate: '8000',
      Text: 'Hello world',
      TextType: 'ssml',
      VoiceId: 'Joanna',
      Engine: 'neural',
    });
  });
});
