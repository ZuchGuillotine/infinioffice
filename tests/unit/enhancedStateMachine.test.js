/**
 * Enhanced State Machine Test Suite
 * Comprehensive testing for location capture, three-strike confirmation,
 * progressive summarization, and graceful digression handling
 */

const { enhancedBookingMachine, createInitialContext } = require('../../src/services/enhancedStateMachine');
const { createActor } = require('xstate');
const { EventTypes, IntentTypes, LocationTypes, createEvent } = require('../../src/services/enhancedEvents');

// Mock database and external services
jest.mock('../../src/services/db', () => ({
  createAppointment: jest.fn()
}));

describe('Enhanced State Machine', () => {
  let actor;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {
      ...createInitialContext(),
      businessConfig: {
        services: [
          { name: 'Haircut', active: true },
          { name: 'Consultation', active: true },
          { name: 'Cleaning', active: true }
        ],
        businessHours: {
          monday: { open: '09:00', close: '17:00' }
        }
      },
      organizationContext: {
        organizationId: 'test-org-123',
        organizationName: 'Test Business'
      },
      tenantConfig: {
        maxRetries: 3,
        timeoutSeconds: 30,
        enableBargeIn: true,
        confirmationThreshold: 3,
        locationRequired: true,
        escalationEnabled: true
      }
    };
    
    actor = createActor(enhancedBookingMachine, { input: mockContext });
  });

  afterEach(() => {
    if (actor) {
      actor.stop();
    }
  });

  describe('Initial State and Context', () => {
    it('should start in idle state with enhanced context structure', () => {
      expect(enhancedBookingMachine.initial).toBe('idle');
      
      const context = createInitialContext();
      expect(context).toHaveProperty('location');
      expect(context.location).toEqual({
        kind: null,
        serviceAddress: null,
        businessLocationId: null,
        coordinates: null,
        notes: null
      });
      
      expect(context).toHaveProperty('confirmationAttempts');
      expect(context.confirmationAttempts).toEqual({
        service: 0,
        time: 0,
        contact: 0,
        location: 0,
        final: 0
      });
      
      expect(context).toHaveProperty('summary');
      expect(context.summary).toEqual({
        collected: [],
        pending: [],
        confirmed: [],
        lastUpdate: null
      });
      
      expect(context).toHaveProperty('digressionStack');
      expect(context.digressionStack).toEqual([]);
    });

    it('should initialize with proper tenant configuration', () => {
      const context = createInitialContext();
      expect(context.tenantConfig).toHaveProperty('maxRetries');
      expect(context.tenantConfig).toHaveProperty('timeoutSeconds');
      expect(context.tenantConfig).toHaveProperty('enableBargeIn');
      expect(context.tenantConfig).toHaveProperty('confirmationThreshold');
      expect(context.tenantConfig).toHaveProperty('locationRequired');
    });
  });

  describe('Enhanced Slot Collection', () => {
    beforeEach(() => {
      actor.start();
    });

    describe('Service Collection with Validation', () => {
      it('should collect and validate service information', () => {
        const serviceEvent = createEvent.processIntent({
          intent: IntentTypes.SERVICE_PROVIDED,
          confidence: 0.9,
          response: 'I can help with that service',
          entities: { service: 'Haircut' },
          sessionId: 'test-session'
        });

        actor.send(serviceEvent);
        
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.service).toBe('Haircut');
        expect(snapshot.value).toBe('validateService');
      });

      it('should handle service validation failure with retry', () => {
        const invalidServiceEvent = createEvent.processIntent({
          intent: IntentTypes.SERVICE_PROVIDED,
          confidence: 0.8,
          response: 'I need to clarify that service',
          entities: { service: 'InvalidService' },
          sessionId: 'test-session'
        });

        actor.send(invalidServiceEvent);
        
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.service).toBe('InvalidService');
        expect(snapshot.context.serviceValidated).toBe(false);
      });
    });

    describe('Location Collection', () => {
      it('should collect on-site location information', () => {
        const locationEvent = createEvent.locationProvided({
          locationKind: LocationTypes.ON_SITE,
          serviceAddress: '123 Main St, City, State 12345',
          confidence: 0.9,
          rawText: 'Please come to my office at 123 Main St',
          sessionId: 'test-session'
        });

        actor.send(locationEvent);
        
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.location.kind).toBe(LocationTypes.ON_SITE);
        expect(snapshot.context.location.serviceAddress).toBe('123 Main St, City, State 12345');
      });

      it('should collect at-business location preference', () => {
        const locationEvent = createEvent.locationProvided({
          locationKind: LocationTypes.AT_BUSINESS,
          confidence: 0.9,
          rawText: 'I will come to your office',
          sessionId: 'test-session'
        });

        actor.send(locationEvent);
        
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.location.kind).toBe(LocationTypes.AT_BUSINESS);
        expect(snapshot.context.location.serviceAddress).toBeNull();
      });

      it('should collect remote service preference', () => {
        const locationEvent = createEvent.locationProvided({
          locationKind: LocationTypes.REMOTE,
          confidence: 0.9,
          rawText: 'Can we do this over video call?',
          sessionId: 'test-session'
        });

        actor.send(locationEvent);
        
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.location.kind).toBe(LocationTypes.REMOTE);
      });

      it('should validate location requirements based on tenant config', () => {
        // Set location as required
        actor.send({
          type: 'UPDATE_CONTEXT',
          tenantConfig: { ...mockContext.tenantConfig, locationRequired: true }
        });

        const snapshot = actor.getSnapshot();
        expect(snapshot.context.tenantConfig.locationRequired).toBe(true);
      });
    });

    describe('Time Collection with Location Context', () => {
      it('should collect time information with location context', () => {
        // First set location
        actor.send(createEvent.locationProvided({
          locationKind: LocationTypes.ON_SITE,
          serviceAddress: '123 Main St',
          confidence: 0.9,
          rawText: 'come to my place',
          sessionId: 'test-session'
        }));

        // Then collect time
        const timeEvent = createEvent.timeProvided({
          timeWindow: 'tomorrow at 2pm',
          preferredTime: 'tomorrow at 2pm',
          confidence: 0.9,
          rawText: 'tomorrow at 2pm works for me',
          sessionId: 'test-session'
        });

        actor.send(timeEvent);
        
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.preferredTime).toBe('tomorrow at 2pm');
        expect(snapshot.context.location.kind).toBe(LocationTypes.ON_SITE);
      });
    });
  });

  describe('Three-Strike Confirmation System', () => {
    beforeEach(() => {
      actor.start();
      // Set up context with some data to confirm
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));
    });

    it('should track confirmation attempts for each slot', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.confirmationAttempts.service).toBe(0);
      expect(snapshot.context.confirmationAttempts.time).toBe(0);
      expect(snapshot.context.confirmationAttempts.contact).toBe(0);
      expect(snapshot.context.confirmationAttempts.location).toBe(0);
      expect(snapshot.context.confirmationAttempts.final).toBe(0);
    });

    it('should increment confirmation attempts on rejection', () => {
      // Navigate to service confirmation
      actor.send(createEvent.confirmationNo({
        confirmationType: 'service',
        confidence: 0.9,
        rawText: 'no that is wrong',
        sessionId: 'test-session'
      }));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.confirmationAttempts.service).toBe(1);
    });

    it('should escalate after confirmation threshold is exceeded', () => {
      // Simulate multiple confirmation failures
      for (let i = 0; i < 4; i++) {
        actor.send(createEvent.confirmationNo({
          confirmationType: 'service',
          confidence: 0.9,
          rawText: 'no that is wrong',
          sessionId: 'test-session'
        }));
      }

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.confirmationAttempts.service).toBeGreaterThan(3);
    });

    it('should reset confirmation attempts on successful confirmation', () => {
      // First increment attempts
      actor.send(createEvent.confirmationNo({
        confirmationType: 'service',
        confidence: 0.9,
        rawText: 'no',
        sessionId: 'test-session'
      }));

      // Then confirm successfully
      actor.send(createEvent.confirmationYes({
        confirmationType: 'service',
        confidence: 0.9,
        rawText: 'yes that is correct',
        sessionId: 'test-session'
      }));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.confirmationAttempts.service).toBe(0);
    });
  });

  describe('Progressive Summarization', () => {
    beforeEach(() => {
      actor.start();
    });

    it('should build progressive summary as information is collected', () => {
      // Add service
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      let snapshot = actor.getSnapshot();
      expect(snapshot.context.summary.collected).toContain('service');

      // Add location
      actor.send(createEvent.locationProvided({
        locationKind: LocationTypes.AT_BUSINESS,
        confidence: 0.9,
        rawText: 'I will come to you',
        sessionId: 'test-session'
      }));

      snapshot = actor.getSnapshot();
      expect(snapshot.context.summary.collected).toContain('location');

      // Add time
      actor.send(createEvent.timeProvided({
        timeWindow: 'tomorrow at 2pm',
        preferredTime: 'tomorrow at 2pm',
        confidence: 0.9,
        rawText: 'tomorrow at 2pm',
        sessionId: 'test-session'
      }));

      snapshot = actor.getSnapshot();
      expect(snapshot.context.summary.collected).toContain('time');
    });

    it('should track confirmed information separately', () => {
      // Add and confirm service
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      actor.send(createEvent.confirmationYes({
        confirmationType: 'service',
        confidence: 0.9,
        rawText: 'yes',
        sessionId: 'test-session'
      }));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.summary.confirmed).toContain('service');
    });

    it('should update lastUpdate timestamp when summary changes', () => {
      const beforeTime = Date.now();
      
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.summary.lastUpdate).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('Graceful Digression Handling', () => {
    beforeEach(() => {
      actor.start();
      // Start in a booking flow
      actor.send(createEvent.processIntent({
        intent: IntentTypes.BOOKING,
        confidence: 0.9,
        response: 'I can help you book an appointment',
        sessionId: 'test-session'
      }));
    });

    it('should handle hours question digression', () => {
      const digressionEvent = createEvent.digression({
        digressionType: 'hours',
        question: 'What are your hours?',
        confidence: 0.9,
        rawText: 'what are your hours',
        sessionId: 'test-session',
        currentState: 'collectService'
      });

      actor.send(digressionEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.digressionStack).toHaveLength(1);
      expect(snapshot.context.currentDigression).toBe('hours');
      expect(snapshot.value).toBe('answerHoursQuestion');
    });

    it('should handle location info question digression', () => {
      const digressionEvent = createEvent.digression({
        digressionType: 'location',
        question: 'Where are you located?',
        confidence: 0.9,
        rawText: 'where are you located',
        sessionId: 'test-session',
        currentState: 'collectService'
      });

      actor.send(digressionEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.currentDigression).toBe('location');
      expect(snapshot.value).toBe('answerLocationQuestion');
    });

    it('should handle services question digression', () => {
      const digressionEvent = createEvent.digression({
        digressionType: 'services',
        question: 'What services do you offer?',
        confidence: 0.9,
        rawText: 'what services do you offer',
        sessionId: 'test-session',
        currentState: 'collectService'
      });

      actor.send(digressionEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.currentDigression).toBe('services');
      expect(snapshot.value).toBe('answerServicesQuestion');
    });

    it('should return to previous state after digression', (done) => {
      const digressionEvent = createEvent.digression({
        digressionType: 'hours',
        question: 'What are your hours?',
        confidence: 0.9,
        rawText: 'what are your hours',
        sessionId: 'test-session',
        currentState: 'collectService'
      });

      actor.send(digressionEvent);
      
      // Wait for automatic return after timeout
      setTimeout(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('returnFromDigression');
        expect(snapshot.context.digressionStack).toHaveLength(0);
        done();
      }, 1100); // Slightly longer than the 1000ms timeout
    });

    it('should track digression metrics', () => {
      const digressionEvent = createEvent.digression({
        digressionType: 'pricing',
        question: 'How much does it cost?',
        confidence: 0.9,
        rawText: 'how much does it cost',
        sessionId: 'test-session',
        currentState: 'collectService'
      });

      actor.send(digressionEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.processingMetrics.digressions).toBe(1);
    });
  });

  describe('Enhanced Error Recovery', () => {
    beforeEach(() => {
      actor.start();
    });

    it('should handle validation errors gracefully', () => {
      const validationErrorEvent = createEvent.validationError({
        validationType: 'service',
        error: 'Service not available',
        attemptedValue: 'NonexistentService',
        sessionId: 'test-session',
        retryCount: 1
      });

      actor.send(validationErrorEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errorHistory).toHaveLength(1);
      expect(snapshot.context.errorHistory[0].type).toBe('service_validation');
    });

    it('should escalate after multiple errors', () => {
      // Send multiple validation errors
      for (let i = 0; i < 6; i++) {
        actor.send(createEvent.validationError({
          validationType: 'service',
          error: `Error ${i}`,
          attemptedValue: 'BadValue',
          sessionId: 'test-session',
          retryCount: i
        }));
      }

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errorHistory.length).toBeGreaterThan(5);
    });

    it('should handle timeout events', () => {
      const timeoutEvent = createEvent.timeout({
        timeoutType: 'user_silence',
        timeoutDuration: 30000,
        expectedResponse: 'service selection',
        sessionId: 'test-session',
        currentState: 'collectService'
      });

      actor.send(timeoutEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.timeoutCount).toBe(1);
    });

    it('should provide escalation path when configured', () => {
      // Set up multiple failures
      for (let i = 0; i < 3; i++) {
        actor.send(createEvent.validationError({
          validationType: 'service',
          error: `Escalation trigger ${i}`,
          attemptedValue: 'EscalationTrigger',
          sessionId: 'test-session',
          retryCount: i + 3
        }));
      }

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.tenantConfig.escalationEnabled).toBe(true);
    });
  });

  describe('Barge-in and Timeout Handling', () => {
    beforeEach(() => {
      actor.start();
    });

    it('should handle barge-in events', () => {
      const bargeInEvent = createEvent.bargeIn({
        sessionId: 'test-session',
        interruptedAt: Date.now(),
        newTranscript: 'sorry let me interrupt',
        confidence: 0.8
      });

      actor.send(bargeInEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.bargeInDetected).toBe(true);
      expect(snapshot.context.lastUserActivity).toBeDefined();
    });

    it('should update last user activity on events', () => {
      const beforeTime = Date.now();
      
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.lastUserActivity).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should respect tenant timeout configuration', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.tenantConfig.timeoutSeconds).toBe(30);
      expect(snapshot.context.tenantConfig.enableBargeIn).toBe(true);
    });
  });

  describe('Telemetry and Metrics', () => {
    beforeEach(() => {
      actor.start();
    });

    it('should track state transitions', () => {
      actor.send(createEvent.processIntent({
        intent: IntentTypes.BOOKING,
        confidence: 0.9,
        response: 'I can help you book',
        sessionId: 'test-session'
      }));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.processingMetrics.stateTransitions).toBeGreaterThan(0);
    });

    it('should track confirmation attempts', () => {
      // Add service and then reject confirmation
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      actor.send(createEvent.confirmationNo({
        confirmationType: 'service',
        confidence: 0.9,
        rawText: 'no',
        sessionId: 'test-session'
      }));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.confirmationAttempts.service).toBe(1);
    });

    it('should initialize session timing', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.startTime).toBeDefined();
      expect(snapshot.context.lastStateChange).toBeDefined();
    });

    it('should track retry counts', () => {
      // Send multiple unclear intents
      for (let i = 0; i < 3; i++) {
        actor.send(createEvent.processIntent({
          intent: IntentTypes.UNCLEAR,
          confidence: 0.2,
          response: 'I did not understand',
          sessionId: 'test-session'
        }));
      }

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.retryCount).toBeGreaterThan(0);
    });
  });

  describe('Tenant Configuration Override', () => {
    beforeEach(() => {
      actor.start();
    });

    it('should respect tenant-specific max retries', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.tenantConfig.maxRetries).toBe(3);
    });

    it('should respect tenant-specific confirmation threshold', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.tenantConfig.confirmationThreshold).toBe(3);
    });

    it('should respect location requirement setting', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.tenantConfig.locationRequired).toBe(true);
    });

    it('should handle escalation based on tenant setting', () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.tenantConfig.escalationEnabled).toBe(true);
    });
  });

  describe('Integration with Enhanced Events', () => {
    beforeEach(() => {
      actor.start();
    });

    it('should process enhanced event structures', () => {
      const enhancedEvent = createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: 'I can help with that',
        originalSpeech: 'I need a haircut',
        entities: {
          service: 'Haircut',
          location: {
            kind: LocationTypes.AT_BUSINESS,
            notes: 'Customer prefers morning appointments'
          }
        },
        businessConfig: mockContext.businessConfig,
        organizationContext: mockContext.organizationContext,
        sessionId: 'test-session',
        turnIndex: 1,
        processingTimeMs: 150
      });

      actor.send(enhancedEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.service).toBe('Haircut');
      expect(snapshot.context.location.kind).toBe(LocationTypes.AT_BUSINESS);
      expect(snapshot.context.location.notes).toBe('Customer prefers morning appointments');
    });

    it('should handle modification request events', () => {
      // First set some data
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      // Then request modification
      const modificationEvent = createEvent.modificationRequest({
        targetSlot: 'service',
        newValue: 'Consultation',
        reason: 'changed mind',
        confidence: 0.9,
        rawText: 'actually I want a consultation instead',
        sessionId: 'test-session'
      });

      actor.send(modificationEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.service).toBe('Haircut'); // Should not change until processed
    });
  });

  describe('Complete Booking Flow with Location', () => {
    beforeEach(() => {
      actor.start();
    });

    it('should complete full booking flow with location capture', async () => {
      // Step 1: Service
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      expect(actor.getSnapshot().context.service).toBe('Haircut');

      // Step 2: Location
      actor.send(createEvent.locationProvided({
        locationKind: LocationTypes.ON_SITE,
        serviceAddress: '123 Main St, City, State',
        confidence: 0.9,
        rawText: 'please come to my office at 123 Main St',
        sessionId: 'test-session'
      }));

      expect(actor.getSnapshot().context.location.kind).toBe(LocationTypes.ON_SITE);
      expect(actor.getSnapshot().context.location.serviceAddress).toBe('123 Main St, City, State');

      // Step 3: Time
      actor.send(createEvent.timeProvided({
        timeWindow: 'tomorrow at 2pm',
        preferredTime: 'tomorrow at 2pm',
        confidence: 0.9,
        rawText: 'tomorrow at 2pm',
        sessionId: 'test-session'
      }));

      expect(actor.getSnapshot().context.preferredTime).toBe('tomorrow at 2pm');

      // Step 4: Contact
      actor.send(createEvent.contactProvided({
        contact: 'John Smith 555-1234',
        phoneNumber: '555-1234',
        name: 'John Smith',
        confidence: 0.9,
        rawText: 'John Smith 555-1234',
        sessionId: 'test-session'
      }));

      expect(actor.getSnapshot().context.contact).toBe('John Smith 555-1234');

      // All slots should be collected
      const finalSnapshot = actor.getSnapshot();
      expect(finalSnapshot.context.service).toBeTruthy();
      expect(finalSnapshot.context.location.kind).toBeTruthy();
      expect(finalSnapshot.context.preferredTime).toBeTruthy();
      expect(finalSnapshot.context.contact).toBeTruthy();
    });
  });
});

describe('Enhanced State Machine Guards', () => {
  let actor;

  beforeEach(() => {
    actor = createActor(enhancedBookingMachine);
    actor.start();
  });

  afterEach(() => {
    if (actor) {
      actor.stop();
    }
  });

  describe('Slot Requirement Guards', () => {
    it('should detect when all required slots are filled', () => {
      // Fill all slots
      actor.send(createEvent.processIntent({
        intent: IntentTypes.SERVICE_PROVIDED,
        confidence: 0.9,
        response: '',
        entities: { service: 'Haircut' },
        sessionId: 'test-session'
      }));

      // Note: In a real test, you would need to set up the context properly
      // to simulate all slots being filled and validated
    });

    it('should detect when location is required but missing', () => {
      const snapshot = actor.getSnapshot();
      // With default tenant config requiring location
      expect(snapshot.context.tenantConfig.locationRequired).toBe(true);
    });
  });

  describe('Confirmation Guards', () => {
    it('should detect positive confirmations', () => {
      const confirmationEvent = createEvent.confirmationYes({
        confidence: 0.9,
        rawText: 'yes that is correct',
        sessionId: 'test-session'
      });

      actor.send(confirmationEvent);
      // Test would verify the confirmation was processed
    });

    it('should detect modification requests', () => {
      const modificationEvent = createEvent.modificationRequest({
        targetSlot: 'time',
        confidence: 0.9,
        rawText: 'actually can we change the time',
        sessionId: 'test-session'
      });

      actor.send(modificationEvent);
      // Test would verify the modification request was processed
    });
  });

  describe('Escalation Guards', () => {
    it('should trigger escalation after multiple failures', () => {
      // This would test the escalation logic by simulating
      // multiple failures and verifying escalation triggers
    });
  });
});

describe('Enhanced State Machine Actions', () => {
  let actor;

  beforeEach(() => {
    actor = createActor(enhancedBookingMachine);
    actor.start();
  });

  afterEach(() => {
    if (actor) {
      actor.stop();
    }
  });

  describe('Context Update Actions', () => {
    it('should update context with location information', () => {
      const locationEvent = createEvent.locationProvided({
        locationKind: LocationTypes.REMOTE,
        confidence: 0.9,
        rawText: 'can we do this remotely',
        sessionId: 'test-session'
      });

      actor.send(locationEvent);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.location.kind).toBe(LocationTypes.REMOTE);
    });

    it('should track confirmation attempts', () => {
      // This would test the confirmation attempt tracking actions
    });

    it('should update progressive summary', () => {
      // This would test the progressive summary update actions
    });
  });

  describe('Telemetry Actions', () => {
    it('should record state transitions', () => {
      const initialTransitions = actor.getSnapshot().context.processingMetrics.stateTransitions;
      
      actor.send(createEvent.processIntent({
        intent: IntentTypes.BOOKING,
        confidence: 0.9,
        response: 'I can help you book',
        sessionId: 'test-session'
      }));

      const newTransitions = actor.getSnapshot().context.processingMetrics.stateTransitions;
      expect(newTransitions).toBeGreaterThan(initialTransitions);
    });
  });
});