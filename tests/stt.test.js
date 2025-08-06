
const { getTranscription } = require('../src/services/stt');
const { Deepgram } = require('@deepgram/sdk');

jest.mock('@deepgram/sdk', () => ({
  Deepgram: jest.fn(() => ({
    transcriptions: {
      create: jest.fn().mockResolvedValue({ result: { results: { channels: [{ alternatives: [{ transcript: 'Hello world' }] }] } } }),
    },
  })),
}));

describe('STT Service', () => {
  it('should get a transcription for an audio file', async () => {
    const transcription = await getTranscription('http://example.com/audio.wav');
    expect(transcription).toBeDefined();
    expect(Deepgram).toHaveBeenCalledWith(process.env.DEEPGRAM_API_KEY);
  });
});
