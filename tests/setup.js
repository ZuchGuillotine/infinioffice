/**
 * Jest setup file for InfiniOffice testing
 * This file runs before all tests to configure the testing environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.DEEPGRAM_API_KEY = 'test-deepgram-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URL = 'http://localhost:3000/auth/google/callback';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';

// Global test timeout (increase for integration tests)
jest.setTimeout(10000);

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.mockAudioStream = () => ({
  on: jest.fn((event, callback) => {
    if (event === 'data') {
      // Simulate audio chunks
      setTimeout(() => callback(Buffer.from('mock-audio-data')), 10);
    }
  }),
  pipe: jest.fn(),
  end: jest.fn()
});

global.mockWebSocket = () => ({
  on: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1 // WebSocket.OPEN
});

// Test data factory functions
global.createMockCall = (overrides = {}) => ({
  id: 'mock-call-id-123',
  organizationId: 'mock-org-id',
  callerPhone: '+1234567890',
  durationSeconds: 180,
  transcript: 'Mock conversation transcript',
  recordingUrl: 'https://example.com/recording.wav',
  metadata: { source: 'test' },
  createdAt: new Date(),
  ...overrides
});

global.createMockTurn = (overrides = {}) => ({
  id: 1,
  callId: 'mock-call-id-123',
  turnIndex: 0,
  asrMs: 250,
  llmMs: 800,
  ttsMs: 300,
  transcriptIn: 'Hello, I need to book an appointment',
  transcriptOut: 'I can help you with that. What service do you need?',
  createdAt: new Date(),
  ...overrides
});

global.createMockAppointment = (overrides = {}) => ({
  id: 'mock-appointment-id',
  organizationId: 'mock-org-id',
  externalId: 'cal-event-123',
  calendarProvider: 'google',
  startAt: new Date('2025-08-07T14:00:00Z'),
  endAt: new Date('2025-08-07T15:00:00Z'),
  service: 'Consultation',
  provider: 'Dr. Smith',
  contactPhone: '+1234567890',
  notes: 'Initial consultation',
  status: 'confirmed',
  createdAt: new Date(),
  ...overrides
});

// Performance testing utilities
global.measurePerformance = async (fn, iterations = 1) => {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1_000_000); // Convert to milliseconds
  }
  
  return {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    times
  };
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});