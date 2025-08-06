/**
 * Mock implementations for all InfiniOffice services
 */

// Mock Deepgram SDK for STT
const mockDeepgramSTT = {
  Deepgram: jest.fn().mockImplementation(() => ({
    transcription: {
      live: jest.fn(() => ({
        on: jest.fn((event, callback) => {
          if (event === 'open') {
            setTimeout(callback, 10);
          } else if (event === 'message') {
            setTimeout(() => {
              callback(JSON.stringify({
                is_final: true,
                channel: {
                  alternatives: [{
                    transcript: 'Hello, I need to book an appointment',
                    confidence: 0.95
                  }]
                }
              }));
            }, 100);
          }
        }),
        send: jest.fn()
      }))
    }
  }))
};

// Mock Deepgram SDK for TTS
const mockDeepgramTTS = {
  createClient: jest.fn(() => ({
    speak: {
      request: jest.fn().mockResolvedValue({
        getStream: () => require('../helpers/testHelpers').createMockAudioStream(),
        headers: {
          'content-type': 'audio/wav'
        }
      })
    }
  }))
};

// Mock OpenAI
const mockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'I can help you book an appointment. What service do you need?'
          }
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 15,
          total_tokens: 65
        }
      })
    }
  }
}));

// Mock Google Calendar
const mockGoogleCalendar = {
  google: {
    auth: {
      OAuth2: jest.fn()
    },
    calendar: jest.fn(() => ({
      events: {
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-event-123',
            summary: 'Test Appointment',
            start: { dateTime: '2025-08-07T14:00:00Z' },
            end: { dateTime: '2025-08-07T15:00:00Z' }
          }
        }),
        list: jest.fn().mockResolvedValue({
          data: {
            items: []
          }
        })
      }
    }))
  }
};

// Mock Prisma Client
const mockPrismaClient = {
  PrismaClient: jest.fn().mockImplementation(() => ({
    call: {
      create: jest.fn().mockResolvedValue(global.createMockCall()),
      findUnique: jest.fn().mockResolvedValue(global.createMockCall()),
      update: jest.fn().mockResolvedValue(global.createMockCall())
    },
    turn: {
      create: jest.fn().mockResolvedValue(global.createMockTurn()),
      findMany: jest.fn().mockResolvedValue([global.createMockTurn()])
    },
    appointment: {
      create: jest.fn().mockResolvedValue(global.createMockAppointment()),
      findMany: jest.fn().mockResolvedValue([global.createMockAppointment()]),
      findUnique: jest.fn().mockResolvedValue(global.createMockAppointment()),
      update: jest.fn().mockResolvedValue(global.createMockAppointment())
    },
    $disconnect: jest.fn().mockResolvedValue(undefined)
  }))
};

// Mock Twilio
const mockTwilio = {
  twiml: {
    VoiceResponse: jest.fn().mockImplementation(() => ({
      say: jest.fn().mockReturnThis(),
      connect: jest.fn(() => ({
        stream: jest.fn()
      })),
      gather: jest.fn().mockReturnThis(),
      hangup: jest.fn().mockReturnThis(),
      toString: jest.fn().mockReturnValue('<Response><Say>Hello</Say></Response>')
    }))
  }
};

// Mock WebSocket
const mockWebSocket = {
  on: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1 // WebSocket.OPEN
};

// Performance testing mocks with realistic delays
const mockServicesWithLatency = {
  stt: {
    getTranscription: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms STT delay
      return 'Hello, I need to book an appointment';
    })
  },
  llm: {
    getCompletion: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 800)); // 800ms LLM delay
      return 'I can help you book an appointment. What service do you need?';
    })
  },
  tts: {
    getSpeech: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms TTS delay
      return require('../helpers/testHelpers').createMockAudioStream();
    })
  }
};

// Error simulation mocks
const mockServicesWithErrors = {
  stt: {
    networkError: () => new Error('Network timeout - STT service unavailable'),
    apiError: () => new Error('Invalid audio format'),
    rateLimit: () => new Error('Rate limit exceeded')
  },
  llm: {
    networkError: () => new Error('OpenAI API timeout'),
    apiError: () => new Error('Invalid prompt format'),
    rateLimit: () => new Error('Rate limit exceeded')
  },
  tts: {
    networkError: () => new Error('Deepgram TTS unavailable'),
    apiError: () => new Error('Text too long'),
    rateLimit: () => new Error('Rate limit exceeded')
  },
  calendar: {
    authError: () => new Error('Google Calendar authentication failed'),
    conflictError: () => new Error('Time slot already booked'),
    permissionError: () => new Error('Insufficient permissions')
  }
};

module.exports = {
  mockDeepgramSTT,
  mockDeepgramTTS,
  mockOpenAI,
  mockGoogleCalendar,
  mockPrismaClient,
  mockTwilio,
  mockWebSocket,
  mockServicesWithLatency,
  mockServicesWithErrors
};