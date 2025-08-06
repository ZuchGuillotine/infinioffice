/**
 * Test conversation scenarios and fixture data for InfiniOffice testing
 */

// Successful booking conversations
const successfulBookings = [
  {
    name: 'Standard appointment booking',
    scenario: 'happy_path',
    expectedSuccess: true,
    turns: [
      {
        input: 'Hello, I need to schedule an appointment',
        expectedOutput: /help.*appointment.*service/i,
        expectedState: 'collectService'
      },
      {
        input: 'I need a dental cleaning',
        expectedOutput: /dental cleaning.*time/i,
        expectedState: 'collectTimeWindow'
      },
      {
        input: 'Tomorrow at 2 PM would be great',
        expectedOutput: /tomorrow.*2.*contact/i,
        expectedState: 'collectContact'
      },
      {
        input: 'My name is Sarah Johnson and my phone is 555-0123',
        expectedOutput: /Sarah Johnson.*555-0123.*confirm/i,
        expectedState: 'confirm'
      },
      {
        input: 'Yes, that looks perfect',
        expectedOutput: /booked.*confirmed/i,
        expectedState: 'success'
      }
    ]
  },
  {
    name: 'Quick booking with minimal conversation',
    scenario: 'concise_path',
    expectedSuccess: true,
    turns: [
      {
        input: 'Book haircut Friday 3pm, Mike 555-9876',
        expectedOutput: /haircut.*Friday.*3.*Mike.*confirm/i,
        expectedState: 'confirm'
      },
      {
        input: 'Correct',
        expectedOutput: /booked/i,
        expectedState: 'success'
      }
    ]
  }
];

// Error recovery scenarios
const errorRecoveryScenarios = [
  {
    name: 'Unclear service request with clarification',
    scenario: 'service_clarification',
    expectedSuccess: true,
    turns: [
      {
        input: 'Hi, I need something',
        expectedOutput: /service.*help/i,
        expectedState: 'collectService'
      },
      {
        input: 'Um, not sure exactly',
        expectedOutput: /what.*service.*need/i,
        expectedState: 'collectService'
      },
      {
        input: 'Maybe a consultation?',
        expectedOutput: /consultation.*time/i,
        expectedState: 'collectTimeWindow'
      },
      {
        input: 'Next week sometime',
        expectedOutput: /specific.*day.*time/i,
        expectedState: 'collectTimeWindow'
      },
      {
        input: 'Wednesday at 10 AM',
        expectedOutput: /Wednesday.*10.*contact/i,
        expectedState: 'collectContact'
      }
    ]
  },
  {
    name: 'Wrong information correction',
    scenario: 'information_correction',
    expectedSuccess: true,
    turns: [
      {
        input: 'Book massage for Monday 3pm',
        expectedOutput: /massage.*Monday.*3.*contact/i,
        expectedState: 'collectContact'
      },
      {
        input: 'Actually, make it Tuesday',
        expectedOutput: /Tuesday.*3.*contact/i,
        expectedState: 'collectContact'
      },
      {
        input: 'Lisa Brown, 555-4567',
        expectedOutput: /Lisa.*Tuesday.*3.*confirm/i,
        expectedState: 'confirm'
      },
      {
        input: 'Wait, I meant Wednesday',
        expectedOutput: /Wednesday.*3.*Lisa.*confirm/i,
        expectedState: 'confirm'
      },
      {
        input: 'Yes, Wednesday is right',
        expectedOutput: /booked/i,
        expectedState: 'success'
      }
    ]
  }
];

// Failure scenarios
const failureScenarios = [
  {
    name: 'Repeated misunderstandings leading to fallback',
    scenario: 'communication_failure',
    expectedSuccess: false,
    turns: [
      {
        input: 'Blah blah random words',
        expectedOutput: /help.*service/i,
        expectedState: 'collectService'
      },
      {
        input: 'Gibberish nonsense text',
        expectedOutput: /understand.*service/i,
        expectedState: 'collectService'
      },
      {
        input: 'More unclear speaking',
        expectedOutput: /difficulty.*transfer/i,
        expectedState: 'fallback'
      }
    ]
  },
  {
    name: 'User cancellation',
    scenario: 'user_cancellation',
    expectedSuccess: false,
    turns: [
      {
        input: 'I want to book an appointment',
        expectedOutput: /service/i,
        expectedState: 'collectService'
      },
      {
        input: 'Actually, never mind',
        expectedOutput: /understand.*help/i,
        expectedState: 'fallback'
      }
    ]
  }
];

// Edge case scenarios
const edgeCases = [
  {
    name: 'Multiple services mentioned',
    scenario: 'multiple_services',
    expectedSuccess: true,
    turns: [
      {
        input: 'I need a haircut and maybe a massage too',
        expectedOutput: /haircut.*massage.*which.*first/i,
        expectedState: 'collectService'
      },
      {
        input: 'Let\'s start with the haircut',
        expectedOutput: /haircut.*time/i,
        expectedState: 'collectTimeWindow'
      }
    ]
  },
  {
    name: 'Very specific time requirements',
    scenario: 'specific_timing',
    expectedSuccess: true,
    turns: [
      {
        input: 'Book consultation',
        expectedOutput: /consultation.*time/i,
        expectedState: 'collectTimeWindow'
      },
      {
        input: 'Next Thursday between 2:15 and 2:30 PM only',
        expectedOutput: /Thursday.*2:15.*2:30.*contact/i,
        expectedState: 'collectContact'
      }
    ]
  },
  {
    name: 'Background noise and unclear speech',
    scenario: 'noisy_environment',
    expectedSuccess: true,
    turns: [
      {
        input: '[BACKGROUND_NOISE] Hello I need... [UNCLEAR] ...pointment',
        expectedOutput: /appointment.*service/i,
        expectedState: 'collectService'
      },
      {
        input: '[STATIC] Dental... [NOISE] ...cleaning please',
        expectedOutput: /dental.*cleaning.*time/i,
        expectedState: 'collectTimeWindow'
      }
    ]
  }
];

// Performance test scenarios
const performanceScenarios = [
  {
    name: 'Rapid-fire booking (minimal pauses)',
    scenario: 'speed_test',
    maxTotalTime: 5000, // 5 seconds total
    maxTurnTime: 1500,  // 1.5 seconds per turn
    turns: [
      { input: 'Book haircut tomorrow 2pm John 555-1234', maxResponseTime: 1500 },
      { input: 'Yes confirm', maxResponseTime: 1000 }
    ]
  },
  {
    name: 'Complex booking with multiple clarifications',
    scenario: 'complexity_test',
    maxTotalTime: 15000, // 15 seconds total
    turns: [
      { input: 'I need to schedule something for my family', maxResponseTime: 1500 },
      { input: 'Multiple appointments for different services', maxResponseTime: 1500 },
      { input: 'Let\'s start with one appointment for massage', maxResponseTime: 1500 },
      { input: 'This Saturday morning if possible', maxResponseTime: 1500 },
      { input: 'Mary Smith 555-9999', maxResponseTime: 1500 },
      { input: 'Yes that works', maxResponseTime: 1000 }
    ]
  }
];

// Audio quality test scenarios
const audioQualityScenarios = [
  {
    name: 'High quality audio',
    audioQuality: 'high',
    sampleRate: 16000,
    bitRate: 128000,
    expectedAccuracy: 0.95
  },
  {
    name: 'Phone quality audio (8kHz)',
    audioQuality: 'phone',
    sampleRate: 8000,
    bitRate: 64000,
    expectedAccuracy: 0.85
  },
  {
    name: 'Low quality/compressed audio',
    audioQuality: 'low',
    sampleRate: 8000,
    bitRate: 32000,
    expectedAccuracy: 0.75
  }
];

// Accent and language variation scenarios
const accentScenarios = [
  {
    name: 'Standard American English',
    accent: 'us_standard',
    expectedAccuracy: 0.95,
    testPhrase: 'I would like to book an appointment for next Tuesday at three o\'clock'
  },
  {
    name: 'Southern American accent',
    accent: 'us_southern',
    expectedAccuracy: 0.90,
    testPhrase: 'I\'d like to book me an appointment for next Tuesday around three'
  },
  {
    name: 'British English accent',
    accent: 'uk_standard',
    expectedAccuracy: 0.90,
    testPhrase: 'I would like to book an appointment for next Tuesday at three o\'clock'
  },
  {
    name: 'Non-native English speaker',
    accent: 'non_native',
    expectedAccuracy: 0.80,
    testPhrase: 'I want to book appointment for Tuesday three clock'
  }
];

// Load testing scenarios
const loadTestScenarios = [
  {
    name: 'Single concurrent call',
    concurrentCalls: 1,
    callDuration: 180, // 3 minutes
    expectedSuccessRate: 0.98
  },
  {
    name: 'Low load (5 concurrent calls)',
    concurrentCalls: 5,
    callDuration: 180,
    expectedSuccessRate: 0.95
  },
  {
    name: 'Medium load (15 concurrent calls)',
    concurrentCalls: 15,
    callDuration: 180,
    expectedSuccessRate: 0.90
  },
  {
    name: 'High load (30 concurrent calls)',
    concurrentCalls: 30,
    callDuration: 180,
    expectedSuccessRate: 0.85
  },
  {
    name: 'Peak load (50 concurrent calls)',
    concurrentCalls: 50,
    callDuration: 180,
    expectedSuccessRate: 0.80
  }
];

module.exports = {
  successfulBookings,
  errorRecoveryScenarios,
  failureScenarios,
  edgeCases,
  performanceScenarios,
  audioQualityScenarios,
  accentScenarios,
  loadTestScenarios
};