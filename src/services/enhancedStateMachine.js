/**
 * Enhanced State Machine for Voice Agent with Location Capture & Customization
 * 
 * Key Features:
 * - Three-strike confirmation system for critical slots
 * - Progressive summarization with context building
 * - Graceful digression handling with return-to-context
 * - Location capture (on-site, at-business, remote)
 * - Tenant configuration overrides
 * - Enhanced error recovery and escalation
 * - Comprehensive telemetry and performance monitoring
 */

const { createMachine, assign, interpret } = require('xstate');
const { createAppointment } = require('./db');

// Enhanced context model with new slots and tracking
const initialContext = {
  // Core booking slots
  intent: null,
  service: null,
  serviceValidated: false,
  timeWindow: null,
  timeConfirmed: false,
  contact: null,
  contactValidated: false,
  
  // Enhanced location slots
  locationKind: null, // 'on_site' | 'at_business' | 'remote'
  serviceAddress: null,
  businessLocationId: null,
  locationValidated: false,
  
  // Confirmation tracking (three-strike system)
  confirmationAttempts: {
    service: 0,
    timeWindow: 0,
    contact: 0,
    location: 0
  },
  
  // Progressive summarization
  progressSummary: '',
  confirmedData: {},
  pendingData: {},
  
  // Digression handling
  digressionStack: [],
  digressionContext: null,
  
  // Session and business context
  sessionId: null,
  businessConfig: null,
  organizationContext: null,
  
  // Performance and error tracking
  confidence: 0,
  retryCount: 0,
  errorHistory: [],
  escalationReason: null,
  
  // Response and state management
  currentResponse: null,
  lastTransition: null,
  turnIndex: 0,
  
  // Integration status
  calendarError: false,
  integrationFailure: false,
  
  // Timeout and conversation state
  silenceCount: 0,
  bargeInDetected: false,
  conversationActive: true
};

const enhancedBookingMachine = createMachine({
  id: 'enhancedBooking',
  initial: 'idle',
  context: initialContext,
  
  states: {
    // Initial state - waiting for input
    idle: {
      entry: 'logStateEntry',
      on: {
        PROCESS_INTENT: {
          actions: ['updateContext', 'updateProgressSummary'],
          target: 'routeIntent'
        },
        TIMEOUT: 'handleTimeout',
        BARGE_IN: 'handleBargeIn'
      }
    },

    // Route intent to appropriate flow
    routeIntent: {
      entry: 'logStateEntry',
      always: [
        {
          guard: 'isDigressionIntent',
          target: 'handleDigression'
        },
        {
          guard: 'isBookingIntent',
          target: 'assessBookingState'
        },
        {
          guard: 'isNonBookingIntent',
          target: 'respondAndReturn'
        },
        {
          target: 'clarifyIntent'
        }
      ]
    },

    // Assess current booking state and route to next step
    assessBookingState: {
      entry: 'logStateEntry',
      always: [
        {
          guard: 'hasAllRequiredData',
          target: 'finalConfirmation'
        },
        {
          guard: 'needsLocationInfo',
          target: 'collectLocation'
        },
        {
          guard: 'needsService',
          target: 'collectService'
        },
        {
          guard: 'needsTime',
          target: 'collectTimeWindow'
        },
        {
          guard: 'needsContact',
          target: 'collectContact'
        },
        {
          target: 'collectService' // Default fallback
        }
      ]
    },

    // Service collection with three-strike confirmation
    collectService: {
      entry: ['logStateEntry', 'requestSlot'],
      on: {
        PROCESS_INTENT: [
          {
            guard: 'hasValidService',
            actions: ['extractService', 'confirmSlot'],
            target: 'confirmService'
          },
          {
            guard: 'shouldEscalateService',
            actions: 'prepareEscalation',
            target: 'escalateToHuman'
          },
          {
            actions: ['incrementConfirmationAttempt', 'updateRetryResponse'],
            target: 'collectService'
          }
        ],
        TIMEOUT: 'handleTimeout'
      }
    },

    confirmService: {
      entry: 'logStateEntry',
      on: {
        PROCESS_INTENT: [
          {
            guard: 'isConfirmationYes',
            actions: ['markServiceConfirmed', 'updateProgressSummary'],
            target: 'assessBookingState'
          },
          {
            guard: 'isConfirmationNo',
            actions: ['resetServiceData', 'updateProgressSummary'],
            target: 'collectService'
          },
          {
            guard: 'shouldEscalateConfirmation',
            target: 'escalateToHuman'
          },
          {
            actions: 'incrementConfirmationAttempt',
            target: 'confirmService'
          }
        ]
      }
    },

    // Location collection (new feature)
    collectLocation: {
      entry: ['logStateEntry', 'requestLocationInfo'],
      on: {
        PROCESS_INTENT: [
          {
            guard: 'hasValidLocation',
            actions: ['extractLocation', 'validateLocation'],
            target: 'confirmLocation'
          },
          {
            guard: 'shouldEscalateLocation',
            target: 'escalateToHuman'
          },
          {
            actions: ['incrementConfirmationAttempt', 'updateRetryResponse'],
            target: 'collectLocation'
          }
        ]
      }
    },

    confirmLocation: {
      entry: 'logStateEntry',
      on: {
        PROCESS_INTENT: [
          {
            guard: 'isConfirmationYes',
            actions: ['markLocationConfirmed', 'updateProgressSummary'],
            target: 'assessBookingState'
          },
          {
            guard: 'isConfirmationNo',
            actions: ['resetLocationData'],
            target: 'collectLocation'
          },
          {
            actions: 'incrementConfirmationAttempt',
            target: 'confirmLocation'
          }
        ]
      }
    },

    // Time window collection
    collectTimeWindow: {
      entry: ['logStateEntry', 'requestSlot'],
      on: {
        PROCESS_INTENT: [
          {
            guard: 'hasValidTimeWindow',
            actions: ['extractTimeWindow', 'checkAvailability'],
            target: 'confirmTimeWindow'
          },
          {
            guard: 'shouldEscalateTime',
            target: 'escalateToHuman'
          },
          {
            actions: ['incrementConfirmationAttempt', 'updateRetryResponse'],
            target: 'collectTimeWindow'
          }
        ]
      }
    },

    confirmTimeWindow: {
      entry: 'logStateEntry',
      on: {
        PROCESS_INTENT: [
          {
            guard: 'isConfirmationYes',
            actions: ['markTimeConfirmed', 'updateProgressSummary'],
            target: 'assessBookingState'
          },
          {
            guard: 'isConfirmationNo',
            actions: ['resetTimeData'],
            target: 'collectTimeWindow'
          },
          {
            actions: 'incrementConfirmationAttempt',
            target: 'confirmTimeWindow'
          }
        ]
      }
    },

    // Contact collection
    collectContact: {
      entry: ['logStateEntry', 'requestSlot'],
      on: {
        PROCESS_INTENT: [
          {
            guard: 'hasValidContact',
            actions: ['extractContact', 'validateContact'],
            target: 'confirmContact'
          },
          {
            guard: 'shouldEscalateContact',
            target: 'escalateToHuman'
          },
          {
            actions: ['incrementConfirmationAttempt', 'updateRetryResponse'],
            target: 'collectContact'
          }
        ]
      }
    },

    confirmContact: {
      entry: 'logStateEntry',
      on: {
        PROCESS_INTENT: [
          {
            guard: 'isConfirmationYes',
            actions: ['markContactConfirmed', 'updateProgressSummary'],
            target: 'assessBookingState'
          },
          {
            guard: 'isConfirmationNo',
            actions: ['resetContactData'],
            target: 'collectContact'
          },
          {
            actions: 'incrementConfirmationAttempt',
            target: 'confirmContact'
          }
        ]
      }
    },

    // Final confirmation with progressive summary
    finalConfirmation: {
      entry: ['logStateEntry', 'generateFinalSummary'],
      on: {
        PROCESS_INTENT: [
          {
            guard: 'isConfirmationYes',
            target: 'processBooking'
          },
          {
            guard: 'isConfirmationNo',
            actions: 'identifyCorrection',
            target: 'assessBookingState'
          },
          {
            actions: 'clarifyFinalConfirmation',
            target: 'finalConfirmation'
          }
        ]
      }
    },

    // Digression handling
    handleDigression: {
      entry: ['logStateEntry', 'pushDigressionStack'],
      always: [
        {
          guard: 'isHoursInquiry',
          target: 'answerHours'
        },
        {
          guard: 'isLocationInquiry',
          target: 'answerLocation'
        },
        {
          guard: 'isServicesInquiry',
          target: 'answerServices'
        },
        {
          guard: 'isPricingInquiry',
          target: 'answerPricing'
        },
        {
          target: 'answerGeneral'
        }
      ]
    },

    answerHours: {
      entry: ['logStateEntry', 'respondWithHours'],
      after: {
        1000: 'returnFromDigression'
      }
    },

    answerLocation: {
      entry: ['logStateEntry', 'respondWithLocation'],
      after: {
        1000: 'returnFromDigression'
      }
    },

    answerServices: {
      entry: ['logStateEntry', 'respondWithServices'],
      after: {
        1000: 'returnFromDigression'
      }
    },

    answerPricing: {
      entry: ['logStateEntry', 'respondWithPricing'],
      after: {
        1000: 'returnFromDigression'
      }
    },

    answerGeneral: {
      entry: ['logStateEntry', 'respondGeneral'],
      after: {
        1000: 'returnFromDigression'
      }
    },

    returnFromDigression: {
      entry: 'logStateEntry',
      always: [
        {
          guard: 'hasDigressionStack',
          actions: ['popDigressionStack', 'resumeBookingContext'],
          target: 'assessBookingState'
        },
        {
          target: 'idle'
        }
      ]
    },

    // Booking processing
    processBooking: {
      entry: 'logStateEntry',
      invoke: {
        id: 'createAppointment',
        src: 'createAppointmentService',
        onDone: {
          target: 'bookingSuccess',
          actions: ['storeAppointmentData', 'updateProgressSummary']
        },
        onError: {
          target: 'bookingError',
          actions: ['logBookingError', 'updateErrorHistory']
        }
      }
    },

    bookingSuccess: {
      entry: ['logStateEntry', 'generateSuccessResponse'],
      after: {
        5000: 'conversationComplete'
      },
      on: {
        PROCESS_INTENT: 'idle'
      }
    },

    bookingError: {
      entry: ['logStateEntry', 'handleBookingError'],
      always: [
        {
          guard: 'canRetryBooking',
          actions: 'prepareBookingRetry',
          target: 'processBooking'
        },
        {
          target: 'escalateToHuman'
        }
      ]
    },

    // Clarification and error states
    clarifyIntent: {
      entry: ['logStateEntry', 'requestClarification'],
      on: {
        PROCESS_INTENT: {
          actions: 'updateContext',
          target: 'routeIntent'
        },
        TIMEOUT: 'handleTimeout'
      }
    },

    handleTimeout: {
      entry: 'logStateEntry',
      always: [
        {
          guard: 'exceedsTimeoutThreshold',
          target: 'escalateToHuman'
        },
        {
          actions: ['incrementSilenceCount', 'generateTimeoutResponse'],
          target: 'idle'
        }
      ]
    },

    handleBargeIn: {
      entry: ['logStateEntry', 'recordBargeIn'],
      always: [
        {
          actions: 'resumeAfterBargeIn',
          target: 'idle'
        }
      ]
    },

    // Escalation and completion states
    escalateToHuman: {
      entry: ['logStateEntry', 'prepareEscalationData'],
      invoke: {
        id: 'scheduleCallback',
        src: 'scheduleCallbackService',
        onDone: {
          target: 'callbackScheduled',
          actions: 'storeCallbackData'
        },
        onError: {
          target: 'escalationFailed',
          actions: 'logEscalationError'
        }
      }
    },

    callbackScheduled: {
      entry: ['logStateEntry', 'generateCallbackResponse'],
      after: {
        3000: 'conversationComplete'
      }
    },

    escalationFailed: {
      entry: ['logStateEntry', 'generateEscalationFailureResponse'],
      after: {
        3000: 'conversationComplete'
      }
    },

    conversationComplete: {
      entry: ['logStateEntry', 'finalizeSession'],
      type: 'final'
    },

    respondAndReturn: {
      entry: ['logStateEntry', 'generateNonBookingResponse'],
      after: {
        1000: 'idle'
      }
    }
  }
}, {
  // Guards
  guards: {
    // Intent routing guards
    isDigressionIntent: ({ event }) => {
      const digressionIntents = ['hours', 'location_info', 'services_info', 'pricing', 'general_question'];
      return digressionIntents.includes(event.intent);
    },

    isBookingIntent: ({ event }) => {
      const bookingIntents = ['booking', 'service_provided', 'time_provided', 'contact_provided', 'location_provided'];
      return bookingIntents.includes(event.intent);
    },

    isNonBookingIntent: ({ event }) => {
      const nonBookingIntents = ['farewell', 'thanks', 'other'];
      return nonBookingIntents.includes(event.intent);
    },

    // Booking state assessment guards
    hasAllRequiredData: ({ context }) => {
      const hasService = context.service && context.serviceValidated;
      const hasTime = context.timeWindow && context.timeConfirmed;
      const hasContact = context.contact && context.contactValidated;
      const hasLocation = context.locationKind && 
        ((context.locationKind === 'on_site' && context.serviceAddress && context.locationValidated) ||
         (context.locationKind === 'at_business' && context.businessLocationId && context.locationValidated) ||
         (context.locationKind === 'remote' && context.locationValidated));
      
      return hasService && hasTime && hasContact && hasLocation;
    },

    needsService: ({ context }) => !context.service || !context.serviceValidated,

    needsTime: ({ context }) => 
      context.service && context.serviceValidated && 
      (!context.timeWindow || !context.timeConfirmed),

    needsContact: ({ context }) => 
      context.service && context.serviceValidated && 
      context.timeWindow && context.timeConfirmed &&
      (!context.contact || !context.contactValidated),

    needsLocationInfo: ({ context }) => {
      if (!context.service || !context.serviceValidated) return false;
      
      // Check if service requires location info
      const businessConfig = context.businessConfig;
      if (!businessConfig?.locations) return false;
      
      const requiresLocation = businessConfig.locations.mode !== 'remote_only';
      if (!requiresLocation) {
        // Auto-set remote location
        return false;
      }
      
      return !context.locationKind || !context.locationValidated;
    },

    // Validation guards
    hasValidService: ({ context, event }) => {
      const service = event.entities?.service || event.bookingData?.service;
      if (!service) return false;
      
      return validateService(service, context.businessConfig);
    },

    hasValidTimeWindow: ({ context, event }) => {
      const timeWindow = event.entities?.timeWindow || event.bookingData?.timeWindow;
      if (!timeWindow) return false;
      
      return validateTimeWindow(timeWindow, context.businessConfig);
    },

    hasValidContact: ({ context, event }) => {
      const contact = event.entities?.contact || event.bookingData?.contact;
      if (!contact) return false;
      
      return validateContact(contact);
    },

    hasValidLocation: ({ context, event }) => {
      const locationData = event.entities?.location || event.bookingData?.location;
      if (!locationData) return false;
      
      return validateLocation(locationData, context.businessConfig);
    },

    // Confirmation guards
    isConfirmationYes: ({ event }) => {
      const speech = event.originalSpeech || '';
      return /\b(yes|yeah|yep|correct|right|confirm|book|schedule|absolutely|definitely)\b/i.test(speech);
    },

    isConfirmationNo: ({ event }) => {
      const speech = event.originalSpeech || '';
      return /\b(no|nope|wrong|incorrect|not right|change)\b/i.test(speech);
    },

    // Three-strike escalation guards
    shouldEscalateService: ({ context }) => 
      context.confirmationAttempts.service >= getThreshold('service', context.businessConfig),

    shouldEscalateTime: ({ context }) => 
      context.confirmationAttempts.timeWindow >= getThreshold('timeWindow', context.businessConfig),

    shouldEscalateContact: ({ context }) => 
      context.confirmationAttempts.contact >= getThreshold('contact', context.businessConfig),

    shouldEscalateLocation: ({ context }) => 
      context.confirmationAttempts.location >= getThreshold('location', context.businessConfig),

    shouldEscalateConfirmation: ({ context }) => 
      Object.values(context.confirmationAttempts).some(count => count >= 3),

    // Digression guards
    isHoursInquiry: ({ event }) => event.intent === 'hours',
    isLocationInquiry: ({ event }) => event.intent === 'location_info',
    isServicesInquiry: ({ event }) => event.intent === 'services_info',
    isPricingInquiry: ({ event }) => event.intent === 'pricing',

    // State management guards
    hasDigressionStack: ({ context }) => context.digressionStack.length > 0,

    exceedsTimeoutThreshold: ({ context }) => context.silenceCount >= 3,

    canRetryBooking: ({ context }) => context.retryCount < 2
  },

  // Actions
  actions: {
    // Logging and telemetry
    logStateEntry: assign(({ context, event }) => {
      console.log(`🔄 State Entry: ${context.lastTransition || 'unknown'}`, {
        event: event?.type,
        intent: event?.intent,
        confidence: event?.confidence,
        context: {
          service: context.service,
          timeWindow: context.timeWindow,
          contact: context.contact,
          locationKind: context.locationKind
        }
      });
      
      return {
        lastTransition: new Date().toISOString(),
        turnIndex: context.turnIndex + 1
      };
    }),

    // Context updates
    updateContext: assign(({ context, event }) => {
      const updates = {};
      
      // Extract data from event
      if (event.bookingData?.service) updates.service = event.bookingData.service;
      if (event.bookingData?.timeWindow) updates.timeWindow = event.bookingData.timeWindow;
      if (event.bookingData?.contact) updates.contact = event.bookingData.contact;
      if (event.entities?.service) updates.service = event.entities.service;
      if (event.entities?.timeWindow) updates.timeWindow = event.entities.timeWindow;
      if (event.entities?.contact) updates.contact = event.entities.contact;
      
      // Update confidence and intent
      if (event.confidence) updates.confidence = event.confidence;
      if (event.intent) updates.intent = event.intent;
      if (event.response) updates.currentResponse = event.response;
      
      // Preserve business config
      if (event.businessConfig) updates.businessConfig = event.businessConfig;
      if (event.organizationContext) updates.organizationContext = event.organizationContext;
      
      return updates;
    }),

    // Progressive summarization
    updateProgressSummary: assign(({ context }) => {
      const parts = [];
      
      if (context.service && context.serviceValidated) {
        parts.push(`${context.service}`);
      }
      
      if (context.timeWindow && context.timeConfirmed) {
        parts.push(`for ${context.timeWindow}`);
      }
      
      if (context.locationKind && context.locationValidated) {
        if (context.locationKind === 'on_site' && context.serviceAddress) {
          parts.push(`at ${context.serviceAddress}`);
        } else if (context.locationKind === 'at_business' && context.businessLocationId) {
          const location = getBusinessLocation(context.businessLocationId, context.businessConfig);
          parts.push(`at our ${location?.name || 'location'}`);
        }
      }
      
      if (context.contact && context.contactValidated) {
        parts.push(`contact: ${context.contact}`);
      }
      
      return {
        progressSummary: parts.length > 0 ? parts.join(', ') : ''
      };
    }),

    // Slot extraction and validation
    extractService: assign(({ context, event }) => {
      const service = event.entities?.service || event.bookingData?.service;
      const isValid = validateService(service, context.businessConfig);
      
      return {
        service,
        serviceValidated: isValid,
        confirmationAttempts: {
          ...context.confirmationAttempts,
          service: isValid ? 0 : context.confirmationAttempts.service
        }
      };
    }),

    extractTimeWindow: assign(({ context, event }) => {
      const timeWindow = event.entities?.timeWindow || event.bookingData?.timeWindow;
      const isValid = validateTimeWindow(timeWindow, context.businessConfig);
      
      return {
        timeWindow,
        timeConfirmed: false, // Needs explicit confirmation
        confirmationAttempts: {
          ...context.confirmationAttempts,
          timeWindow: isValid ? 0 : context.confirmationAttempts.timeWindow
        }
      };
    }),

    extractContact: assign(({ context, event }) => {
      const contact = event.entities?.contact || event.bookingData?.contact;
      const isValid = validateContact(contact);
      
      return {
        contact,
        contactValidated: isValid,
        confirmationAttempts: {
          ...context.confirmationAttempts,
          contact: isValid ? 0 : context.confirmationAttempts.contact
        }
      };
    }),

    extractLocation: assign(({ context, event }) => {
      const locationData = event.entities?.location || event.bookingData?.location;
      
      if (!locationData) return {};
      
      const updates = {};
      
      if (locationData.kind) updates.locationKind = locationData.kind;
      if (locationData.address) updates.serviceAddress = locationData.address;
      if (locationData.businessLocationId) updates.businessLocationId = locationData.businessLocationId;
      
      return updates;
    }),

    // Confirmation tracking
    incrementConfirmationAttempt: assign(({ context, event }) => {
      const slotType = determineSlotType(context);
      
      return {
        confirmationAttempts: {
          ...context.confirmationAttempts,
          [slotType]: context.confirmationAttempts[slotType] + 1
        }
      };
    }),

    // Confirmation actions
    markServiceConfirmed: assign(() => ({ serviceValidated: true })),
    markTimeConfirmed: assign(() => ({ timeConfirmed: true })),
    markContactConfirmed: assign(() => ({ contactValidated: true })),
    markLocationConfirmed: assign(() => ({ locationValidated: true })),

    // Reset actions
    resetServiceData: assign(() => ({ 
      service: null, 
      serviceValidated: false,
      confirmationAttempts: { service: 0 }
    })),
    
    resetTimeData: assign(() => ({ 
      timeWindow: null, 
      timeConfirmed: false,
      confirmationAttempts: { timeWindow: 0 }
    })),
    
    resetContactData: assign(() => ({ 
      contact: null, 
      contactValidated: false,
      confirmationAttempts: { contact: 0 }
    })),
    
    resetLocationData: assign(() => ({ 
      locationKind: null, 
      serviceAddress: null,
      businessLocationId: null,
      locationValidated: false,
      confirmationAttempts: { location: 0 }
    })),

    // Digression handling
    pushDigressionStack: assign(({ context, event }) => {
      return {
        digressionStack: [...context.digressionStack, {
          state: context.lastTransition,
          context: { ...context },
          timestamp: Date.now()
        }],
        digressionContext: event
      };
    }),

    popDigressionStack: assign(({ context }) => {
      const stack = [...context.digressionStack];
      const previousState = stack.pop();
      
      return {
        digressionStack: stack,
        digressionContext: null,
        // Restore relevant context
        service: previousState?.context.service || context.service,
        timeWindow: previousState?.context.timeWindow || context.timeWindow,
        contact: previousState?.context.contact || context.contact
      };
    }),

    // Error handling
    updateErrorHistory: assign(({ context, event }) => ({
      errorHistory: [...context.errorHistory, {
        error: event.data,
        timestamp: Date.now(),
        state: context.lastTransition
      }]
    })),

    // Silence and timeout handling
    incrementSilenceCount: assign(({ context }) => ({
      silenceCount: context.silenceCount + 1
    })),

    recordBargeIn: assign(() => ({
      bargeInDetected: true
    }))
  },

  // Services
  services: {
    createAppointmentService: async (context) => {
      try {
        const appointmentData = {
          organizationId: context.organizationContext?.organizationId || process.env.DEFAULT_ORG_ID,
          service: context.service,
          contactPhone: extractPhoneNumber(context.contact),
          contactEmail: extractEmail(context.contact),
          notes: generateBookingNotes(context),
          startAt: parseDateTime(context.timeWindow),
          endAt: calculateEndTime(context.timeWindow, context.service, context.businessConfig),
          locationKind: context.locationKind,
          serviceAddress: context.serviceAddress,
          businessLocationId: context.businessLocationId,
          status: 'confirmed'
        };
        
        return await createAppointment(appointmentData);
      } catch (error) {
        console.error('Error creating appointment:', error);
        throw error;
      }
    },

    scheduleCallbackService: async (context) => {
      try {
        const callbackData = {
          organizationId: context.organizationContext?.organizationId || process.env.DEFAULT_ORG_ID,
          service: context.service || 'General inquiry',
          contactPhone: extractPhoneNumber(context.contact) || 'Unknown',
          preferredTime: context.timeWindow || 'Flexible',
          reason: context.escalationReason || 'Booking assistance needed',
          notes: generateCallbackNotes(context),
          status: 'pending_callback',
          callbackBy: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
        };
        
        return await createAppointment(callbackData);
      } catch (error) {
        console.error('Error scheduling callback:', error);
        throw error;
      }
    }
  }
});

// Utility functions

const validateService = (service, businessConfig) => {
  if (!service || !businessConfig) return false;
  
  const services = businessConfig.services || [];
  const activeServices = services.filter(s => s.active);
  
  if (activeServices.length === 0) return false;
  
  const cleanService = service.toLowerCase().trim();
  
  // Exact match
  const exactMatch = activeServices.find(s => 
    s.name.toLowerCase().trim() === cleanService
  );
  if (exactMatch) return true;
  
  // Fuzzy match
  const fuzzyMatch = activeServices.find(s => {
    const serviceName = s.name.toLowerCase().trim();
    return serviceName.includes(cleanService) || cleanService.includes(serviceName);
  });
  
  return !!fuzzyMatch;
};

const validateTimeWindow = (timeWindow, businessConfig) => {
  if (!timeWindow) return false;
  
  // Basic validation - in production, check against calendar availability
  const timePatterns = [
    /\d{1,2}:\d{2}\s*(am|pm)/i,
    /\d{1,2}\s*(am|pm)/i,
    /(morning|afternoon|evening)/i,
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(today|tomorrow|next week)/i
  ];
  
  return timePatterns.some(pattern => pattern.test(timeWindow));
};

const validateContact = (contact) => {
  if (!contact) return false;
  
  // Check for phone number or email
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  
  return phonePattern.test(contact) || emailPattern.test(contact);
};

const validateLocation = (locationData, businessConfig) => {
  if (!locationData) return false;
  
  if (locationData.kind === 'on_site') {
    return !!locationData.address;
  } else if (locationData.kind === 'at_business') {
    const locations = businessConfig?.locations?.branches || [];
    return locations.some(loc => loc.id === locationData.businessLocationId);
  }
  
  return true; // Remote or other valid types
};

const getThreshold = (slotType, businessConfig) => {
  const defaultThresholds = {
    service: 3,
    timeWindow: 3,
    contact: 3,
    location: 3
  };
  
  return businessConfig?.policies?.confirmationThresholds?.[slotType] || defaultThresholds[slotType];
};

const determineSlotType = (context) => {
  if (!context.service || !context.serviceValidated) return 'service';
  if (!context.timeWindow || !context.timeConfirmed) return 'timeWindow';
  if (!context.contact || !context.contactValidated) return 'contact';
  if (!context.locationKind || !context.locationValidated) return 'location';
  return 'service'; // fallback
};

const extractPhoneNumber = (contact) => {
  if (!contact) return null;
  const phoneMatch = contact.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
  return phoneMatch ? phoneMatch[0] : null;
};

const extractEmail = (contact) => {
  if (!contact) return null;
  const emailMatch = contact.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return emailMatch ? emailMatch[0] : null;
};

const parseDateTime = (timeString) => {
  if (!timeString) return new Date();
  
  // Simple parsing - in production, use a robust date parser
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  
  return tomorrow;
};

const calculateEndTime = (startTime, service, businessConfig) => {
  const start = parseDateTime(startTime);
  const duration = getServiceDuration(service, businessConfig);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + duration);
  return end;
};

const getServiceDuration = (service, businessConfig) => {
  const services = businessConfig?.services || [];
  const serviceConfig = services.find(s => s.name.toLowerCase().includes(service?.toLowerCase()));
  return serviceConfig?.defaultDuration || 60; // Default 60 minutes
};

const getBusinessLocation = (locationId, businessConfig) => {
  const locations = businessConfig?.locations?.branches || [];
  return locations.find(loc => loc.id === locationId);
};

const generateBookingNotes = (context) => {
  const parts = [`Service: ${context.service}`];
  
  if (context.timeWindow) parts.push(`Time: ${context.timeWindow}`);
  if (context.contact) parts.push(`Contact: ${context.contact}`);
  
  if (context.locationKind === 'on_site' && context.serviceAddress) {
    parts.push(`Address: ${context.serviceAddress}`);
  } else if (context.locationKind === 'at_business' && context.businessLocationId) {
    const location = getBusinessLocation(context.businessLocationId, context.businessConfig);
    parts.push(`Location: ${location?.name || context.businessLocationId}`);
  }
  
  return parts.join('; ');
};

const generateCallbackNotes = (context) => {
  const parts = ['Callback requested from voice agent'];
  
  if (context.service) parts.push(`Service: ${context.service}`);
  if (context.timeWindow) parts.push(`Preferred time: ${context.timeWindow}`);
  if (context.escalationReason) parts.push(`Reason: ${context.escalationReason}`);
  
  if (context.progressSummary) {
    parts.push(`Progress: ${context.progressSummary}`);
  }
  
  return parts.join('; ');
};

module.exports = {
  enhancedBookingMachine,
  validateService,
  validateTimeWindow,
  validateContact,
  validateLocation,
  extractPhoneNumber,
  extractEmail,
  parseDateTime,
  calculateEndTime
};