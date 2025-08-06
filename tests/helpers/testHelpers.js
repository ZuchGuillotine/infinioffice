/**
 * Test helper functions for InfiniOffice testing
 */

const { Readable } = require('stream');
const WebSocket = require('ws');

/**
 * Creates a mock audio stream for testing STT
 */
const createMockAudioStream = (data = 'mock audio data', chunks = 3) => {
  const stream = new Readable({
    read() {
      if (chunks > 0) {
        this.push(Buffer.from(data + chunks));
        chunks--;
      } else {
        this.push(null);
      }
    }
  });
  return stream;
};

/**
 * Creates a mock WebSocket connection for testing telephony
 */
const createMockWebSocket = () => {
  return {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: WebSocket.OPEN,
    ping: jest.fn(),
    pong: jest.fn()
  };
};

/**
 * Simulates realistic conversation latencies
 */
const simulateLatency = (ms = 500) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Creates a test conversation context
 */
const createConversationContext = (overrides = {}) => {
  return {
    callId: 'test-call-123',
    sessionId: 'session-456',
    state: 'greet',
    service: null,
    timeWindow: null,
    contact: null,
    attempts: 0,
    startTime: new Date(),
    ...overrides
  };
};

/**
 * Validates TwiML response structure
 */
const validateTwiMLResponse = (twiml) => {
  expect(twiml).toContain('<Response>');
  expect(twiml).toContain('</Response>');
  return true;
};

/**
 * Creates a mock Deepgram response for STT
 */
const createMockSTTResponse = (transcript = 'Hello world', isFinal = true) => {
  return {
    is_final: isFinal,
    channel: {
      alternatives: [
        {
          transcript,
          confidence: 0.95,
          words: transcript.split(' ').map((word, index) => ({
            word,
            start: index * 0.5,
            end: (index + 1) * 0.5,
            confidence: 0.95
          }))
        }
      ]
    },
    metadata: {
      request_id: 'test-request-123',
      model_info: {
        name: 'nova-2-phonecall',
        version: '1.0'
      }
    }
  };
};

/**
 * Creates a mock Deepgram response for TTS
 */
const createMockTTSResponse = () => {
  const mockStream = createMockAudioStream();
  return {
    getStream: () => mockStream,
    headers: {
      'content-type': 'audio/wav',
      'content-length': '1024'
    }
  };
};

/**
 * Creates a mock OpenAI completion response
 */
const createMockLLMResponse = (content = 'How can I help you today?') => {
  return {
    choices: [
      {
        message: {
          content,
          role: 'assistant'
        },
        finish_reason: 'stop',
        index: 0
      }
    ],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 20,
      total_tokens: 70
    },
    model: 'gpt-3.5-turbo-0125',
    id: 'test-completion-123'
  };
};

/**
 * Creates conversation scenarios for testing
 */
const createConversationScenarios = () => {
  return {
    happyPath: {
      name: 'Successful booking',
      turns: [
        { user: 'Hi, I need to book an appointment', expected: /help.*book/i },
        { user: 'I need a consultation', expected: /service.*time/i },
        { user: 'Tomorrow at 2 PM', expected: /contact/i },
        { user: 'John Smith, 555-1234', expected: /confirm/i },
        { user: 'Yes, that\'s correct', expected: /booked.*confirmed/i }
      ]
    },
    errorRecovery: {
      name: 'Error recovery and retry',
      turns: [
        { user: 'Hi there', expected: /help/i },
        { user: 'Um, I don\'t know', expected: /service.*need/i },
        { user: 'Maybe a haircut?', expected: /time/i },
        { user: 'Sometime next week', expected: /specific.*date/i },
        { user: 'Next Tuesday at 3', expected: /contact/i }
      ]
    },
    misunderstanding: {
      name: 'Handle misunderstandings',
      turns: [
        { user: 'I want to cancel', expected: /cancel.*book/i },
        { user: 'No, I want to book', expected: /service/i },
        { user: 'Dental cleaning', expected: /time/i },
        { user: 'This Friday morning', expected: /contact/i }
      ]
    }
  };
};

/**
 * Measures function execution time
 */
const measureExecutionTime = async (fn) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const timeMs = Number(end - start) / 1_000_000;
  
  return {
    result,
    timeMs,
    withinTarget: (target) => timeMs <= target
  };
};

/**
 * Validates conversation state transitions
 */
const validateStateTransition = (fromState, toState, event) => {
  const validTransitions = {
    greet: ['collectService'],
    collectService: ['collectTimeWindow'],
    collectTimeWindow: ['collectContact'],
    collectContact: ['confirm'],
    confirm: ['book', 'collectTimeWindow'],
    book: ['success', 'fallback'],
    fallback: ['collectService', 'greet'],
    success: []
  };

  const allowed = validTransitions[fromState] || [];
  return allowed.includes(toState);
};

module.exports = {
  createMockAudioStream,
  createMockWebSocket,
  simulateLatency,
  createConversationContext,
  validateTwiMLResponse,
  createMockSTTResponse,
  createMockTTSResponse,
  createMockLLMResponse,
  createConversationScenarios,
  measureExecutionTime,
  validateStateTransition
};