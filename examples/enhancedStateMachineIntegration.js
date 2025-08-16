/**
 * Enhanced State Machine Integration Example
 * Demonstrates how to integrate the enhanced state machine with
 * the existing voice pipeline and real-time WebSocket handling
 */

const { createActor } = require('xstate');
const { enhancedBookingMachine, createInitialContext } = require('../src/services/enhancedStateMachine');
const { detectEnhancedIntent, generateEnhancedResponse } = require('../src/services/enhancedLLM');
const { createEvent, EventTypes, IntentTypes, LocationTypes } = require('../src/services/enhancedEvents');

/**
 * Enhanced Voice Pipeline Integration
 * Replaces the existing pipeline with enhanced capabilities
 */
class EnhancedVoicePipeline {
  constructor(organizationConfig, tenantConfig = {}) {
    this.organizationConfig = organizationConfig;
    this.tenantConfig = {
      maxRetries: 3,
      timeoutSeconds: 30,
      enableBargeIn: true,
      confirmationThreshold: 3,
      locationRequired: false,
      escalationEnabled: true,
      ...tenantConfig
    };
    
    // Active sessions map
    this.activeSessions = new Map();
    
    // Telemetry collector
    this.telemetryCollector = new TelemetryCollector();
  }

  /**
   * Initialize a new voice session
   */
  initializeSession(sessionId, callerId = null, organizationContext = {}) {
    console.log(`🚀 Initializing enhanced session: ${sessionId}`);
    
    const initialContext = {
      ...createInitialContext(),
      sessionId,
      businessConfig: this.organizationConfig.businessConfig,
      organizationContext: {
        organizationId: this.organizationConfig.id,
        organizationName: this.organizationConfig.name,
        ...organizationContext
      },
      tenantConfig: this.tenantConfig,
      callerId,
      startTime: Date.now()
    };

    const actor = createActor(enhancedBookingMachine, { input: initialContext });
    
    // Set up event listeners for telemetry
    actor.subscribe((snapshot) => {
      this.telemetryCollector.recordStateChange(sessionId, snapshot);
    });

    actor.start();
    
    // Store session
    this.activeSessions.set(sessionId, {
      actor,
      startTime: Date.now(),
      lastActivity: Date.now(),
      metrics: {
        totalTurns: 0,
        avgResponseTime: 0,
        totalProcessingTime: 0
      }
    });

    // Send session start event
    actor.send(createEvent.sessionStart({
      sessionId,
      organizationId: this.organizationConfig.id,
      callerId,
      initialContext
    }));

    return actor;
  }

  /**
   * Process incoming speech with enhanced intent detection
   */
  async processUserSpeech(sessionId, transcript, audioMetadata = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();
    session.lastActivity = startTime;
    session.metrics.totalTurns++;

    console.log(`🎙️ Processing speech for session ${sessionId}:`, transcript);

    try {
      // Step 1: Enhanced intent detection
      const intentResult = await detectEnhancedIntent(transcript, {
        businessConfig: this.organizationConfig.businessConfig,
        organizationContext: session.actor.getSnapshot().context.organizationContext,
        ...session.actor.getSnapshot().context
      });

      console.log(`🔍 Intent detected:`, {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        entities: intentResult.entities
      });

      // Step 2: Create enhanced event
      const event = this.createEventFromIntentResult(intentResult, sessionId);

      // Step 3: Send event to state machine
      session.actor.send(event);

      // Step 4: Get current state and generate response
      const snapshot = session.actor.getSnapshot();
      const responseOptions = {
        retryCount: snapshot.context.retryCount || 0,
        includeProgressSummary: this.shouldIncludeProgressSummary(snapshot.context),
        urgency: this.calculateUrgency(snapshot.context)
      };

      const response = await generateEnhancedResponse(
        snapshot.value,
        snapshot.context,
        responseOptions
      );

      // Step 5: Record processing metrics
      const processingTime = Date.now() - startTime;
      session.metrics.totalProcessingTime += processingTime;
      session.metrics.avgResponseTime = session.metrics.totalProcessingTime / session.metrics.totalTurns;

      // Step 6: Check for special conditions
      await this.handleSpecialConditions(sessionId, snapshot);

      console.log(`✅ Response generated (${processingTime}ms):`, response.substring(0, 100) + '...');

      return {
        response,
        confidence: intentResult.confidence,
        intent: intentResult.intent,
        context: snapshot.context,
        processingTimeMs: processingTime,
        sessionMetrics: session.metrics
      };

    } catch (error) {
      console.error(`❌ Error processing speech for session ${sessionId}:`, error);
      
      // Send error event to state machine
      session.actor.send(createEvent.validationError({
        validationType: 'processing',
        error: error.message,
        attemptedValue: transcript,
        sessionId,
        retryCount: session.actor.getSnapshot().context.retryCount || 0
      }));

      return {
        response: "I apologize, I'm having some technical difficulties. Could you please repeat that?",
        confidence: 0.0,
        intent: IntentTypes.ERROR,
        error: error.message,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Handle barge-in interruptions
   */
  async handleBargeIn(sessionId, newTranscript, interruptedAt) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    console.log(`🔄 Barge-in detected for session ${sessionId}:`, newTranscript);

    session.actor.send(createEvent.bargeIn({
      sessionId,
      interruptedAt,
      newTranscript,
      confidence: 0.7 // Moderate confidence for interruptions
    }));

    // Process the new speech
    return await this.processUserSpeech(sessionId, newTranscript);
  }

  /**
   * Handle session timeouts
   */
  handleTimeout(sessionId, timeoutType = 'user_silence', duration = 30000) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    console.log(`⏰ Timeout for session ${sessionId}:`, timeoutType);

    session.actor.send(createEvent.timeout({
      timeoutType,
      timeoutDuration: duration,
      sessionId,
      currentState: session.actor.getSnapshot().value
    }));

    // Check if we should escalate or end session
    const snapshot = session.actor.getSnapshot();
    if (snapshot.context.timeoutCount >= 3) {
      this.endSession(sessionId, 'timeout', 'multiple_timeouts');
    }
  }

  /**
   * End a voice session
   */
  endSession(sessionId, reason = 'completed', outcome = 'unknown') {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    console.log(`🔚 Ending session ${sessionId}:`, { reason, outcome });

    const finalSnapshot = session.actor.getSnapshot();
    const sessionDuration = Date.now() - session.startTime;

    // Send session end event
    session.actor.send(createEvent.sessionEnd({
      sessionId,
      reason,
      outcome,
      finalContext: finalSnapshot.context,
      metrics: {
        ...session.metrics,
        sessionDuration,
        finalState: finalSnapshot.value
      }
    }));

    // Record final telemetry
    this.telemetryCollector.recordSessionEnd(sessionId, {
      duration: sessionDuration,
      outcome,
      totalTurns: session.metrics.totalTurns,
      avgResponseTime: session.metrics.avgResponseTime,
      finalContext: finalSnapshot.context
    });

    // Clean up
    session.actor.stop();
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get session status and metrics
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const snapshot = session.actor.getSnapshot();
    return {
      sessionId,
      currentState: snapshot.value,
      context: snapshot.context,
      metrics: session.metrics,
      isActive: true,
      lastActivity: session.lastActivity
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys()).map(sessionId => 
      this.getSessionStatus(sessionId)
    );
  }

  // Private helper methods

  createEventFromIntentResult(intentResult, sessionId) {
    const baseEvent = {
      sessionId,
      confidence: intentResult.confidence,
      rawText: intentResult.rawText
    };

    switch (intentResult.intent) {
      case IntentTypes.SERVICE_PROVIDED:
        return createEvent.serviceProvided({
          service: intentResult.entities.service,
          ...baseEvent
        });

      case IntentTypes.LOCATION_PROVIDED:
        return createEvent.locationProvided({
          locationKind: intentResult.entities.location?.kind,
          serviceAddress: intentResult.entities.location?.serviceAddress,
          businessLocationId: intentResult.entities.location?.businessLocationId,
          notes: intentResult.entities.location?.notes,
          ...baseEvent
        });

      case IntentTypes.TIME_PROVIDED:
        return createEvent.timeProvided({
          timeWindow: intentResult.entities.timeWindow,
          preferredTime: intentResult.entities.timeWindow,
          ...baseEvent
        });

      case IntentTypes.CONTACT_PROVIDED:
        return createEvent.contactProvided({
          contact: intentResult.entities.contact,
          phoneNumber: intentResult.entities.phoneNumber,
          name: intentResult.entities.name,
          email: intentResult.entities.email,
          ...baseEvent
        });

      case IntentTypes.CONFIRMATION_YES:
        return createEvent.confirmationYes(baseEvent);

      case IntentTypes.CONFIRMATION_NO:
        return createEvent.confirmationNo({
          modificationIntent: intentResult.modificationTarget,
          ...baseEvent
        });

      case 'modification_request':
        return createEvent.modificationRequest({
          targetSlot: intentResult.modificationTarget,
          ...baseEvent
        });

      case 'digression':
        return createEvent.digression({
          digressionType: intentResult.digressionType,
          question: intentResult.rawText,
          currentState: 'unknown', // Will be set by state machine
          ...baseEvent
        });

      default:
        return createEvent.processIntent({
          intent: intentResult.intent,
          response: '', // Will be generated by state machine
          entities: intentResult.entities,
          ...baseEvent
        });
    }
  }

  shouldIncludeProgressSummary(context) {
    // Include summary if we have multiple pieces of information
    const collectedInfo = [
      context.service,
      context.location?.kind,
      context.preferredTime,
      context.contact
    ].filter(Boolean);

    return collectedInfo.length >= 2;
  }

  calculateUrgency(context) {
    // Calculate urgency based on various factors
    if (context.timeoutCount >= 2) return 'high';
    if (context.errorHistory?.length >= 3) return 'high';
    if (context.retryCount >= 5) return 'high';
    return 'normal';
  }

  async handleSpecialConditions(sessionId, snapshot) {
    const context = snapshot.context;

    // Check for escalation conditions
    if (context.errorHistory?.length >= 5 && context.tenantConfig.escalationEnabled) {
      console.log(`🚨 Triggering escalation for session ${sessionId}`);
      snapshot.actor?.send(createEvent.escalate({
        reason: 'multiple_errors',
        sessionId,
        escalationType: 'human',
        context: context,
        priority: 'high'
      }));
    }

    // Check for calendar integration
    if (context.preferredTime && context.service && !context.calendarError) {
      await this.checkCalendarAvailability(sessionId, context);
    }

    // Check for completion conditions
    if (snapshot.value === 'success') {
      // Send confirmation, update CRM, etc.
      await this.handleBookingSuccess(sessionId, context);
    }
  }

  async checkCalendarAvailability(sessionId, context) {
    try {
      // Simulate calendar check
      const isAvailable = Math.random() > 0.1; // 90% availability
      
      if (!isAvailable) {
        const session = this.activeSessions.get(sessionId);
        session?.actor.send(createEvent.calendarError({
          error: 'Time slot not available',
          errorType: 'conflict',
          requestedTime: context.preferredTime,
          sessionId,
          alternativeTimes: ['tomorrow at 3pm', 'Thursday at 2pm']
        }));
      }
    } catch (error) {
      console.error('Calendar check failed:', error);
    }
  }

  async handleBookingSuccess(sessionId, context) {
    try {
      // Record successful booking
      console.log(`✅ Booking successful for session ${sessionId}:`, {
        service: context.service,
        time: context.preferredTime,
        location: context.location,
        contact: context.contact
      });

      // Send confirmation email/SMS (simulated)
      await this.sendBookingConfirmation(context);
      
      // Update CRM (simulated)
      await this.updateCRM(context);

    } catch (error) {
      console.error('Post-booking actions failed:', error);
    }
  }

  async sendBookingConfirmation(context) {
    // Simulate sending confirmation
    console.log('📧 Sending booking confirmation to:', context.contact);
  }

  async updateCRM(context) {
    // Simulate CRM update
    console.log('📊 Updating CRM with booking details');
  }
}

/**
 * Telemetry Collector for Enhanced Monitoring
 */
class TelemetryCollector {
  constructor() {
    this.metrics = {
      sessions: new Map(),
      aggregates: {
        totalSessions: 0,
        successfulBookings: 0,
        averageSessionDuration: 0,
        averageResponseTime: 0,
        escalationRate: 0,
        completionRate: 0
      }
    };
  }

  recordStateChange(sessionId, snapshot) {
    if (!this.metrics.sessions.has(sessionId)) {
      this.metrics.sessions.set(sessionId, {
        states: [],
        startTime: Date.now(),
        stateTransitions: 0
      });
    }

    const session = this.metrics.sessions.get(sessionId);
    session.states.push({
      state: snapshot.value,
      timestamp: Date.now(),
      context: snapshot.context
    });
    session.stateTransitions++;
  }

  recordSessionEnd(sessionId, finalMetrics) {
    const session = this.metrics.sessions.get(sessionId);
    if (!session) return;

    session.endTime = Date.now();
    session.duration = finalMetrics.duration;
    session.outcome = finalMetrics.outcome;
    session.totalTurns = finalMetrics.totalTurns;
    session.avgResponseTime = finalMetrics.avgResponseTime;

    // Update aggregates
    this.updateAggregates();
  }

  updateAggregates() {
    const sessions = Array.from(this.metrics.sessions.values());
    const completedSessions = sessions.filter(s => s.endTime);

    if (completedSessions.length === 0) return;

    this.metrics.aggregates.totalSessions = completedSessions.length;
    this.metrics.aggregates.successfulBookings = completedSessions.filter(
      s => s.outcome === 'booking_success'
    ).length;
    
    this.metrics.aggregates.averageSessionDuration = 
      completedSessions.reduce((sum, s) => sum + s.duration, 0) / completedSessions.length;
    
    this.metrics.aggregates.averageResponseTime = 
      completedSessions.reduce((sum, s) => sum + s.avgResponseTime, 0) / completedSessions.length;
    
    this.metrics.aggregates.completionRate = 
      this.metrics.aggregates.successfulBookings / this.metrics.aggregates.totalSessions;
    
    this.metrics.aggregates.escalationRate = 
      completedSessions.filter(s => s.outcome === 'escalated').length / completedSessions.length;
  }

  getMetrics() {
    return this.metrics;
  }

  getSessionMetrics(sessionId) {
    return this.metrics.sessions.get(sessionId);
  }
}

/**
 * Example Usage
 */
async function demonstrateEnhancedPipeline() {
  console.log('🚀 Starting Enhanced Voice Pipeline Demo');

  // Organization configuration
  const organizationConfig = {
    id: 'demo-org-123',
    name: 'Demo Hair Salon',
    businessConfig: {
      services: [
        { name: 'Haircut', active: true, duration: 60 },
        { name: 'Consultation', active: true, duration: 30 },
        { name: 'Styling', active: true, duration: 90 }
      ],
      businessHours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' }
      },
      address: '123 Main Street, Demo City, DC 12345'
    }
  };

  // Tenant configuration
  const tenantConfig = {
    maxRetries: 3,
    confirmationThreshold: 3,
    locationRequired: true,
    escalationEnabled: true
  };

  // Initialize pipeline
  const pipeline = new EnhancedVoicePipeline(organizationConfig, tenantConfig);

  // Simulate a complete booking conversation
  const sessionId = 'demo-session-' + Date.now();
  
  try {
    // Initialize session
    pipeline.initializeSession(sessionId, '+1234567890');

    // Step 1: Initial booking request
    console.log('\n--- User: "I need to book a haircut" ---');
    let result = await pipeline.processUserSpeech(sessionId, "I need to book a haircut");
    console.log('Assistant:', result.response);

    // Step 2: Location preference
    console.log('\n--- User: "Can you come to my office?" ---');
    result = await pipeline.processUserSpeech(sessionId, "Can you come to my office at 456 Business Ave?");
    console.log('Assistant:', result.response);

    // Step 3: Time preference
    console.log('\n--- User: "Tomorrow at 2pm works" ---');
    result = await pipeline.processUserSpeech(sessionId, "Tomorrow at 2pm works for me");
    console.log('Assistant:', result.response);

    // Step 4: Contact information
    console.log('\n--- User: "John Smith, 555-1234" ---');
    result = await pipeline.processUserSpeech(sessionId, "John Smith, my number is 555-1234");
    console.log('Assistant:', result.response);

    // Step 5: Final confirmation
    console.log('\n--- User: "Yes, book it" ---');
    result = await pipeline.processUserSpeech(sessionId, "Yes, that sounds perfect, please book it");
    console.log('Assistant:', result.response);

    // Get final session status
    const finalStatus = pipeline.getSessionStatus(sessionId);
    console.log('\n--- Final Session Status ---');
    console.log('State:', finalStatus.currentState);
    console.log('Metrics:', finalStatus.metrics);

    // End session
    pipeline.endSession(sessionId, 'completed', 'booking_success');

    // Show telemetry
    const telemetry = pipeline.telemetryCollector.getMetrics();
    console.log('\n--- Telemetry ---');
    console.log('Aggregates:', telemetry.aggregates);

  } catch (error) {
    console.error('Demo error:', error);
    pipeline.endSession(sessionId, 'error', 'system_failure');
  }
}

/**
 * WebSocket Integration Example for Twilio Media Streams
 */
class EnhancedWebSocketHandler {
  constructor(voicePipeline) {
    this.voicePipeline = voicePipeline;
    this.activeConnections = new Map();
  }

  handleConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    console.log(`🔌 New WebSocket connection: ${connectionId}`);

    this.activeConnections.set(connectionId, {
      ws,
      sessionId: null,
      startTime: Date.now(),
      streamSid: null
    });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await this.handleMessage(connectionId, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });
  }

  async handleMessage(connectionId, data) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) return;

    switch (data.event) {
      case 'connected':
        console.log('📞 Call connected:', data.protocol);
        break;

      case 'start':
        connection.streamSid = data.streamSid;
        connection.sessionId = data.streamSid; // Use streamSid as sessionId
        
        // Initialize voice session
        this.voicePipeline.initializeSession(
          connection.sessionId,
          data.start?.callSid
        );
        break;

      case 'media':
        // Audio data received - would be processed by STT service
        // This is where you'd integrate with Deepgram or similar
        break;

      case 'stop':
        if (connection.sessionId) {
          this.voicePipeline.endSession(connection.sessionId, 'call_ended');
        }
        break;
    }
  }

  handleDisconnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (connection?.sessionId) {
      this.voicePipeline.endSession(connection.sessionId, 'disconnected');
    }
    
    this.activeConnections.delete(connectionId);
    console.log(`🔌 WebSocket disconnected: ${connectionId}`);
  }

  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export for use in other modules
module.exports = {
  EnhancedVoicePipeline,
  TelemetryCollector,
  EnhancedWebSocketHandler,
  demonstrateEnhancedPipeline
};

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateEnhancedPipeline().catch(console.error);
}