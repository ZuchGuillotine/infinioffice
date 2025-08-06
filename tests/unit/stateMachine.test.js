const { bookingMachine } = require('../../src/services/stateMachine');
const { createMachine, interpret } = require('xstate');
const { validateStateTransition, createConversationContext } = require('../helpers/testHelpers');

describe('State Machine Service', () => {
  let service;

  beforeEach(() => {
    service = interpret(bookingMachine);
  });

  afterEach(() => {
    if (service) {
      service.stop();
    }
  });

  describe('Initial State', () => {
    it('should start in greet state', () => {
      expect(bookingMachine.initial).toBe('greet');
    });

    it('should have correct initial context', () => {
      expect(bookingMachine.context).toEqual({
        service: null,
        timeWindow: null,
        contact: null
      });
    });
  });

  describe('State Transitions', () => {
    it('should transition from greet to collectService on HEAR_SPEECH', () => {
      service.start();
      
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'Hello, I need an appointment'
      });

      expect(service.getSnapshot().value).toBe('collectService');
    });

    it('should collect service and transition to collectTimeWindow', () => {
      service.start();
      
      // Move to collectService
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'Hello'
      });

      // Collect service
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'I need a dental cleaning'
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('collectTimeWindow');
      expect(snapshot.context.service).toBe('I need a dental cleaning');
    });

    it('should collect time window and transition to collectContact', () => {
      service.start();
      
      // Navigate to collectTimeWindow
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Dental cleaning' });

      // Collect time window
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'Tomorrow at 2 PM'
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('collectContact');
      expect(snapshot.context.timeWindow).toBe('Tomorrow at 2 PM');
    });

    it('should collect contact and transition to confirm', () => {
      service.start();
      
      // Navigate to collectContact
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Dental cleaning' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Tomorrow at 2 PM' });

      // Collect contact
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'John Smith, 555-1234'
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('confirm');
      expect(snapshot.context.contact).toBe('John Smith, 555-1234');
    });

    it('should transition from confirm to book on yes confirmation', () => {
      service.start();
      
      // Navigate to confirm state
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Dental cleaning' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Tomorrow at 2 PM' });
      service.send({ type: 'HEAR_SPEECH', speech: 'John Smith, 555-1234' });

      // Confirm booking
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'Yes, that looks correct'
      });

      expect(service.getSnapshot().value).toBe('book');
    });

    it('should transition from confirm back to collectTimeWindow on no confirmation', () => {
      service.start();
      
      // Navigate to confirm state
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Dental cleaning' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Tomorrow at 2 PM' });
      service.send({ type: 'HEAR_SPEECH', speech: 'John Smith, 555-1234' });

      // Reject confirmation
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'No, that\'s wrong'
      });

      expect(service.getSnapshot().value).toBe('collectTimeWindow');
    });
  });

  describe('Context Management', () => {
    it('should preserve context across state transitions', () => {
      service.start();
      
      // Collect all information
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Massage therapy' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Friday at 3 PM' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Jane Doe, 555-9876' });

      const snapshot = service.getSnapshot();
      expect(snapshot.context).toEqual({
        service: 'Massage therapy',
        timeWindow: 'Friday at 3 PM',
        contact: 'Jane Doe, 555-9876'
      });
    });

    it('should preserve service and contact when returning to collectTimeWindow', () => {
      service.start();
      
      // Navigate through full flow
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Consultation' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Monday morning' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Bob Wilson, 555-4321' });

      // Reject confirmation (should go back to collectTimeWindow)
      service.send({ type: 'HEAR_SPEECH', speech: 'Actually, let me change the time' });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('collectTimeWindow');
      expect(snapshot.context.service).toBe('Consultation');
      expect(snapshot.context.contact).toBe('Bob Wilson, 555-4321');
      // timeWindow might be updated or preserved depending on implementation
    });
  });

  describe('Actions', () => {
    it('should execute logSpeech action on HEAR_SPEECH in greet state', () => {
      const logSpeechSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      service.start();
      
      service.send({
        type: 'HEAR_SPEECH',
        speech: 'Hello there'
      });

      expect(logSpeechSpy).toHaveBeenCalledWith('Hello there');
      
      logSpeechSpy.mockRestore();
    });

    it('should assign service context correctly', () => {
      service.start();
      
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      
      const testService = 'Physical therapy appointment';
      service.send({
        type: 'HEAR_SPEECH',
        speech: testService
      });

      expect(service.getSnapshot().context.service).toBe(testService);
    });

    it('should assign timeWindow context correctly', () => {
      service.start();
      
      // Navigate to collectTimeWindow
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Checkup' });
      
      const testTime = 'Next Wednesday at 10:30 AM';
      service.send({
        type: 'HEAR_SPEECH',
        speech: testTime
      });

      expect(service.getSnapshot().context.timeWindow).toBe(testTime);
    });

    it('should assign contact context correctly', () => {
      service.start();
      
      // Navigate to collectContact
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Cleaning' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Thursday at 2' });
      
      const testContact = 'Alice Johnson, alice@email.com, 555-7890';
      service.send({
        type: 'HEAR_SPEECH',
        speech: testContact
      });

      expect(service.getSnapshot().context.contact).toBe(testContact);
    });
  });

  describe('Guards and Conditions', () => {
    it('should recognize yes confirmations with different phrasings', () => {
      service.start();
      
      // Navigate to confirm state
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Appointment' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Tomorrow' });
      service.send({ type: 'HEAR_SPEECH', speech: 'John, 555-1234' });

      const yesVariations = [
        'Yes',
        'YES',
        'yes that\'s correct',
        'Yes, book it',
        'Yep',
        'That\'s right, yes'
      ];

      yesVariations.forEach(variation => {
        // Reset to confirm state for each test
        service.send({ type: 'HEAR_SPEECH', speech: 'no' }); // Go back to collectTimeWindow
        service.send({ type: 'HEAR_SPEECH', speech: 'Tomorrow' }); // Return to confirm
        
        service.send({
          type: 'HEAR_SPEECH',
          speech: variation
        });

        expect(service.getSnapshot().value).toBe('book');
      });
    });

    it('should handle non-yes responses in confirm state', () => {
      service.start();
      
      // Navigate to confirm state
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Appointment' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Tomorrow' });
      service.send({ type: 'HEAR_SPEECH', speech: 'John, 555-1234' });

      const noVariations = [
        'No',
        'Actually, let me change that',
        'Wait, I meant Wednesday',
        'Can we do a different time?',
        'Let me reschedule'
      ];

      noVariations.forEach(variation => {
        service.send({
          type: 'HEAR_SPEECH',
          speech: variation
        });

        expect(service.getSnapshot().value).toBe('collectTimeWindow');
        
        // Return to confirm for next test
        service.send({ type: 'HEAR_SPEECH', speech: 'Tomorrow' });
      });
    });
  });

  describe('Invoked Services', () => {
    it('should configure createEvent service invocation', () => {
      const machineConfig = bookingMachine.config;
      const bookState = machineConfig.states.book;
      
      expect(bookState.invoke).toBeDefined();
      expect(bookState.invoke.src).toBe('createEvent');
      expect(bookState.invoke.onDone).toBe('success');
      expect(bookState.invoke.onError).toBe('fallback');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid state transitions gracefully', () => {
      service.start();
      
      // Try to send an invalid event
      service.send({
        type: 'INVALID_EVENT'
      });

      // Should remain in current state
      expect(service.getSnapshot().value).toBe('greet');
    });

    it('should handle missing speech data in events', () => {
      service.start();
      
      // Send event without speech property
      service.send({
        type: 'HEAR_SPEECH'
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe('collectService');
      expect(snapshot.context.service).toBeUndefined();
    });
  });

  describe('Complete Conversation Flows', () => {
    it('should handle successful booking flow', () => {
      service.start();
      
      const conversationFlow = [
        { event: 'Hello, I need an appointment', expectedState: 'collectService' },
        { event: 'I need a hair cut', expectedState: 'collectTimeWindow' },
        { event: 'This Saturday at 11 AM', expectedState: 'collectContact' },
        { event: 'Mary Smith, 555-0123', expectedState: 'confirm' },
        { event: 'Yes, that\'s perfect', expectedState: 'book' }
      ];

      conversationFlow.forEach(({ event, expectedState }) => {
        service.send({
          type: 'HEAR_SPEECH',
          speech: event
        });
        
        expect(service.getSnapshot().value).toBe(expectedState);
      });

      // Verify final context
      const finalContext = service.getSnapshot().context;
      expect(finalContext.service).toBe('I need a hair cut');
      expect(finalContext.timeWindow).toBe('This Saturday at 11 AM');
      expect(finalContext.contact).toBe('Mary Smith, 555-0123');
    });

    it('should handle correction flow', () => {
      service.start();
      
      // Initial flow
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Massage' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Monday at 2 PM' });
      service.send({ type: 'HEAR_SPEECH', speech: 'John Doe, 555-4567' });
      
      // User wants to change time
      service.send({ type: 'HEAR_SPEECH', speech: 'Actually, Tuesday would be better' });
      expect(service.getSnapshot().value).toBe('collectTimeWindow');
      
      // Provide new time
      service.send({ type: 'HEAR_SPEECH', speech: 'Tuesday at 3 PM instead' });
      expect(service.getSnapshot().value).toBe('collectContact');
      expect(service.getSnapshot().context.timeWindow).toBe('Tuesday at 3 PM instead');
      
      // Original contact should be preserved
      expect(service.getSnapshot().context.contact).toBe('John Doe, 555-4567');
    });
  });

  describe('Performance', () => {
    it('should handle rapid state transitions', async () => {
      service.start();
      
      const start = Date.now();
      
      // Send rapid-fire events
      service.send({ type: 'HEAR_SPEECH', speech: 'Hello' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Service' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Time' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Contact' });
      service.send({ type: 'HEAR_SPEECH', speech: 'Yes' });
      
      const duration = Date.now() - start;
      
      expect(service.getSnapshot().value).toBe('book');
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should maintain state integrity under load', () => {
      const services = Array.from({ length: 100 }, () => interpret(bookingMachine));
      
      services.forEach((svc, index) => {
        svc.start();
        
        // Each service follows same pattern but with unique data
        svc.send({ type: 'HEAR_SPEECH', speech: `Hello ${index}` });
        svc.send({ type: 'HEAR_SPEECH', speech: `Service ${index}` });
        svc.send({ type: 'HEAR_SPEECH', speech: `Time ${index}` });
        svc.send({ type: 'HEAR_SPEECH', speech: `Contact ${index}` });
        
        const snapshot = svc.getSnapshot();
        expect(snapshot.value).toBe('confirm');
        expect(snapshot.context.service).toBe(`Service ${index}`);
        expect(snapshot.context.timeWindow).toBe(`Time ${index}`);
        expect(snapshot.context.contact).toBe(`Contact ${index}`);
        
        svc.stop();
      });
    });
  });
});