/**
 * Enhanced Voice Pipeline Integration
 * 
 * This service integrates the enhanced state machine and LLM service with
 * the existing voice pipeline, providing backwards compatibility while
 * enabling new features like location capture and tenant customization.
 * 
 * Uses lazy initialization to prevent circular dependencies during startup.
 */

const { interpret } = require('xstate');

// Lazy imports to prevent circular dependencies
let enhancedBookingMachine = null;
let EnhancedLLMService = null;

// Lazy initialization function
function getEnhancedServices() {
  if (!enhancedBookingMachine) {
    enhancedBookingMachine = require('./enhancedStateMachine').enhancedBookingMachine;
  }
  if (!EnhancedLLMService) {
    EnhancedLLMService = require('./enhancedLLM').EnhancedLLMService;
  }
  return { enhancedBookingMachine, EnhancedLLMService };
}

class EnhancedVoicePipeline {
  constructor(options = {}) {
    this.options = {
      enableEnhancedFeatures: true,
      fallbackToLegacy: true,
      telemetryEnabled: true,
      ...options
    };
    
    // Lazy initialization of LLM service
    this.llmService = null;
    this.activeSessions = new Map(); // sessionId -> session data
    this.performanceMetrics = new Map(); // sessionId -> metrics
  }

  /**
   * Get LLM service with lazy initialization
   */
  getLLMService() {
    if (!this.llmService) {
      const { EnhancedLLMService } = getEnhancedServices();
      this.llmService = new EnhancedLLMService();
    }
    return this.llmService;
  }

  /**
   * Initialize a new voice session with enhanced capabilities
   */
  initializeSession(sessionId, organizationContext) {
    console.log('🚀 Initializing Enhanced Voice Session:', {
      sessionId,
      organizationId: organizationContext?.organizationId,
      enhancedFeatures: this.options.enableEnhancedFeatures
    });

    // Lazy load enhanced services
    const { enhancedBookingMachine } = getEnhancedServices();

    // Create enhanced state machine instance with XState v5 syntax
    const stateMachine = interpret(enhancedBookingMachine, {
      input: {
        sessionId,
        organizationContext,
        businessConfig: organizationContext?.businessConfig || null,
        organizationId: organizationContext?.organizationId
      }
    });

    // Set up state machine logging
    stateMachine.subscribe((state) => {
      this.logStateTransition(sessionId, state);
    });

    const session = {
      sessionId,
      stateMachine,
      organizationContext,
      startTime: Date.now(),
      turnCount: 0,
      lastActivity: Date.now(),
      isEnhanced: this.options.enableEnhancedFeatures
    };

    this.activeSessions.set(sessionId, session);
    this.initializePerformanceTracking(sessionId);

    // Start the state machine
    stateMachine.start();

    return session;
  }

  /**
   * Process a complete voice turn with enhanced features
   */
  async processTurn(sessionId, transcript, confidence, callId = null, turnIndex = 0) {
    const startTime = Date.now();
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }



    try {
      console.log('🎯 Enhanced Turn Processing:', {
        sessionId,
        transcript: transcript.substring(0, 50),
        turnIndex,
        confidence
      });

      // Update session activity
      session.lastActivity = Date.now();
      session.turnCount++;

      // Get current state machine context
      const currentSnapshot = session.stateMachine.getSnapshot();
      const currentContext = {
        ...currentSnapshot.context,
        state: currentSnapshot.value,
        turnIndex,
        turnCount: session.turnCount,
        callId
      };

      // Step 1: Process with Enhanced LLM Service
      const llmStartTime = Date.now();
      const llmResult = await this.getLLMService().processMessage(
        transcript,
        sessionId,
        currentContext
      );
      const llmMs = Date.now() - llmStartTime;

      // Step 2: Update State Machine
      const stateStartTime = Date.now();
      
      // Enrich booking data with business configuration
      const enrichedBookingData = {
        ...llmResult.bookingData,
        businessConfig: session.organizationContext?.businessConfig,
        organizationContext: session.organizationContext,
        sessionId,
        turnIndex
      };

      // Send event to state machine
      session.stateMachine.send({
        type: 'PROCESS_INTENT',
        intent: llmResult.intent,
        confidence: llmResult.confidence,
        response: llmResult.response,
        bookingData: enrichedBookingData,
        entities: llmResult.entities,
        originalSpeech: transcript,
        businessConfig: session.organizationContext?.businessConfig,
        tool_calls: llmResult.tool_calls,
        tool_results: llmResult.tool_results
      });

      const stateMs = Date.now() - stateStartTime;
      const newSnapshot = session.stateMachine.getSnapshot();

      // Step 3: Generate Response (use LLM response which is already context-aware)
      const responseText = llmResult.response;

      // Step 4: Record Performance Metrics
      const totalMs = Date.now() - startTime;
      this.recordTurnMetrics(sessionId, {
        turnIndex,
        llmMs,
        stateMs,
        totalMs,
        confidence,
        intent: llmResult.intent,
        intentConfidence: llmResult.confidence,
        hasToolCalls: !!llmResult.tool_calls?.length,
        bargeInDetected: false // Will be set by STT service
      });

      // Step 5: Handle State Machine Actions
      await this.handleStateMachineActions(session, newSnapshot);

      const result = {
        sessionId,
        intent: llmResult.intent,
        confidence: llmResult.confidence,
        response: responseText,
        entities: llmResult.entities,
        bookingData: enrichedBookingData,
        state: newSnapshot.value,
        context: newSnapshot.context,
        tool_calls: llmResult.tool_calls,
        tool_results: llmResult.tool_results,
        processingTime: {
          llm: llmMs,
          state: stateMs,
          total: totalMs
        },
        turnIndex,
        callId
      };

      console.log('✅ Enhanced Turn Complete:', {
        sessionId,
        intent: result.intent,
        state: result.state,
        totalMs,
        hasResponse: !!result.response
      });

      return result;

    } catch (error) {
      console.error('❌ Enhanced Turn Processing Error:', error);
      
      // Record error metrics
      this.recordTurnMetrics(sessionId, {
        turnIndex,
        totalMs: Date.now() - startTime,
        error: error.message
      });

      // Return fallback response
      return {
        sessionId,
        intent: 'error',
        confidence: 0.0,
        response: "I'm sorry, I'm having trouble processing that. Could you please repeat?",
        entities: {},
        bookingData: {},
        state: currentSnapshot?.value || 'error',
        context: currentSnapshot?.context || {},
        error: error.message,
        processingTime: { total: Date.now() - startTime },
        turnIndex,
        callId
      };
    }
  }

  /**
   * Handle barge-in detection
   */
  handleBargeIn(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    console.log('🔄 Barge-in detected:', sessionId);

    // Send barge-in event to state machine
    session.stateMachine.send({
      type: 'BARGE_IN',
      timestamp: Date.now()
    });

    // Record barge-in metric
    const metrics = this.performanceMetrics.get(sessionId);
    if (metrics) {
      metrics.bargeInCount = (metrics.bargeInCount || 0) + 1;
    }
  }

  /**
   * Handle conversation timeout
   */
  handleTimeout(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    console.log('⏰ Conversation timeout:', sessionId);

    session.stateMachine.send({
      type: 'TIMEOUT',
      timestamp: Date.now()
    });
  }

  /**
   * Handle speech events (start/end)
   */
  handleSpeechEvent(sessionId, eventType, data = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Update activity timestamp
    session.lastActivity = Date.now();

    // Record speech events for analytics
    const metrics = this.performanceMetrics.get(sessionId);
    if (metrics) {
      if (!metrics.speechEvents) metrics.speechEvents = [];
      metrics.speechEvents.push({
        type: eventType,
        timestamp: Date.now(),
        data
      });
    }
  }

  /**
   * Get current session state
   */
  getSessionState(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const snapshot = session.stateMachine.getSnapshot();
    return {
      sessionId,
      state: snapshot.value,
      context: snapshot.context,
      isEnhanced: session.isEnhanced,
      turnCount: session.turnCount,
      startTime: session.startTime,
      lastActivity: session.lastActivity
    };
  }

  /**
   * Get session performance metrics
   */
  getSessionMetrics(sessionId) {
    return this.performanceMetrics.get(sessionId) || null;
  }

  /**
   * Finalize and cleanup session
   */
  finalizeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    console.log('🏁 Finalizing Enhanced Session:', sessionId);

    // Stop state machine
    session.stateMachine.stop();

    // Generate final metrics
    const metrics = this.generateFinalMetrics(sessionId);

    // Clear LLM session
    this.getLLMService().clearSession(sessionId);

    // Cleanup
    this.activeSessions.delete(sessionId);
    this.performanceMetrics.delete(sessionId);

    return metrics;
  }

  /**
   * Private: Initialize performance tracking for session
   */
  initializePerformanceTracking(sessionId) {
    this.performanceMetrics.set(sessionId, {
      sessionId,
      startTime: Date.now(),
      turns: [],
      bargeInCount: 0,
      speechEvents: [],
      stateTransitions: []
    });
  }

  /**
   * Private: Record turn-level metrics
   */
  recordTurnMetrics(sessionId, turnMetrics) {
    const metrics = this.performanceMetrics.get(sessionId);
    if (metrics) {
      metrics.turns.push({
        ...turnMetrics,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Private: Log state transitions
   */
  logStateTransition(sessionId, state) {
    console.log(`🔄 State Transition [${sessionId}]:`, {
      state: state.value,
      hasService: !!state.context.service,
      hasTime: !!state.context.timeWindow,
      hasContact: !!state.context.contact,
      hasLocation: !!state.context.locationKind
    });

    // Record state transition
    const metrics = this.performanceMetrics.get(sessionId);
    if (metrics) {
      metrics.stateTransitions.push({
        state: state.value,
        context: {
          service: state.context.service,
          timeWindow: state.context.timeWindow,
          contact: state.context.contact,
          locationKind: state.context.locationKind,
          confirmationAttempts: state.context.confirmationAttempts
        },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Private: Handle state machine side effects
   */
  async handleStateMachineActions(session, snapshot) {
    const context = snapshot.context;
    
    // Handle escalation states
    if (snapshot.matches('escalateToHuman') || snapshot.matches('callbackScheduled')) {
      console.log('📞 Escalation triggered:', {
        sessionId: session.sessionId,
        reason: context.escalationReason,
        state: snapshot.value
      });
      
      // Could integrate with CRM or ticketing system here
    }

    // Handle successful booking
    if (snapshot.matches('bookingSuccess')) {
      console.log('✅ Booking successful:', {
        sessionId: session.sessionId,
        service: context.service,
        timeWindow: context.timeWindow,
        contact: context.contact
      });
      
      // Could send confirmation emails/SMS here
    }

    // Handle conversation completion
    if (snapshot.matches('conversationComplete')) {
      console.log('🏁 Conversation complete:', {
        sessionId: session.sessionId,
        finalState: snapshot.value
      });
    }
  }

  /**
   * Private: Generate final session metrics
   */
  generateFinalMetrics(sessionId) {
    const session = this.activeSessions.get(sessionId);
    const metrics = this.performanceMetrics.get(sessionId);
    
    if (!session || !metrics) return null;

    const duration = Date.now() - session.startTime;
    const turns = metrics.turns || [];
    
    const avgTurnLatency = turns.length > 0 
      ? turns.reduce((sum, turn) => sum + (turn.totalMs || 0), 0) / turns.length 
      : 0;
    
    const maxTurnLatency = turns.length > 0 
      ? Math.max(...turns.map(turn => turn.totalMs || 0))
      : 0;

    return {
      sessionId,
      duration,
      turnCount: session.turnCount,
      avgTurnLatency: Math.round(avgTurnLatency),
      maxTurnLatency,
      bargeInCount: metrics.bargeInCount || 0,
      stateTransitionCount: metrics.stateTransitions?.length || 0,
      finalState: session.stateMachine.getSnapshot().value,
      wasSuccessful: session.stateMachine.getSnapshot().matches('bookingSuccess'),
      wasEscalated: session.stateMachine.getSnapshot().matches(['escalateToHuman', 'callbackScheduled']),
      enhancedFeatures: session.isEnhanced
    };
  }

  /**
   * Process a turn with fallback logic when enhanced features are not available
   */
  async processTurnFallback(sessionId, transcript, confidence, callId = null, turnIndex = 0) {
    const startTime = Date.now();
    const session = this.activeSessions.get(sessionId);
    
    try {
      console.log('🔄 Fallback Turn Processing:', {
        sessionId,
        transcript: transcript.substring(0, 50),
        turnIndex,
        confidence
      });

      // Update session activity
      session.lastActivity = Date.now();
      session.turnCount++;

      // Simple fallback response
      const responseText = "I'm sorry, I'm experiencing technical difficulties with my enhanced features. Please call back later or contact us directly.";

      const result = {
        sessionId,
        intent: 'fallback',
        confidence: 0.0,
        response: responseText,
        entities: {},
        bookingData: {},
        state: 'fallback',
        context: { error: 'Enhanced features unavailable' },
        processingTime: { total: Date.now() - startTime },
        turnIndex,
        callId
      };

      // Record metrics
      this.recordTurnMetrics(sessionId, {
        turnIndex,
        totalMs: Date.now() - startTime,
        confidence,
        intent: 'fallback',
        error: 'Enhanced features unavailable'
      });

      return result;

    } catch (error) {
      console.error('❌ Fallback turn processing failed:', error);
      
      return {
        sessionId,
        intent: 'error',
        confidence: 0.0,
        response: "I'm sorry, I'm having technical difficulties. Please call back later.",
        entities: {},
        bookingData: {},
        state: 'error',
        context: { error: error.message },
        processingTime: { total: Date.now() - startTime },
        turnIndex,
        callId
      };
    }
  }

  /**
   * Health check for the enhanced pipeline
   */
  healthCheck() {
    return {
      status: 'healthy',
      activeSessions: this.activeSessions.size,
      enhancedFeatures: this.options.enableEnhancedFeatures,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  EnhancedVoicePipeline
};