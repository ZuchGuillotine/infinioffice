/**
 * Enhanced Voice Pipeline Test Suite
 * 
 * Comprehensive tests for the enhanced voice agent features including:
 * - Location capture flows
 * - Three-strike confirmation system
 * - Progressive summarization
 * - Digression handling
 * - Tool-based LLM interface
 * - Performance metrics
 */

const { EnhancedVoicePipeline } = require('../../src/services/enhancedVoicePipeline');
const { enhancedBookingMachine } = require('../../src/services/enhancedStateMachine');
const { EnhancedLLMService } = require('../../src/services/enhancedLLM');

// Mock organization context for testing
const createMockOrganizationContext = (overrides = {}) => ({
  organizationId: 'test-org-123',
  organizationName: 'Test Hair Salon',
  businessConfig: {
    services: [
      { name: 'Haircut', active: true, defaultDuration: 30 },
      { name: 'Color', active: true, defaultDuration: 120 },
      { name: 'Perm', active: true, defaultDuration: 180 }
    ],
    locations: {
      mode: 'at_business',
      branches: [
        { id: 'main', name: 'Main Location', address: '123 Main St' },
        { id: 'downtown', name: 'Downtown Branch', address: '456 Oak Ave' }
      ]
    },
    greeting: 'Thank you for calling {{businessName}}. How can I help you?',
    scripts: {
      service: 'What service would you like to book today?',
      timeWindow: 'When would you prefer your {{service}}?',
      contact: 'Can I get your name and phone number?'
    },
    policies: {
      confirmationThresholds: {
        service: 3,
        timeWindow: 3,
        contact: 3,
        location: 3
      }
    },
    ...overrides
  }
});

describe('Enhanced Voice Pipeline', () => {
  let voicePipeline;
  let sessionId;
  let organizationContext;

  beforeEach(() => {
    voicePipeline = new EnhancedVoicePipeline({
      enableEnhancedFeatures: true,
      telemetryEnabled: true
    });
    sessionId = `test-session-${Date.now()}`;
    organizationContext = createMockOrganizationContext();
  });

  afterEach(() => {
    if (voicePipeline.activeSessions.has(sessionId)) {
      voicePipeline.finalizeSession(sessionId);
    }
  });

  describe('Session Management', () => {
    test('should initialize enhanced session correctly', () => {
      const session = voicePipeline.initializeSession(sessionId, organizationContext);
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
      expect(session.isEnhanced).toBe(true);
      expect(session.organizationContext).toEqual(organizationContext);
      expect(session.stateMachine).toBeDefined();
    });

    test('should track session state correctly', () => {
      voicePipeline.initializeSession(sessionId, organizationContext);
      const state = voicePipeline.getSessionState(sessionId);
      
      expect(state.sessionId).toBe(sessionId);
      expect(state.state).toBe('idle');
      expect(state.isEnhanced).toBe(true);
      expect(state.turnCount).toBe(0);
    });

    test('should finalize session and cleanup resources', () => {
      voicePipeline.initializeSession(sessionId, organizationContext);
      const metrics = voicePipeline.finalizeSession(sessionId);
      
      expect(metrics).toBeDefined();
      expect(metrics.sessionId).toBe(sessionId);
      expect(voicePipeline.activeSessions.has(sessionId)).toBe(false);
      expect(voicePipeline.performanceMetrics.has(sessionId)).toBe(false);
    });
  });

  describe('Basic Booking Flow', () => {
    beforeEach(() => {
      voicePipeline.initializeSession(sessionId, organizationContext);
    });

    test('should handle service request and confirmation', async () => {
      // Step 1: User requests a service
      const serviceResult = await voicePipeline.processTurn(
        sessionId,
        'I need a haircut',
        0.9,
        'call-123',
        1
      );

      expect(serviceResult.intent).toBe('service_provided');
      expect(serviceResult.entities.service).toBe('haircut');
      expect(serviceResult.state).toBe('confirmService');
      
      // Step 2: User confirms service
      const confirmResult = await voicePipeline.processTurn(
        sessionId,
        'yes that\'s correct',
        0.9,
        'call-123',
        2
      );

      expect(confirmResult.intent).toBe('confirmation_yes');
      expect(confirmResult.context.serviceValidated).toBe(true);
    });

    test('should collect time window after service confirmation', async () => {
      // Complete service confirmation first
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      // Now should ask for time
      const timeResult = await voicePipeline.processTurn(
        sessionId,
        'tomorrow at 2pm',
        0.9
      );

      expect(timeResult.intent).toBe('time_provided');
      expect(timeResult.entities.timeWindow).toContain('tomorrow');
      expect(timeResult.state).toBe('confirmTimeWindow');
    });

    test('should complete full booking flow', async () => {
      // Service
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      // Time
      await voicePipeline.processTurn(sessionId, 'tomorrow at 2pm', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      // Contact
      const contactResult = await voicePipeline.processTurn(
        sessionId,
        'My name is John and my phone is 555-1234',
        0.9
      );
      
      expect(contactResult.intent).toBe('contact_provided');
      expect(contactResult.entities.contact).toContain('John');
      
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      // Final confirmation
      const finalResult = await voicePipeline.processTurn(
        sessionId,
        'yes please book it',
        0.9
      );
      
      expect(finalResult.state).toBe('processBooking');
    });
  });

  describe('Location Capture', () => {
    test('should handle on-site service location capture', async () => {
      // Setup for on-site services
      const onSiteContext = createMockOrganizationContext({
        locations: { mode: 'on_site' }
      });
      
      voicePipeline.finalizeSession(sessionId); // Clean up existing
      voicePipeline.initializeSession(sessionId, onSiteContext);
      
      // Complete service confirmation
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      // Should now ask for location
      const locationResult = await voicePipeline.processTurn(
        sessionId,
        'at my home, 789 Pine Street',
        0.9
      );
      
      expect(locationResult.intent).toBe('location_provided');
      expect(locationResult.entities.serviceAddress).toContain('789 Pine Street');
      expect(locationResult.context.locationKind).toBe('on_site');
    });

    test('should handle multi-branch location selection', async () => {
      // Multi-branch context already set up in default mock
      voicePipeline.initializeSession(sessionId, organizationContext);
      
      // Complete service
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      // Time
      await voicePipeline.processTurn(sessionId, 'tomorrow at 2pm', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      // Should ask for location preference
      const locationResult = await voicePipeline.processTurn(
        sessionId,
        'at your downtown location',
        0.9
      );
      
      expect(locationResult.intent).toBe('location_provided');
      expect(locationResult.context.businessLocationId).toBe('downtown');
    });
  });

  describe('Three-Strike Confirmation System', () => {
    beforeEach(() => {
      voicePipeline.initializeSession(sessionId, organizationContext);
    });

    test('should escalate after three failed service confirmations', async () => {
      // First attempt
      await voicePipeline.processTurn(sessionId, 'I need something', 0.3);
      
      // Second attempt
      await voicePipeline.processTurn(sessionId, 'some kind of hair thing', 0.3);
      
      // Third attempt
      const thirdResult = await voicePipeline.processTurn(sessionId, 'I dont know', 0.2);
      
      // Should escalate after third failed attempt
      expect(thirdResult.context.confirmationAttempts.service).toBeGreaterThanOrEqual(3);
    });

    test('should reset confirmation attempts on successful validation', async () => {
      // Failed attempts
      await voicePipeline.processTurn(sessionId, 'something unclear', 0.3);
      await voicePipeline.processTurn(sessionId, 'still unclear', 0.3);
      
      // Successful attempt
      const successResult = await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      
      expect(successResult.context.confirmationAttempts.service).toBe(0);
      expect(successResult.context.serviceValidated).toBe(true);
    });
  });

  describe('Progressive Summarization', () => {
    beforeEach(() => {
      voicePipeline.initializeSession(sessionId, organizationContext);
    });

    test('should build progressive summary as information is collected', async () => {
      // Service
      const serviceResult = await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      expect(serviceResult.context.progressSummary).toContain('Haircut');
      
      // Time
      await voicePipeline.processTurn(sessionId, 'tomorrow at 2pm', 0.9);
      const timeResult = await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      expect(timeResult.context.progressSummary).toContain('Haircut');
      expect(timeResult.context.progressSummary).toContain('tomorrow');
      
      // Contact
      await voicePipeline.processTurn(sessionId, 'John Smith 555-1234', 0.9);
      const contactResult = await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      
      expect(contactResult.context.progressSummary).toContain('Haircut');
      expect(contactResult.context.progressSummary).toContain('tomorrow');
      expect(contactResult.context.progressSummary).toContain('John');
    });
  });

  describe('Digression Handling', () => {
    beforeEach(() => {
      voicePipeline.initializeSession(sessionId, organizationContext);
    });

    test('should handle hours inquiry during booking', async () => {
      // Start booking
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      
      // Ask about hours (digression)
      const hoursResult = await voicePipeline.processTurn(
        sessionId,
        'what are your hours?',
        0.9
      );
      
      expect(hoursResult.intent).toBe('digression_question');
      expect(hoursResult.state).toBe('answerHours');
      
      // Should return to booking context
      // This would be tested in integration with state machine
    });

    test('should maintain booking context during digression', async () => {
      // Start booking
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      const beforeDigression = voicePipeline.getSessionState(sessionId);
      
      // Digress to ask about services
      await voicePipeline.processTurn(sessionId, 'what services do you offer?', 0.9);
      
      // Context should be preserved in digression stack
      const afterDigression = voicePipeline.getSessionState(sessionId);
      expect(afterDigression.context.digressionStack).toBeDefined();
      expect(afterDigression.context.digressionStack.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      voicePipeline.initializeSession(sessionId, organizationContext);
    });

    test('should track turn-level performance metrics', async () => {
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      
      const metrics = voicePipeline.getSessionMetrics(sessionId);
      expect(metrics.turns).toHaveLength(1);
      expect(metrics.turns[0]).toHaveProperty('totalMs');
      expect(metrics.turns[0]).toHaveProperty('llmMs');
      expect(metrics.turns[0]).toHaveProperty('intent');
      expect(metrics.turns[0]).toHaveProperty('confidence');
    });

    test('should track barge-in events', () => {
      voicePipeline.handleBargeIn(sessionId);
      voicePipeline.handleBargeIn(sessionId);
      
      const metrics = voicePipeline.getSessionMetrics(sessionId);
      expect(metrics.bargeInCount).toBe(2);
    });

    test('should generate comprehensive final metrics', async () => {
      // Simulate a conversation
      await voicePipeline.processTurn(sessionId, 'I need a haircut', 0.9);
      await voicePipeline.processTurn(sessionId, 'yes', 0.9);
      voicePipeline.handleBargeIn(sessionId);
      
      const finalMetrics = voicePipeline.finalizeSession(sessionId);
      
      expect(finalMetrics).toHaveProperty('sessionId');
      expect(finalMetrics).toHaveProperty('duration');
      expect(finalMetrics).toHaveProperty('turnCount');
      expect(finalMetrics).toHaveProperty('avgTurnLatency');
      expect(finalMetrics).toHaveProperty('maxTurnLatency');
      expect(finalMetrics).toHaveProperty('bargeInCount');
      expect(finalMetrics).toHaveProperty('enhancedFeatures');
      
      expect(finalMetrics.turnCount).toBeGreaterThan(0);
      expect(finalMetrics.bargeInCount).toBe(1);
      expect(finalMetrics.enhancedFeatures).toBe(true);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    beforeEach(() => {
      voicePipeline.initializeSession(sessionId, organizationContext);
    });

    test('should handle LLM service errors gracefully', async () => {
      // Mock LLM service to throw error
      const originalProcessMessage = voicePipeline.llmService.processMessage;
      voicePipeline.llmService.processMessage = jest.fn().mockRejectedValue(
        new Error('LLM service unavailable')
      );
      
      const result = await voicePipeline.processTurn(sessionId, 'test message', 0.9);
      
      expect(result.intent).toBe('error');
      expect(result.response).toContain('trouble processing');
      expect(result.error).toBe('LLM service unavailable');
      
      // Restore original method
      voicePipeline.llmService.processMessage = originalProcessMessage;
    });

    test('should handle missing session gracefully', async () => {
      await expect(
        voicePipeline.processTurn('non-existent-session', 'test', 0.9)
      ).rejects.toThrow('Session not found');
    });

    test('should provide fallback responses for unclear intents', async () => {
      const result = await voicePipeline.processTurn(
        sessionId,
        'asdfghjkl random text',
        0.1
      );
      
      expect(result.intent).toBe('unclear');
      expect(result.response).toContain('understand');
    });
  });

  describe('Tool-Based LLM Interface', () => {
    beforeEach(() => {
      voicePipeline.initializeSession(sessionId, organizationContext);
    });

    test('should use tool calls for structured responses', async () => {
      const result = await voicePipeline.processTurn(
        sessionId,
        'I need a haircut appointment',
        0.9
      );
      
      // Check if tool calls were made
      expect(result.tool_calls).toBeDefined();
      if (result.tool_calls && result.tool_calls.length > 0) {
        expect(result.tool_calls[0]).toHaveProperty('function');
        expect(result.tool_calls[0].function).toHaveProperty('name');
      }
    });
  });

  describe('Health Check', () => {
    test('should provide health status', () => {
      const health = voicePipeline.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('activeSessions');
      expect(health).toHaveProperty('enhancedFeatures');
      expect(health).toHaveProperty('timestamp');
      
      expect(health.status).toBe('healthy');
      expect(health.enhancedFeatures).toBe(true);
    });
  });
});

describe('Enhanced State Machine Integration', () => {
  test('should use enhanced state machine for complex flows', () => {
    const stateMachine = enhancedBookingMachine;
    
    expect(stateMachine.id).toBe('enhancedBooking');
    expect(stateMachine.initial).toBe('idle');
    
    // Test that enhanced states exist
    const stateNodes = Object.keys(stateMachine.states);
    expect(stateNodes).toContain('collectLocation');
    expect(stateNodes).toContain('confirmLocation');
    expect(stateNodes).toContain('handleDigression');
    expect(stateNodes).toContain('answerHours');
    expect(stateNodes).toContain('escalateToHuman');
  });
});

describe('Enhanced LLM Service Integration', () => {
  let llmService;

  beforeEach(() => {
    llmService = new EnhancedLLMService();
  });

  afterEach(() => {
    llmService.clearSession('test-session');
  });

  test('should detect location-aware intents', async () => {
    const context = createMockOrganizationContext({
      locations: { mode: 'on_site' }
    });
    
    const result = await llmService.processMessage(
      'I need a haircut at my home on 123 Main Street',
      'test-session',
      context
    );
    
    expect(result.intent).toBe('service_provided');
    expect(result.entities).toHaveProperty('service');
    expect(result.entities.service.toLowerCase()).toContain('haircut');
  });

  test('should use tool calling for structured outputs', async () => {
    const context = createMockOrganizationContext();
    
    const result = await llmService.processMessage(
      'I need a haircut',
      'test-session',
      context
    );
    
    expect(result.tool_calls).toBeDefined();
    expect(result.tool_results).toBeDefined();
  });

  test('should handle business fact retrieval', async () => {
    const context = createMockOrganizationContext();
    
    const result = await llmService.processMessage(
      'what are your hours?',
      'test-session',
      context
    );
    
    expect(result.intent).toBe('digression_question');
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  let voicePipeline;
  let sessionId;

  beforeEach(() => {
    voicePipeline = new EnhancedVoicePipeline();
    sessionId = `perf-test-${Date.now()}`;
    voicePipeline.initializeSession(sessionId, createMockOrganizationContext());
  });

  afterEach(() => {
    voicePipeline.finalizeSession(sessionId);
  });

  test('should meet turn latency targets (≤1.5s)', async () => {
    const startTime = Date.now();
    
    const result = await voicePipeline.processTurn(
      sessionId,
      'I need a haircut appointment',
      0.9
    );
    
    const latency = Date.now() - startTime;
    expect(latency).toBeLessThan(1500); // 1.5 second target
    expect(result.processingTime.total).toBeLessThan(1500);
  });

  test('should handle concurrent sessions efficiently', async () => {
    const sessionCount = 5;
    const sessions = [];
    
    // Create multiple sessions
    for (let i = 0; i < sessionCount; i++) {
      const sid = `concurrent-${i}`;
      voicePipeline.initializeSession(sid, createMockOrganizationContext());
      sessions.push(sid);
    }
    
    // Process turns concurrently
    const promises = sessions.map((sid, index) => 
      voicePipeline.processTurn(sid, `I need a haircut ${index}`, 0.9)
    );
    
    const results = await Promise.all(promises);
    
    // All should complete successfully
    expect(results).toHaveLength(sessionCount);
    results.forEach(result => {
      expect(result.intent).toBe('service_provided');
      expect(result.processingTime.total).toBeLessThan(2000); // Generous limit for concurrent load
    });
    
    // Cleanup
    sessions.forEach(sid => voicePipeline.finalizeSession(sid));
  });
});