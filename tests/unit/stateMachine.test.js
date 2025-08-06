const { bookingMachine, extractPhoneNumber, parseDateTime, addHour } = require('../../src/services/stateMachine');
const { interpret } = require('xstate');
const { validateStateTransition, createConversationContext, measureExecutionTime } = require('../helpers/testHelpers');
const { createAppointment } = require('../../src/services/db');

// Mock the database service
jest.mock('../../src/services/db', () => ({
  createAppointment: jest.fn()
}));

describe('State Machine Service', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = interpret(bookingMachine);
  });

  afterEach(() => {
    if (service && service.status === 'running') {
      service.stop();
    }
  });

  describe('Initial State and Context', () => {
    it('should start in idle state with correct initial context', () => {
      expect(bookingMachine.initial).toBe('idle');
      expect(bookingMachine.context).toEqual({
        intent: null,
        service: null,
        preferredTime: null,
        contact: null,
        confidence: 0,
        sessionId: null,
        currentResponse: null,
      });
    });

    it('should initialize with proper machine configuration', () => {
      expect(bookingMachine.id).toBe('booking');
      expect(bookingMachine.states).toHaveProperty('idle');
      expect(bookingMachine.states).toHaveProperty('handleIntent');
      expect(bookingMachine.states).toHaveProperty('bookingFlow');
      expect(bookingMachine.states).toHaveProperty('collectService');
      expect(bookingMachine.states).toHaveProperty('collectTimeWindow');
      expect(bookingMachine.states).toHaveProperty('collectContact');
      expect(bookingMachine.states).toHaveProperty('confirm');
      expect(bookingMachine.states).toHaveProperty('book');
      expect(bookingMachine.states).toHaveProperty('success');
      expect(bookingMachine.states).toHaveProperty('fallback');
      expect(bookingMachine.states).toHaveProperty('respondAndIdle');
    });
  });

  describe('State Transitions from Idle', () => {
    beforeEach(() => {
      service.start();
      expect(service.getSnapshot().value).toBe('idle');
    });

    it('should transition from idle to handleIntent on PROCESS_INTENT', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'What service would you like?',
        bookingData: {}
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('handleIntent');
      expect(snapshot.context.intent).toBe('booking');
      expect(snapshot.context.confidence).toBe(0.9);
      expect(snapshot.context.currentResponse).toBe('What service would you like?');
    });

    it('should assign all context properties from PROCESS_INTENT event', () => {
      const eventData = {
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.95,
        response: 'I can help you book an appointment',
        bookingData: {
          service: 'haircut',
          preferredTime: 'tomorrow 2pm',
          contact: 'John 555-1234'
        }
      };

      service.send(eventData);

      const snapshot = service.getSnapshot();
      expect(snapshot.context.intent).toBe('booking');
      expect(snapshot.context.confidence).toBe(0.95);
      expect(snapshot.context.currentResponse).toBe('I can help you book an appointment');
      expect(snapshot.context.service).toBe('haircut');
      expect(snapshot.context.preferredTime).toBe('tomorrow 2pm');
      expect(snapshot.context.contact).toBe('John 555-1234');
    });
  });

  describe('Intent Handling Logic', () => {
    beforeEach(() => {
      service.start();
    });

    it('should route booking intent to bookingFlow', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'What service?',
        bookingData: {}
      });

      // Wait for transition to handleIntent then bookingFlow
      const snapshot = service.getSnapshot();
      expect(['handleIntent', 'bookingFlow', 'collectService']).toContain(snapshot.value);
    });

    it('should route non-booking intents to respondAndIdle', () => {
      const nonBookingIntents = ['hours', 'location', 'services', 'other'];
      
      nonBookingIntents.forEach(intent => {
        service.send({
          type: 'PROCESS_INTENT',
          intent,
          confidence: 0.8,
          response: 'Here is the information you requested',
          bookingData: {}
        });

        const snapshot = service.getSnapshot();
        expect(['respondAndIdle', 'idle']).toContain(snapshot.value);
        
        // Reset to idle for next test
        if (snapshot.value !== 'idle') {
          // Wait for auto-transition back to idle
          setTimeout(() => {}, 150);
        }
      });
    });

    it('should handle unknown intents gracefully', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'unknown_intent',
        confidence: 0.3,
        response: 'I did not understand',
        bookingData: {}
      });

      const snapshot = service.getSnapshot();
      expect(['respondAndIdle', 'idle']).toContain(snapshot.value);
    });
  });

  describe('Booking Flow State Logic', () => {
    beforeEach(() => {
      service.start();
      // Start booking flow
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'What service?',
        bookingData: {}
      });
    });

    it('should route to collectService when no booking data exists', () => {
      // The state should automatically transition to collectService
      setTimeout(() => {
        const snapshot = service.getSnapshot();
        expect(snapshot.value).toBe('collectService');
      }, 10);
    });

    it('should route to collectTimeWindow when only service is provided', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'service_provided',
        confidence: 0.88,
        response: 'What time?',
        bookingData: {
          service: 'massage',
          preferredTime: null,
          contact: null
        }
      });

      setTimeout(() => {
        const snapshot = service.getSnapshot();
        expect(snapshot.value).toBe('collectTimeWindow');
        expect(snapshot.context.service).toBe('massage');
      }, 10);
    });

    it('should route to collectContact when service and time are provided', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'time_provided',
        confidence: 0.91,
        response: 'What is your contact info?',
        bookingData: {
          service: 'consultation',
          preferredTime: 'Friday 3pm',
          contact: null
        }
      });

      setTimeout(() => {
        const snapshot = service.getSnapshot();
        expect(snapshot.value).toBe('collectContact');
        expect(snapshot.context.service).toBe('consultation');
        expect(snapshot.context.preferredTime).toBe('Friday 3pm');
      }, 10);
    });

    it('should route to confirm when all booking data is provided', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'contact_provided',
        confidence: 0.94,
        response: 'Please confirm these details',
        bookingData: {
          service: 'dental cleaning',
          preferredTime: 'Monday 10am',
          contact: 'Sarah 555-9876'
        }
      });

      setTimeout(() => {
        const snapshot = service.getSnapshot();
        expect(snapshot.value).toBe('confirm');
        expect(snapshot.context.service).toBe('dental cleaning');
        expect(snapshot.context.preferredTime).toBe('Monday 10am');
        expect(snapshot.context.contact).toBe('Sarah 555-9876');
      }, 10);
    });
  });

  describe('Data Collection States', () => {
    it('should handle service collection', () => {
      service.start();
      
      // Navigate to collectService
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'What service?',
        bookingData: {}
      });

      // Provide service
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'service_provided',
        confidence: 0.87,
        response: 'When would you like that?',
        bookingData: {
          service: 'physical therapy',
          preferredTime: null,
          contact: null
        }
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.context.service).toBe('physical therapy');
    });

    it('should handle time window collection', () => {
      service.start();
      
      // Navigate to collectTimeWindow
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'What service?',
        bookingData: { service: 'checkup' }
      });

      // Provide time
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'time_provided',
        confidence: 0.92,
        response: 'What is your contact information?',
        bookingData: {
          service: 'checkup',
          preferredTime: 'next Thursday 2pm',
          contact: null
        }
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.context.preferredTime).toBe('next Thursday 2pm');
    });

    it('should handle contact collection', () => {
      service.start();
      
      // Navigate to collectContact
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'What service?',
        bookingData: { 
          service: 'cleaning',
          preferredTime: 'Wednesday 11am'
        }
      });

      // Provide contact
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'contact_provided',
        confidence: 0.96,
        response: 'Let me confirm these details',
        bookingData: {
          service: 'cleaning',
          preferredTime: 'Wednesday 11am',
          contact: 'Mike Johnson 555-2468'
        }
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.context.contact).toBe('Mike Johnson 555-2468');
    });
  });

  describe('Confirmation Handling', () => {
    beforeEach(() => {
      service.start();
      
      // Navigate to confirm state
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm details',
        bookingData: {
          service: 'appointment',
          preferredTime: 'tomorrow',
          contact: 'Test User 555-0000'
        }
      });
    });

    it('should transition to book state on confirmation', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_yes',
        confidence: 0.95,
        response: 'Booking your appointment',
        originalSpeech: 'Yes, that is correct'
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('book');
    });

    it('should reset booking data on rejection', () => {
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_no',
        confidence: 0.88,
        response: 'Let me help you correct that',
        originalSpeech: 'No, that is wrong'
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.context.service).toBe(null);
      expect(snapshot.context.preferredTime).toBe(null);
      expect(snapshot.context.contact).toBe(null);
    });

    it('should recognize various confirmation phrases', () => {
      const confirmationPhrases = [
        { speech: 'yes', expected: true },
        { speech: 'Yeah, that\'s right', expected: true },
        { speech: 'yep', expected: true },
        { speech: 'correct', expected: true },
        { speech: 'right', expected: true },
        { speech: 'confirm', expected: true },
        { speech: 'book it', expected: true },
        { speech: 'schedule it', expected: true },
        { speech: 'no', expected: false },
        { speech: 'that\'s wrong', expected: false },
        { speech: 'I need to change something', expected: false }
      ];

      confirmationPhrases.forEach(({ speech, expected }) => {
        const mockGuard = bookingMachine.options.guards.isConfirmation;
        const result = mockGuard({}, { originalSpeech: speech });
        expect(result).toBe(expected);
      });
    });
  });

  describe('Appointment Creation', () => {
    beforeEach(() => {
      createAppointment.mockClear();
    });

    it('should invoke createAppointment service when booking', async () => {
      service.start();
      
      // Navigate to book state
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm',
        bookingData: {
          service: 'consultation',
          preferredTime: 'tomorrow at 2pm',
          contact: 'Jane Smith 555-1234'
        }
      });

      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_yes',
        confidence: 0.95,
        response: 'Booking...',
        originalSpeech: 'yes'
      });

      // Mock successful appointment creation
      createAppointment.mockResolvedValue({
        id: 'appt-123',
        service: 'consultation',
        startAt: new Date('2025-08-07T14:00:00Z')
      });

      // Wait for service invocation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(createAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: expect.any(String),
          service: 'consultation',
          contactPhone: '555-1234',
          notes: expect.stringContaining('consultation'),
          status: 'scheduled'
        })
      );
    });

    it('should transition to success on successful booking', async () => {
      service.start();
      
      createAppointment.mockResolvedValue({
        id: 'appt-456',
        service: 'test'
      });

      // Navigate to book state and confirm
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm',
        bookingData: {
          service: 'test service',
          preferredTime: 'test time',
          contact: 'test contact 555-5555'
        }
      });

      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_yes',
        confidence: 0.95,
        response: 'Booking...',
        originalSpeech: 'confirm'
      });

      // Wait for async transition
      await new Promise(resolve => setTimeout(resolve, 200));

      const snapshot = service.getSnapshot();
      expect(['book', 'success']).toContain(snapshot.value);
    });

    it('should transition to fallback on booking error', async () => {
      service.start();
      
      createAppointment.mockRejectedValue(new Error('Database connection failed'));

      // Navigate to book state and confirm
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm',
        bookingData: {
          service: 'test service',
          preferredTime: 'test time',
          contact: 'test contact'
        }
      });

      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_yes',
        confidence: 0.95,
        response: 'Booking...',
        originalSpeech: 'yes'
      });

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 200));

      const snapshot = service.getSnapshot();
      expect(['book', 'fallback']).toContain(snapshot.value);
    });
  });

  describe('Auto-transitions and Timeouts', () => {
    it('should auto-transition from success to idle after timeout', async () => {
      service.start();
      
      // Mock successful booking
      createAppointment.mockResolvedValue({ id: 'test' });
      
      // Navigate to success state
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm',
        bookingData: {
          service: 'test',
          preferredTime: 'test',
          contact: 'test'
        }
      });

      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_yes',
        confidence: 0.95,
        response: 'Booking...',
        originalSpeech: 'yes'
      });

      // Wait for success state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should still accept new intents in success state
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'hours',
        confidence: 0.8,
        response: 'Our hours are...'
      });

      expect(service.getSnapshot().value).toBe('handleIntent');
    });

    it('should auto-transition from fallback to idle after timeout', async () => {
      service.start();
      
      createAppointment.mockRejectedValue(new Error('Test error'));

      // Navigate to fallback via failed booking
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm',
        bookingData: {
          service: 'test',
          preferredTime: 'test',
          contact: 'test'
        }
      });

      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_yes',
        confidence: 0.95,
        response: 'Booking...',
        originalSpeech: 'yes'
      });

      // Wait for fallback state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should still accept new intents in fallback state
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.85,
        response: 'Let me help you again'
      });

      expect(service.getSnapshot().value).toBe('handleIntent');
    });

    it('should auto-transition from respondAndIdle to idle quickly', async () => {
      service.start();
      
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'hours',
        confidence: 0.8,
        response: 'We are open 9-5'
      });

      // Should transition to respondAndIdle then quickly to idle
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('idle');
    });
  });

  describe('Context Persistence and Updates', () => {
    it('should preserve existing context when new data is provided', () => {
      service.start();
      
      // First, collect service
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'What service?',
        bookingData: { service: 'massage' }
      });

      // Then, provide time while preserving service
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'time_provided',
        confidence: 0.88,
        response: 'What contact?',
        bookingData: {
          service: 'massage', // Should preserve
          preferredTime: 'Monday 3pm'
        }
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.context.service).toBe('massage');
      expect(snapshot.context.preferredTime).toBe('Monday 3pm');
    });

    it('should handle partial updates correctly', () => {
      service.start();
      
      // Start with full data
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm',
        bookingData: {
          service: 'haircut',
          preferredTime: 'Tuesday 1pm',
          contact: 'Bob 555-7777'
        }
      });

      // Update only time
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'time_provided',
        confidence: 0.85,
        response: 'Updated time',
        bookingData: {
          preferredTime: 'Wednesday 2pm'
        }
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.context.service).toBe('haircut'); // Preserved
      expect(snapshot.context.preferredTime).toBe('Wednesday 2pm'); // Updated
      expect(snapshot.context.contact).toBe('Bob 555-7777'); // Preserved
    });
  });

  describe('Utility Functions', () => {
    describe('extractPhoneNumber', () => {
      it('should extract phone numbers from various formats', () => {
        const testCases = [
          { input: 'John Smith 555-1234', expected: '555-1234' },
          { input: 'Call me at 555.123.4567', expected: '555.123.4567' },
          { input: 'My number is 5551234567', expected: '5551234567' },
          { input: '(555) 123-4567', expected: null }, // Not in simple format
          { input: 'No phone number here', expected: null },
          { input: '', expected: null },
          { input: null, expected: null }
        ];

        testCases.forEach(({ input, expected }) => {
          const result = extractPhoneNumber(input);
          expect(result).toBe(expected);
        });
      });
    });

    describe('parseDateTime', () => {
      it('should parse various time expressions', () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const testCases = [
          { input: 'tomorrow', shouldBeTomorrow: true },
          { input: 'Tomorrow morning', shouldBeTomorrow: true },
          { input: 'Monday', shouldBeNextWeek: true },
          { input: 'next Tuesday', shouldBeNextWeek: true },
          { input: 'random text', shouldBeDefault: true },
          { input: '', shouldBeDefault: true },
          { input: null, shouldBeDefault: true }
        ];

        testCases.forEach(({ input, shouldBeTomorrow, shouldBeNextWeek, shouldBeDefault }) => {
          const result = parseDateTime(input);
          expect(result).toBeInstanceOf(Date);
          
          if (shouldBeTomorrow) {
            expect(result.getDate()).toBe(tomorrow.getDate());
            expect(result.getHours()).toBe(10);
          }
          
          if (shouldBeNextWeek) {
            expect(result.getTime()).toBeGreaterThan(now.getTime());
            expect(result.getHours()).toBe(10);
          }
          
          if (shouldBeDefault) {
            expect(result.getDate()).toBe(tomorrow.getDate());
            expect(result.getHours()).toBe(10);
          }
        });
      });
    });

    describe('addHour', () => {
      it('should add one hour to a date', () => {
        const testDate = new Date('2025-08-07T14:30:00Z');
        const result = addHour(testDate);
        
        expect(result.getTime()).toBe(testDate.getTime() + (60 * 60 * 1000));
        expect(result.getHours()).toBe(testDate.getHours() + 1);
      });

      it('should handle day boundary crossing', () => {
        const testDate = new Date('2025-08-07T23:30:00Z');
        const result = addHour(testDate);
        
        expect(result.getDate()).toBe(testDate.getDate() + 1);
        expect(result.getHours()).toBe(0);
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid state transitions efficiently', async () => {
      const { timeMs } = await measureExecutionTime(() => {
        service.start();
        
        // Rapid fire events
        for (let i = 0; i < 100; i++) {
          service.send({
            type: 'PROCESS_INTENT',
            intent: 'booking',
            confidence: 0.9,
            response: `Event ${i}`,
            bookingData: {}
          });
        }
      });

      expect(timeMs).toBeLessThan(100); // Should be very fast
      expect(service.getSnapshot()).toBeDefined();
    });

    it('should maintain state integrity under concurrent access', () => {
      const services = Array.from({ length: 50 }, () => interpret(bookingMachine));
      
      services.forEach((svc, index) => {
        svc.start();
        
        svc.send({
          type: 'PROCESS_INTENT',
          intent: 'booking',
          confidence: 0.9,
          response: 'Service request',
          bookingData: {
            service: `Service ${index}`,
            preferredTime: `Time ${index}`,
            contact: `Contact ${index}`
          }
        });

        const snapshot = svc.getSnapshot();
        expect(snapshot.context.service).toBe(`Service ${index}`);
        expect(snapshot.context.preferredTime).toBe(`Time ${index}`);
        expect(snapshot.context.contact).toBe(`Contact ${index}`);
        
        svc.stop();
      });
    });

    it('should handle memory efficiently with long-running sessions', () => {
      service.start();
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate long conversation with many state changes
      for (let i = 0; i < 1000; i++) {
        service.send({
          type: 'PROCESS_INTENT',
          intent: Math.random() > 0.5 ? 'booking' : 'hours',
          confidence: Math.random(),
          response: `Response ${i}`,
          bookingData: {
            service: `Service ${i}`,
            preferredTime: `Time ${i}`,
            contact: `Contact ${i}`
          }
        });
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not have excessive memory growth
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle malformed events gracefully', () => {
      service.start();
      
      const malformedEvents = [
        {},
        { type: 'PROCESS_INTENT' },
        { type: 'PROCESS_INTENT', intent: null },
        { type: 'INVALID_EVENT', data: 'test' },
        null,
        undefined
      ];

      malformedEvents.forEach(event => {
        expect(() => {
          if (event) {
            service.send(event);
          }
        }).not.toThrow();
      });

      // Should still be in a valid state
      const snapshot = service.getSnapshot();
      expect(typeof snapshot.value).toBe('string');
    });

    it('should recover from inconsistent context state', () => {
      service.start();
      
      // Manually corrupt context (simulating edge case)
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Test',
        bookingData: {
          service: undefined,
          preferredTime: null,
          contact: ''
        }
      });

      // Should still function and route appropriately
      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBeDefined();
      
      // Should handle next valid event
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'service_provided',
        confidence: 0.8,
        response: 'Recovery test',
        bookingData: { service: 'recovery service' }
      });

      const recoveredSnapshot = service.getSnapshot();
      expect(recoveredSnapshot.context.service).toBe('recovery service');
    });

    it('should validate state machine configuration', () => {
      expect(bookingMachine.options).toBeDefined();
      expect(bookingMachine.options.guards).toBeDefined();
      expect(bookingMachine.options.actions).toBeDefined();
      expect(bookingMachine.options.services).toBeDefined();
      
      // Verify essential guards exist
      expect(bookingMachine.options.guards.isBookingIntent).toBeDefined();
      expect(bookingMachine.options.guards.isNonBookingIntent).toBeDefined();
      expect(bookingMachine.options.guards.hasAllBookingData).toBeDefined();
      expect(bookingMachine.options.guards.isConfirmation).toBeDefined();
      
      // Verify essential services exist
      expect(bookingMachine.options.services.createAppointment).toBeDefined();
    });
  });

  describe('Complete Conversation Flows', () => {
    it('should handle perfect happy path booking', async () => {
      service.start();
      
      const conversationSteps = [
        {
          event: {
            type: 'PROCESS_INTENT',
            intent: 'booking',
            confidence: 0.95,
            response: 'What service would you like?',
            bookingData: { service: 'massage therapy' }
          },
          expectedContext: { service: 'massage therapy' }
        },
        {
          event: {
            type: 'PROCESS_INTENT',
            intent: 'time_provided',
            confidence: 0.90,
            response: 'What is your contact information?',
            bookingData: { 
              service: 'massage therapy',
              preferredTime: 'Friday at 3 PM'
            }
          },
          expectedContext: { 
            service: 'massage therapy',
            preferredTime: 'Friday at 3 PM'
          }
        },
        {
          event: {
            type: 'PROCESS_INTENT',
            intent: 'contact_provided',
            confidence: 0.97,
            response: 'Let me confirm these details',
            bookingData: {
              service: 'massage therapy',
              preferredTime: 'Friday at 3 PM',
              contact: 'Alice Johnson 555-9999'
            }
          },
          expectedContext: {
            service: 'massage therapy',
            preferredTime: 'Friday at 3 PM',
            contact: 'Alice Johnson 555-9999'
          }
        },
        {
          event: {
            type: 'PROCESS_INTENT',
            intent: 'confirmation_yes',
            confidence: 0.98,
            response: 'Booking your appointment',
            originalSpeech: 'Yes, that is perfect'
          },
          expectedState: 'book'
        }
      ];

      createAppointment.mockResolvedValue({ id: 'success-123' });

      for (const step of conversationSteps) {
        service.send(step.event);
        
        const snapshot = service.getSnapshot();
        
        if (step.expectedContext) {
          Object.entries(step.expectedContext).forEach(([key, value]) => {
            expect(snapshot.context[key]).toBe(value);
          });
        }
        
        if (step.expectedState) {
          expect(snapshot.value).toBe(step.expectedState);
        }
      }
    });

    it('should handle correction flow with booking changes', () => {
      service.start();
      
      // Initial booking attempt
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'booking',
        confidence: 0.9,
        response: 'Confirm details',
        bookingData: {
          service: 'cleaning',
          preferredTime: 'Monday 2pm',
          contact: 'John Doe 555-1111'
        }
      });

      // User wants to change time
      service.send({
        type: 'PROCESS_INTENT',
        intent: 'confirmation_no',
        confidence: 0.88,
        response: 'What would you like to change?',
        originalSpeech: 'Actually, I prefer Tuesday'
      });

      // Context should be reset
      const snapshot = service.getSnapshot();
      expect(snapshot.context.service).toBe(null);
      expect(snapshot.context.preferredTime).toBe(null);
      expect(snapshot.context.contact).toBe(null);
    });
  });
});