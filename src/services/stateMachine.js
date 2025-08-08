/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 08/08/2025 - 16:31:05
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 08/08/2025
    * - Author          : 
    * - Modification    : 
**/
const { createMachine, assign } = require('xstate');
const { createAppointment } = require('./db');

const bookingMachine = createMachine({
  id: 'booking',
  initial: 'idle',
  context: {
    intent: null,
    service: null,
    preferredTime: null,
    contact: null,
    confidence: 0,
    sessionId: null,
    currentResponse: null,
  },
  states: {
    idle: {
      on: {
        PROCESS_INTENT: {
          actions: assign({
            intent: ({ event }) => event.intent,
            confidence: ({ event }) => event.confidence,
            currentResponse: ({ event }) => event.response,
            service: ({ context, event }) => {
              const newService = event.bookingData?.service || event.entities?.service;
              const result = newService || context.service;
              if (newService) {
                console.log(`🔧 State Machine: Service updated from "${context.service}" to "${result}"`);
              }
              return result;
            },
            preferredTime: ({ context, event }) => {
              const newTime = event.bookingData?.preferredTime || event.entities?.timeWindow;
              return newTime || context.preferredTime;
            },
            contact: ({ context, event }) => {
              const newContact = event.bookingData?.contact || event.entities?.contact;
              return newContact || context.contact;
            },
          }),
          target: 'handleIntent',
        },
      },
    },
    handleIntent: {
      always: [
        {
          cond: 'isBookingIntent',
          target: 'bookingFlow',
        },
        {
          cond: 'isNonBookingIntent',
          target: 'respondAndIdle',
        },
        {
          target: 'respondAndIdle',
        },
      ],
    },
    bookingFlow: {
      always: [
        {
          cond: 'hasAllBookingData',
          target: 'confirm',
        },
        {
          cond: 'needsService',
          target: 'collectService',
        },
        {
          cond: 'needsTime',
          target: 'collectTimeWindow',
        },
        {
          cond: 'needsContact',
          target: 'collectContact',
        },
        {
          target: 'collectService',
        },
      ],
    },
    collectService: {
      on: {
        PROCESS_INTENT: {
          actions: assign({
            service: ({ context, event }) => {
              const newService = event.bookingData?.service || event.entities?.service;
              return newService || context.service;
            },
            preferredTime: ({ context, event }) => {
              const newTime = event.bookingData?.preferredTime || event.entities?.timeWindow;
              return newTime || context.preferredTime;
            },
            contact: ({ context, event }) => {
              const newContact = event.bookingData?.contact || event.entities?.contact;
              return newContact || context.contact;
            },
            currentResponse: ({ event }) => event.response,
          }),
          target: 'bookingFlow',
        },
      },
    },
    collectTimeWindow: {
      on: {
        PROCESS_INTENT: {
          actions: assign({
            service: ({ context, event }) => {
              const newService = event.bookingData?.service || event.entities?.service;
              return newService || context.service;
            },
            preferredTime: ({ context, event }) => {
              const newTime = event.bookingData?.preferredTime || event.entities?.timeWindow;
              return newTime || context.preferredTime;
            },
            contact: ({ context, event }) => {
              const newContact = event.bookingData?.contact || event.entities?.contact;
              return newContact || context.contact;
            },
            currentResponse: ({ event }) => event.response,
          }),
          target: 'bookingFlow',
        },
      },
    },
    collectContact: {
      on: {
        PROCESS_INTENT: {
          actions: assign({
            service: ({ context, event }) => {
              const newService = event.bookingData?.service || event.entities?.service;
              return newService || context.service;
            },
            preferredTime: ({ context, event }) => {
              const newTime = event.bookingData?.preferredTime || event.entities?.timeWindow;
              return newTime || context.preferredTime;
            },
            contact: ({ context, event }) => {
              const newContact = event.bookingData?.contact || event.entities?.contact;
              return newContact || context.contact;
            },
            currentResponse: ({ event }) => event.response,
          }),
          target: 'bookingFlow',
        },
      },
    },
    confirm: {
      on: {
        PROCESS_INTENT: [
          {
            cond: 'isConfirmation',
            target: 'book',
          },
          {
            actions: 'resetBookingData',
            target: 'collectService',
          },
        ],
      },
    },
    book: {
      invoke: {
        id: 'createAppointment',
        src: 'createAppointment',
        onDone: {
          target: 'success',
          actions: assign({
            currentResponse: () => 'Your appointment has been booked successfully! You should receive a confirmation shortly.'
          }),
        },
        onError: {
          target: 'fallback',
          actions: assign({
            currentResponse: () => 'I apologize, but I encountered an issue booking your appointment. Please call us directly to schedule.'
          }),
        },
      },
    },
    success: {
      after: {
        5000: 'idle', // Return to idle after 5 seconds
      },
      on: {
        PROCESS_INTENT: 'handleIntent',
      },
    },
    fallback: {
      after: {
        3000: 'idle', // Return to idle after 3 seconds
      },
      on: {
        PROCESS_INTENT: 'handleIntent',
      },
    },
    respondAndIdle: {
      after: {
        100: 'idle', // Quick transition back to idle for non-booking intents
      },
    },
  },
}, {
  guards: {
    isBookingIntent: ({ event }) => event.intent === 'booking',
    isNonBookingIntent: ({ event }) => ['hours', 'location', 'services', 'other'].includes(event.intent),
    hasAllBookingData: ({ context }) => {
      const result = context.service && context.preferredTime && context.contact;
      console.log(`🔍 hasAllBookingData: service=${context.service}, time=${context.preferredTime}, contact=${context.contact} => ${result}`);
      return result;
    },
    needsService: ({ context }) => {
      const result = !context.service;
      console.log(`🔍 needsService: service=${context.service} => ${result}`);
      return result;
    },
    needsTime: ({ context }) => {
      const result = context.service && !context.preferredTime;
      console.log(`🔍 needsTime: service=${context.service}, time=${context.preferredTime} => ${result}`);
      return result;
    },
    needsContact: ({ context }) => {
      const result = context.service && context.preferredTime && !context.contact;
      console.log(`🔍 needsContact: service=${context.service}, time=${context.preferredTime}, contact=${context.contact} => ${result}`);
      return result;
    },
    isConfirmation: ({ event }) => {
      const speech = event.originalSpeech || '';
      return /\b(yes|yeah|yep|correct|right|confirm|book|schedule)\b/i.test(speech);
    },
  },
  actions: {
    logSpeech: (context, event) => {
      console.log('Speech:', event.speech);
    },
    resetBookingData: assign({
      service: null,
      preferredTime: null,
      contact: null,
    }),
  },
  services: {
    createAppointment: async (context) => {
      // Parse the booking data for database storage
      const appointmentData = {
        organizationId: process.env.DEFAULT_ORG_ID || '00000000-0000-0000-0000-000000000001',
        service: context.service,
        contactPhone: extractPhoneNumber(context.contact),
        notes: `Service: ${context.service}, Time: ${context.preferredTime}, Contact: ${context.contact}`,
        status: 'scheduled',
        startAt: parseDateTime(context.preferredTime),
        endAt: addHour(parseDateTime(context.preferredTime)),
      };
      
      return await createAppointment(appointmentData);
    },
  },
});

// Utility functions for appointment creation
const extractPhoneNumber = (contact) => {
  if (!contact) return null;
  const phoneMatch = contact.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
  return phoneMatch ? phoneMatch[0] : null;
};

const parseDateTime = (timeString) => {
  if (!timeString) return new Date();
  
  // Simple date parsing - in production, use a more robust date parser
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  
  // Default to tomorrow at 10 AM if we can't parse the time
  if (/tomorrow/i.test(timeString)) {
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  }
  
  if (/monday|tuesday|wednesday|thursday|friday/i.test(timeString)) {
    // Default to next weekday at 10 AM
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    nextWeek.setHours(10, 0, 0, 0);
    return nextWeek;
  }
  
  // Default to tomorrow at 10 AM
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
};

const addHour = (date) => {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + 1);
  return newDate;
};

module.exports = {
  bookingMachine,
  extractPhoneNumber,
  parseDateTime,
  addHour,
};