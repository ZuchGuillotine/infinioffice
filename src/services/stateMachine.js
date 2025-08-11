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
    serviceValidated: false,
    calendarError: false,
    integrationFailure: false,
    retryCount: 0,
    businessConfig: null,
    fallbackReason: null,
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
            // Preserve enhanced context fields
            businessConfig: ({ context, event }) => {
              return event.businessConfig || event.bookingData?.businessConfig || context.businessConfig;
            },
            serviceValidated: ({ context, event }) => {
              return event.bookingData?.serviceValidated || context.serviceValidated || false;
            },
            calendarError: ({ context, event }) => {
              return event.bookingData?.calendarError || context.calendarError || false;
            },
            integrationFailure: ({ context, event }) => {
              return event.bookingData?.integrationFailure || context.integrationFailure || false;
            },
            retryCount: ({ context, event }) => {
              return event.bookingData?.retryCount || context.retryCount || 0;
            },
            fallbackReason: ({ context, event }) => {
              return event.bookingData?.fallbackReason || context.fallbackReason;
            },
            sessionId: ({ context, event }) => {
              return event.bookingData?.sessionId || context.sessionId;
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
      always: [
        {
          cond: 'shouldFallbackToCallback',
          target: 'scheduleCallback',
        }
      ],
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
            retryCount: ({ context, event }) => {
              // Reset retry count if we got a new service, increment if unclear
              return event.bookingData?.service || event.entities?.service 
                ? 0 
                : (context.retryCount || 0) + (event.intent === 'unclear' ? 1 : 0);
            },
            // Preserve enhanced context fields
            businessConfig: ({ context, event }) => {
              return event.businessConfig || event.bookingData?.businessConfig || context.businessConfig;
            },
            serviceValidated: ({ context, event }) => {
              return event.bookingData?.serviceValidated || context.serviceValidated || false;
            },
            calendarError: ({ context, event }) => {
              return event.bookingData?.calendarError || context.calendarError || false;
            },
            integrationFailure: ({ context, event }) => {
              return event.bookingData?.integrationFailure || context.integrationFailure || false;
            },
            fallbackReason: ({ context, event }) => {
              return event.bookingData?.fallbackReason || context.fallbackReason;
            },
          }),
          target: 'validateService',
        },
      },
    },
    validateService: {
      always: [
        {
          cond: 'isServiceValid',
          actions: assign({
            serviceValidated: true,
            fallbackReason: null,
            retryCount: 0, // Reset retry count on successful validation
          }),
          target: 'bookingFlow',
        },
        {
          cond: 'shouldFallbackToCallback',
          actions: assign({
            fallbackReason: 'service_invalid',
          }),
          target: 'scheduleCallback',
        },
        {
          // Give more attempts before giving up
          actions: assign({
            serviceValidated: false,
            retryCount: ({ context }) => (context.retryCount || 0) + 1,
          }),
          target: 'collectService',
        },
      ],
    },
    collectTimeWindow: {
      always: [
        {
          cond: 'shouldFallbackToCallback',
          target: 'scheduleCallback',
        }
      ],
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
            retryCount: ({ context, event }) => {
              // Reset retry count if we got time info, increment if unclear
              return event.bookingData?.preferredTime || event.entities?.timeWindow
                ? 0 
                : (context.retryCount || 0) + (event.intent === 'unclear' ? 1 : 0);
            },
          }),
          target: 'bookingFlow',
        },
      },
    },
    collectContact: {
      always: [
        {
          cond: 'shouldFallbackToCallback',
          target: 'scheduleCallback',
        }
      ],
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
            retryCount: ({ context, event }) => {
              // Reset retry count if we got contact info, increment if unclear
              return event.bookingData?.contact || event.entities?.contact
                ? 0 
                : (context.retryCount || 0) + (event.intent === 'unclear' ? 1 : 0);
            },
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
            currentResponse: ({ context }) => {
              if (context.calendarError || context.integrationFailure) {
                return 'Your appointment has been scheduled! However, our calendar system is currently unavailable, so someone from our team will call you tomorrow to confirm the exact time and provide any additional details.';
              }
              return 'Your appointment has been booked successfully! You should receive a confirmation shortly.';
            }
          }),
        },
        onError: {
          actions: assign({
            calendarError: true,
            integrationFailure: true,
          }),
          target: 'scheduleCallback',
        },
      },
    },
    scheduleCallback: {
      invoke: {
        id: 'scheduleCallback',
        src: 'scheduleCallback',
        onDone: {
          target: 'callbackScheduled',
          actions: assign({
            currentResponse: ({ context }) => {
              const reason = context.fallbackReason;
              switch (reason) {
                case 'service_invalid':
                  return `I want to make sure we can provide exactly what you need. I've noted your request for "${context.service}" and someone from our team will call you back within the hour to discuss our available services and schedule your appointment.`;
                case 'calendar_failure':
                  return `I'm having trouble accessing our scheduling system right now. I've taken down your information for ${context.service} and someone will call you back within the hour to confirm your appointment.`;
                default:
                  return `I want to make sure we get all the details right for your appointment. I've taken down your information and someone from our team will call you back within the hour to complete the scheduling.`;
              }
            }
          }),
        },
        onError: {
          target: 'fallback',
          actions: assign({
            currentResponse: () => 'I apologize, but I\'m experiencing technical difficulties. Please call us directly or visit our website to schedule your appointment.'
          }),
        },
      },
    },
    callbackScheduled: {
      after: {
        5000: 'idle',
      },
      on: {
        PROCESS_INTENT: 'handleIntent',
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
      const result = context.service && context.preferredTime && context.contact && context.serviceValidated;
      console.log(`🔍 hasAllBookingData: service=${context.service}, serviceValidated=${context.serviceValidated}, time=${context.preferredTime}, contact=${context.contact} => ${result}`);
      return result;
    },
    needsService: ({ context }) => {
      const result = !context.service || !context.serviceValidated;
      console.log(`🔍 needsService: service=${context.service}, serviceValidated=${context.serviceValidated} => ${result}`);
      return result;
    },
    needsTime: ({ context }) => {
      const result = context.service && context.serviceValidated && !context.preferredTime;
      console.log(`🔍 needsTime: service=${context.service}, serviceValidated=${context.serviceValidated}, time=${context.preferredTime} => ${result}`);
      return result;
    },
    needsContact: ({ context }) => {
      const result = context.service && context.serviceValidated && context.preferredTime && !context.contact;
      console.log(`🔍 needsContact: service=${context.service}, serviceValidated=${context.serviceValidated}, time=${context.preferredTime}, contact=${context.contact} => ${result}`);
      return result;
    },
    isConfirmation: ({ event }) => {
      const speech = event.originalSpeech || '';
      return /\b(yes|yeah|yep|correct|right|confirm|book|schedule)\b/i.test(speech);
    },
    isServiceValid: ({ context, event }) => {
      // Validate service against business configuration
      return validateService(context.service || event.bookingData?.service, context.businessConfig);
    },
    shouldFallbackToCallback: ({ context, event }) => {
      // Check if we should fallback to callback scheduling
      // Only fallback after significant attempts have been made
      const multipleRetries = (context.retryCount || 0) >= 5; // Increased from 3 to 5
      const persistentServiceIssue = context.service && context.serviceValidated === false && (context.retryCount || 0) >= 3;
      const calendarFailure = context.calendarError || context.integrationFailure;
      
      // Don't fallback immediately on first service validation failure
      const shouldFallback = multipleRetries || persistentServiceIssue || calendarFailure;
      
      if (shouldFallback) {
        console.log(`🔄 Triggering fallback: retries=${context.retryCount}, service=${context.service}, validated=${context.serviceValidated}, calendarError=${context.calendarError}`);
      }
      
      return shouldFallback;
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
      serviceValidated: false,
      retryCount: 0,
      fallbackReason: null,
    }),
    preserveEnhancedContext: assign({
      // Standard booking data
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
      // Enhanced context fields
      businessConfig: ({ context, event }) => {
        return event.businessConfig || event.bookingData?.businessConfig || context.businessConfig;
      },
      serviceValidated: ({ context, event }) => {
        return event.bookingData?.serviceValidated !== undefined ? event.bookingData.serviceValidated : context.serviceValidated;
      },
      calendarError: ({ context, event }) => {
        return event.bookingData?.calendarError || context.calendarError || false;
      },
      integrationFailure: ({ context, event }) => {
        return event.bookingData?.integrationFailure || context.integrationFailure || false;
      },
      fallbackReason: ({ context, event }) => {
        return event.bookingData?.fallbackReason || context.fallbackReason;
      },
      retryCount: ({ context, event }) => {
        // Handle retry count logic per state
        if (event.bookingData?.retryCount !== undefined) {
          return event.bookingData.retryCount;
        }
        return context.retryCount || 0;
      },
    }),
  },
  services: {
    createAppointment: async (context) => {
      try {
        // Check calendar integration availability
        const isCalendarAvailable = await checkCalendarIntegration(context);
        
        // Parse the booking data for database storage
        const appointmentData = {
          organizationId: process.env.DEFAULT_ORG_ID || '00000000-0000-0000-0000-000000000001',
          service: context.service,
          contactPhone: extractPhoneNumber(context.contact),
          notes: `Service: ${context.service}, Time: ${context.preferredTime}, Contact: ${context.contact}`,
          status: isCalendarAvailable ? 'scheduled' : 'pending_confirmation',
          startAt: parseDateTime(context.preferredTime),
          endAt: addHour(parseDateTime(context.preferredTime)),
          requiresCallback: !isCalendarAvailable,
        };
        
        return await createAppointment(appointmentData);
      } catch (error) {
        console.error('Error creating appointment:', error);
        throw error;
      }
    },
    scheduleCallback: async (context) => {
      try {
        // Create a callback request record
        const callbackData = {
          organizationId: process.env.DEFAULT_ORG_ID || '00000000-0000-0000-0000-000000000001',
          service: context.service || 'General inquiry',
          contactPhone: extractPhoneNumber(context.contact) || 'Unknown',
          preferredTime: context.preferredTime || 'Flexible',
          reason: context.fallbackReason || 'General callback request',
          notes: `Callback requested: Service: ${context.service || 'Unknown'}, Time: ${context.preferredTime || 'Flexible'}, Contact: ${context.contact || 'Unknown'}, Reason: ${context.fallbackReason || 'General'}`,
          status: 'pending_callback',
          callbackBy: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        };
        
        return await createAppointment(callbackData);
      } catch (error) {
        console.error('Error scheduling callback:', error);
        throw error;
      }
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

// Enhanced service validation function with more flexible matching
const validateService = (requestedService, businessConfig) => {
  if (!requestedService || !businessConfig) {
    console.log('🚫 Service validation failed: Missing service or business config');
    return false;
  }

  const services = businessConfig.services || [];
  const activeServices = services.filter(service => service.active);
  
  if (activeServices.length === 0) {
    console.log('🚫 Service validation failed: No active services configured');
    return false;
  }

  // Clean the requested service for better matching
  const cleanRequested = requestedService.toLowerCase().trim();
  
  // Exact match first
  const exactMatch = activeServices.find(service => 
    service.name.toLowerCase().trim() === cleanRequested
  );
  
  if (exactMatch) {
    console.log(`✅ Service validation passed: Exact match found for "${requestedService}" -> "${exactMatch.name}"`);
    return true;
  }

  // Enhanced fuzzy matching with more patterns
  const fuzzyMatch = activeServices.find(service => {
    const serviceName = service.name.toLowerCase().trim();
    
    // Direct substring matches
    if (serviceName.includes(cleanRequested) || cleanRequested.includes(serviceName)) {
      return true;
    }
    
    // Common word matching patterns
    const serviceWords = serviceName.split(/\s+/);
    const requestedWords = cleanRequested.split(/\s+/);
    
    // Check if any significant word matches
    for (const reqWord of requestedWords) {
      if (reqWord.length > 2) { // Skip small words like 'a', 'an', 'the'
        for (const serviceWord of serviceWords) {
          if (serviceWord.includes(reqWord) || reqWord.includes(serviceWord)) {
            return true;
          }
        }
      }
    }
    
    // Extended pattern matching for common service variations
    const patterns = [
      // Hair services
      { service: 'haircut', matches: ['cut', 'hair', 'trim', 'style'] },
      { service: 'hair', matches: ['haircut', 'cut', 'style', 'trim'] },
      
      // Consultation variations
      { service: 'consultation', matches: ['consult', 'meeting', 'appointment', 'session'] },
      { service: 'consult', matches: ['consultation', 'meeting', 'session'] },
      
      // Cleaning variations  
      { service: 'cleaning', matches: ['clean', 'wash', 'sanitize'] },
      { service: 'clean', matches: ['cleaning', 'wash'] },
      
      // Repair variations
      { service: 'repair', matches: ['fix', 'service', 'maintenance'] },
      { service: 'fix', matches: ['repair', 'service'] },
      
      // Medical/dental
      { service: 'checkup', matches: ['check', 'exam', 'examination'] },
      { service: 'exam', matches: ['checkup', 'check', 'examination'] },
    ];
    
    for (const pattern of patterns) {
      if (serviceName.includes(pattern.service) && pattern.matches.some(match => cleanRequested.includes(match))) {
        return true;
      }
      if (cleanRequested.includes(pattern.service) && pattern.matches.some(match => serviceName.includes(match))) {
        return true;
      }
    }
    
    return false;
  });

  if (fuzzyMatch) {
    console.log(`✅ Service validation passed: Fuzzy match found "${requestedService}" -> "${fuzzyMatch.name}"`);
    return true;
  }

  console.log(`🚫 Service validation failed: No match found for "${requestedService}"`);
  console.log(`Available services: ${activeServices.map(s => s.name).join(', ')}`);
  console.log(`Tried to match against: ${activeServices.map(s => s.name.toLowerCase().trim()).join(', ')}`);
  return false;
};

// Calendar integration check
const checkCalendarIntegration = async (context) => {
  try {
    // Check if business has calendar integration configured
    const businessConfig = context.businessConfig;
    const hasIntegration = businessConfig?.integrations?.some(integration => 
      integration.type === 'calendar' && integration.active
    );

    if (!hasIntegration) {
      console.log('📅 Calendar integration: Not configured');
      return false;
    }

    // In a real implementation, you would:
    // 1. Check if the integration is responding
    // 2. Verify availability for the requested time
    // 3. Handle API rate limits and errors gracefully
    
    // For now, simulate a simple availability check
    // This should be replaced with actual integration logic
    const isAvailable = Math.random() > 0.1; // 90% success rate simulation
    
    console.log(`📅 Calendar integration: ${isAvailable ? 'Available' : 'Unavailable'}`);
    return isAvailable;
    
  } catch (error) {
    console.error('📅 Calendar integration error:', error);
    return false;
  }
};

module.exports = {
  bookingMachine,
  extractPhoneNumber,
  parseDateTime,
  addHour,
  validateService,
  checkCalendarIntegration,
};