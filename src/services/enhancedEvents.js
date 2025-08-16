/**
 * Enhanced Event Definitions for Voice Agent State Machine
 * Comprehensive event types for all state machine interactions
 */

// Core event types
const EventTypes = {
  // Primary processing events
  PROCESS_INTENT: 'PROCESS_INTENT',
  
  // User interaction events
  USER_SPEECH: 'USER_SPEECH',
  USER_SILENCE: 'USER_SILENCE',
  BARGE_IN: 'BARGE_IN',
  
  // Slot collection events
  SERVICE_PROVIDED: 'SERVICE_PROVIDED',
  LOCATION_PROVIDED: 'LOCATION_PROVIDED',
  TIME_PROVIDED: 'TIME_PROVIDED',
  CONTACT_PROVIDED: 'CONTACT_PROVIDED',
  
  // Confirmation events
  CONFIRMATION_YES: 'CONFIRMATION_YES',
  CONFIRMATION_NO: 'CONFIRMATION_NO',
  MODIFICATION_REQUEST: 'MODIFICATION_REQUEST',
  
  // Digression events
  DIGRESSION: 'DIGRESSION',
  HOURS_QUESTION: 'HOURS_QUESTION',
  LOCATION_QUESTION: 'LOCATION_QUESTION',
  SERVICES_QUESTION: 'SERVICES_QUESTION',
  PRICING_QUESTION: 'PRICING_QUESTION',
  GENERAL_QUESTION: 'GENERAL_QUESTION',
  
  // Error and recovery events
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RETRY_EXCEEDED: 'RETRY_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  
  // Escalation events
  ESCALATE: 'ESCALATE',
  CALLBACK_REQUEST: 'CALLBACK_REQUEST',
  HUMAN_HANDOFF: 'HUMAN_HANDOFF',
  
  // Calendar and integration events
  CALENDAR_CHECK: 'CALENDAR_CHECK',
  CALENDAR_ERROR: 'CALENDAR_ERROR',
  INTEGRATION_FAILURE: 'INTEGRATION_FAILURE',
  
  // Booking events
  BOOK_APPOINTMENT: 'BOOK_APPOINTMENT',
  BOOKING_SUCCESS: 'BOOKING_SUCCESS',
  BOOKING_FAILURE: 'BOOKING_FAILURE',
  
  // Session management events
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',
  
  // Skip events for optional flows
  SKIP_LOCATION: 'SKIP_LOCATION',
  SKIP_CONFIRMATION: 'SKIP_CONFIRMATION'
};

// Intent types for classification
const IntentTypes = {
  // Booking intents
  BOOKING: 'booking',
  SERVICE_INQUIRY: 'service_inquiry',
  SCHEDULE_APPOINTMENT: 'schedule_appointment',
  
  // Information intents
  HOURS: 'hours',
  LOCATION: 'location',
  SERVICES: 'services',
  PRICING: 'pricing',
  GENERAL_INFO: 'general_info',
  
  // Slot-specific intents
  SERVICE_PROVIDED: 'service_provided',
  TIME_PROVIDED: 'time_provided',
  CONTACT_PROVIDED: 'contact_provided',
  LOCATION_PROVIDED: 'location_provided',
  
  // Confirmation intents
  CONFIRMATION_YES: 'confirmation_yes',
  CONFIRMATION_NO: 'confirmation_no',
  AFFIRMATIVE: 'affirmative',
  NEGATIVE: 'negative',
  
  // Modification intents
  CHANGE_SERVICE: 'change_service',
  CHANGE_TIME: 'change_time',
  CHANGE_CONTACT: 'change_contact',
  CHANGE_LOCATION: 'change_location',
  
  // Control intents
  UNCLEAR: 'unclear',
  REPEAT: 'repeat',
  HELP: 'help',
  CANCEL: 'cancel',
  
  // Error intents
  ERROR: 'error',
  TIMEOUT: 'timeout'
};

// Location types for enhanced location capture
const LocationTypes = {
  ON_SITE: 'on_site',
  AT_BUSINESS: 'at_business',
  REMOTE: 'remote',
  HYBRID: 'hybrid'
};

// Event creators for type safety and consistency
const createEvent = {
  /**
   * Core processing event with intent classification
   */
  processIntent: ({
    intent,
    confidence,
    response,
    originalSpeech,
    entities = {},
    bookingData = {},
    businessConfig = null,
    organizationContext = null,
    sessionId = null,
    turnIndex = 0,
    processingTimeMs = 0
  }) => ({
    type: EventTypes.PROCESS_INTENT,
    intent,
    confidence,
    response,
    originalSpeech,
    entities,
    bookingData,
    businessConfig,
    organizationContext,
    sessionId,
    turnIndex,
    processingTimeMs,
    timestamp: Date.now()
  }),

  /**
   * User speech input event
   */
  userSpeech: ({
    transcript,
    confidence,
    isFinal = true,
    isInterim = false,
    bargeIn = false,
    sessionId,
    audioMetadata = {}
  }) => ({
    type: EventTypes.USER_SPEECH,
    transcript,
    confidence,
    isFinal,
    isInterim,
    bargeIn,
    sessionId,
    audioMetadata,
    timestamp: Date.now()
  }),

  /**
   * Barge-in detection event
   */
  bargeIn: ({
    sessionId,
    interruptedAt,
    newTranscript,
    confidence = 0.0
  }) => ({
    type: EventTypes.BARGE_IN,
    sessionId,
    interruptedAt,
    newTranscript,
    confidence,
    timestamp: Date.now()
  }),

  /**
   * Service information provided event
   */
  serviceProvided: ({
    service,
    confidence,
    rawText,
    sessionId,
    validated = false
  }) => ({
    type: EventTypes.SERVICE_PROVIDED,
    entities: {
      service
    },
    confidence,
    rawText,
    sessionId,
    validated,
    timestamp: Date.now()
  }),

  /**
   * Enhanced location information provided event
   */
  locationProvided: ({
    locationKind,
    serviceAddress = null,
    businessLocationId = null,
    coordinates = null,
    notes = null,
    confidence,
    rawText,
    sessionId
  }) => ({
    type: EventTypes.LOCATION_PROVIDED,
    entities: {
      location: {
        kind: locationKind,
        serviceAddress,
        businessLocationId,
        coordinates,
        notes
      }
    },
    confidence,
    rawText,
    sessionId,
    timestamp: Date.now()
  }),

  /**
   * Time information provided event
   */
  timeProvided: ({
    timeWindow,
    preferredTime,
    timeRange = null,
    flexibility = null,
    confidence,
    rawText,
    sessionId
  }) => ({
    type: EventTypes.TIME_PROVIDED,
    entities: {
      timeWindow,
      preferredTime,
      timeRange,
      flexibility
    },
    confidence,
    rawText,
    sessionId,
    timestamp: Date.now()
  }),

  /**
   * Contact information provided event
   */
  contactProvided: ({
    contact,
    phoneNumber = null,
    name = null,
    email = null,
    confidence,
    rawText,
    sessionId
  }) => ({
    type: EventTypes.CONTACT_PROVIDED,
    entities: {
      contact,
      phoneNumber,
      name,
      email
    },
    confidence,
    rawText,
    sessionId,
    timestamp: Date.now()
  }),

  /**
   * Positive confirmation event
   */
  confirmationYes: ({
    confirmationType = 'general', // 'service', 'time', 'contact', 'location', 'final'
    confidence,
    rawText,
    sessionId
  }) => ({
    type: EventTypes.CONFIRMATION_YES,
    confirmationType,
    confidence,
    rawText,
    sessionId,
    timestamp: Date.now()
  }),

  /**
   * Negative confirmation event
   */
  confirmationNo: ({
    confirmationType = 'general',
    confidence,
    rawText,
    sessionId,
    modificationIntent = null
  }) => ({
    type: EventTypes.CONFIRMATION_NO,
    confirmationType,
    confidence,
    rawText,
    sessionId,
    modificationIntent,
    timestamp: Date.now()
  }),

  /**
   * Modification request event
   */
  modificationRequest: ({
    targetSlot, // 'service', 'time', 'contact', 'location'
    newValue = null,
    reason = null,
    confidence,
    rawText,
    sessionId
  }) => ({
    type: EventTypes.MODIFICATION_REQUEST,
    targetSlot,
    newValue,
    reason,
    confidence,
    rawText,
    sessionId,
    timestamp: Date.now()
  }),

  /**
   * Digression event for side questions
   */
  digression: ({
    digressionType, // 'hours', 'location', 'services', 'pricing', 'general'
    question,
    confidence,
    rawText,
    sessionId,
    currentState
  }) => ({
    type: EventTypes.DIGRESSION,
    digressionType,
    question,
    confidence,
    rawText,
    sessionId,
    currentState,
    timestamp: Date.now()
  }),

  /**
   * Timeout event with context
   */
  timeout: ({
    timeoutType, // 'user_silence', 'system_delay', 'session_timeout'
    timeoutDuration,
    expectedResponse = null,
    sessionId,
    currentState
  }) => ({
    type: EventTypes.TIMEOUT,
    timeoutType,
    timeoutDuration,
    expectedResponse,
    sessionId,
    currentState,
    timestamp: Date.now()
  }),

  /**
   * Validation error event
   */
  validationError: ({
    validationType, // 'service', 'time', 'contact', 'location'
    error,
    attemptedValue,
    sessionId,
    retryCount = 0
  }) => ({
    type: EventTypes.VALIDATION_ERROR,
    validationType,
    error,
    attemptedValue,
    sessionId,
    retryCount,
    timestamp: Date.now()
  }),

  /**
   * Calendar check event
   */
  calendarCheck: ({
    requestedTime,
    serviceType,
    duration,
    sessionId
  }) => ({
    type: EventTypes.CALENDAR_CHECK,
    requestedTime,
    serviceType,
    duration,
    sessionId,
    timestamp: Date.now()
  }),

  /**
   * Calendar error event
   */
  calendarError: ({
    error,
    errorType, // 'unavailable', 'conflict', 'integration_failure'
    requestedTime,
    sessionId,
    alternativeTimes = []
  }) => ({
    type: EventTypes.CALENDAR_ERROR,
    error,
    errorType,
    requestedTime,
    sessionId,
    alternativeTimes,
    timestamp: Date.now()
  }),

  /**
   * Escalation event
   */
  escalate: ({
    reason, // 'retry_exceeded', 'complex_request', 'system_failure', 'user_request'
    sessionId,
    escalationType = 'human', // 'human', 'callback', 'manager'
    context = {},
    priority = 'normal' // 'low', 'normal', 'high', 'urgent'
  }) => ({
    type: EventTypes.ESCALATE,
    reason,
    sessionId,
    escalationType,
    context,
    priority,
    timestamp: Date.now()
  }),

  /**
   * Booking success event
   */
  bookingSuccess: ({
    appointmentId,
    appointmentData,
    confirmationSent = false,
    sessionId
  }) => ({
    type: EventTypes.BOOKING_SUCCESS,
    appointmentId,
    appointmentData,
    confirmationSent,
    sessionId,
    timestamp: Date.now()
  }),

  /**
   * Booking failure event
   */
  bookingFailure: ({
    error,
    errorType, // 'validation', 'calendar', 'system', 'integration'
    attemptedData,
    sessionId,
    retryable = true
  }) => ({
    type: EventTypes.BOOKING_FAILURE,
    error,
    errorType,
    attemptedData,
    sessionId,
    retryable,
    timestamp: Date.now()
  }),

  /**
   * Session management events
   */
  sessionStart: ({
    sessionId,
    organizationId,
    callerId = null,
    initialContext = {}
  }) => ({
    type: EventTypes.SESSION_START,
    sessionId,
    organizationId,
    callerId,
    initialContext,
    timestamp: Date.now()
  }),

  sessionEnd: ({
    sessionId,
    reason, // 'completed', 'timeout', 'error', 'user_hangup'
    outcome, // 'booking_success', 'callback_scheduled', 'escalated', 'failed'
    finalContext = {},
    metrics = {}
  }) => ({
    type: EventTypes.SESSION_END,
    sessionId,
    reason,
    outcome,
    finalContext,
    metrics,
    timestamp: Date.now()
  }),

  /**
   * Skip events for optional flows
   */
  skipLocation: ({
    reason = 'not_required',
    sessionId
  }) => ({
    type: EventTypes.SKIP_LOCATION,
    reason,
    sessionId,
    timestamp: Date.now()
  })
};

// Event validation functions
const validateEvent = {
  /**
   * Validate PROCESS_INTENT event structure
   */
  processIntent: (event) => {
    const required = ['type', 'intent', 'confidence', 'response'];
    const missing = required.filter(field => !(field in event));
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    if (typeof event.confidence !== 'number' || event.confidence < 0 || event.confidence > 1) {
      throw new Error('Confidence must be a number between 0 and 1');
    }
    
    if (!Object.values(IntentTypes).includes(event.intent)) {
      console.warn(`Unknown intent type: ${event.intent}`);
    }
    
    return true;
  },

  /**
   * Validate location event structure
   */
  locationProvided: (event) => {
    if (!event.entities?.location?.kind) {
      throw new Error('Location kind is required');
    }
    
    const validKinds = Object.values(LocationTypes);
    if (!validKinds.includes(event.entities.location.kind)) {
      throw new Error(`Invalid location kind. Must be one of: ${validKinds.join(', ')}`);
    }
    
    if (event.entities.location.kind === LocationTypes.ON_SITE && 
        !event.entities.location.serviceAddress) {
      console.warn('On-site appointments should include service address');
    }
    
    return true;
  },

  /**
   * Validate timeout event structure
   */
  timeout: (event) => {
    const validTimeoutTypes = ['user_silence', 'system_delay', 'session_timeout'];
    if (!validTimeoutTypes.includes(event.timeoutType)) {
      throw new Error(`Invalid timeout type: ${event.timeoutType}`);
    }
    
    if (typeof event.timeoutDuration !== 'number' || event.timeoutDuration < 0) {
      throw new Error('Timeout duration must be a positive number');
    }
    
    return true;
  }
};

// Event transformation utilities
const transformEvent = {
  /**
   * Transform legacy event format to enhanced format
   */
  fromLegacy: (legacyEvent) => {
    if (legacyEvent.type === 'PROCESS_INTENT') {
      return {
        ...legacyEvent,
        timestamp: legacyEvent.timestamp || Date.now(),
        processingTimeMs: legacyEvent.processingTimeMs || 0
      };
    }
    
    return legacyEvent;
  },

  /**
   * Extract entities from natural language processing results
   */
  fromNLPResult: (nlpResult, sessionId) => {
    const { intent, confidence, entities, originalText } = nlpResult;
    
    // Create appropriate event based on intent
    switch (intent) {
      case IntentTypes.SERVICE_PROVIDED:
        return createEvent.serviceProvided({
          service: entities.service,
          confidence,
          rawText: originalText,
          sessionId
        });
        
      case IntentTypes.TIME_PROVIDED:
        return createEvent.timeProvided({
          timeWindow: entities.timeWindow,
          preferredTime: entities.preferredTime,
          confidence,
          rawText: originalText,
          sessionId
        });
        
      case IntentTypes.CONTACT_PROVIDED:
        return createEvent.contactProvided({
          contact: entities.contact,
          phoneNumber: entities.phoneNumber,
          name: entities.name,
          email: entities.email,
          confidence,
          rawText: originalText,
          sessionId
        });
        
      case IntentTypes.LOCATION_PROVIDED:
        return createEvent.locationProvided({
          locationKind: entities.location?.kind,
          serviceAddress: entities.location?.serviceAddress,
          confidence,
          rawText: originalText,
          sessionId
        });
        
      case IntentTypes.CONFIRMATION_YES:
        return createEvent.confirmationYes({
          confidence,
          rawText: originalText,
          sessionId
        });
        
      case IntentTypes.CONFIRMATION_NO:
        return createEvent.confirmationNo({
          confidence,
          rawText: originalText,
          sessionId
        });
        
      default:
        return createEvent.processIntent({
          intent,
          confidence,
          response: '', // Will be generated by state machine
          originalSpeech: originalText,
          entities,
          sessionId
        });
    }
  }
};

// Event filtering and querying utilities
const EventFilters = {
  /**
   * Filter events by type
   */
  byType: (events, eventType) => {
    return events.filter(event => event.type === eventType);
  },

  /**
   * Filter events by session
   */
  bySession: (events, sessionId) => {
    return events.filter(event => event.sessionId === sessionId);
  },

  /**
   * Filter events by time range
   */
  byTimeRange: (events, startTime, endTime) => {
    return events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  },

  /**
   * Filter confirmation events
   */
  confirmations: (events) => {
    return events.filter(event => 
      event.type === EventTypes.CONFIRMATION_YES || 
      event.type === EventTypes.CONFIRMATION_NO
    );
  },

  /**
   * Filter error events
   */
  errors: (events) => {
    return events.filter(event => 
      event.type === EventTypes.VALIDATION_ERROR ||
      event.type === EventTypes.SYSTEM_ERROR ||
      event.type === EventTypes.CALENDAR_ERROR ||
      event.type === EventTypes.BOOKING_FAILURE
    );
  },

  /**
   * Filter digression events
   */
  digressions: (events) => {
    return events.filter(event => event.type === EventTypes.DIGRESSION);
  }
};

// Event analytics utilities
const EventAnalytics = {
  /**
   * Calculate session metrics from events
   */
  calculateSessionMetrics: (events, sessionId) => {
    const sessionEvents = EventFilters.bySession(events, sessionId);
    
    if (sessionEvents.length === 0) {
      return null;
    }
    
    const startEvent = sessionEvents.find(e => e.type === EventTypes.SESSION_START);
    const endEvent = sessionEvents.find(e => e.type === EventTypes.SESSION_END);
    
    const confirmations = EventFilters.confirmations(sessionEvents);
    const errors = EventFilters.errors(sessionEvents);
    const digressions = EventFilters.digressions(sessionEvents);
    
    return {
      sessionId,
      duration: endEvent && startEvent ? endEvent.timestamp - startEvent.timestamp : null,
      totalEvents: sessionEvents.length,
      confirmationAttempts: confirmations.length,
      errorCount: errors.length,
      digressionCount: digressions.length,
      outcome: endEvent?.outcome || 'unknown',
      completedSuccessfully: endEvent?.outcome === 'booking_success'
    };
  },

  /**
   * Calculate intent confidence trends
   */
  calculateConfidenceTrends: (events) => {
    const processIntentEvents = EventFilters.byType(events, EventTypes.PROCESS_INTENT);
    
    return processIntentEvents.map(event => ({
      timestamp: event.timestamp,
      intent: event.intent,
      confidence: event.confidence
    }));
  },

  /**
   * Identify common failure patterns
   */
  identifyFailurePatterns: (events) => {
    const errors = EventFilters.errors(events);
    const patterns = {};
    
    errors.forEach(error => {
      const key = `${error.errorType || error.validationType || 'unknown'}`;
      patterns[key] = (patterns[key] || 0) + 1;
    });
    
    return Object.entries(patterns)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }
};

module.exports = {
  EventTypes,
  IntentTypes,
  LocationTypes,
  createEvent,
  validateEvent,
  transformEvent,
  EventFilters,
  EventAnalytics
};