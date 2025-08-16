/**
 * Enhanced Context Management System
 * Handles location state, confirmation attempts, digressions, and session persistence
 */

class ContextManager {
  constructor(sessionId, initialContext = {}) {
    this.sessionId = sessionId;
    this.context = {
      // Core booking slots
      slots: {},
      
      // Location state tracking
      location_state: {
        address: null,
        branch_id: null,
        preference: null, // 'on_site', 'at_business', 'remote'
        validated: false,
        needs_clarification: false
      },
      
      // Confirmation attempt tracking per slot
      confirmation_attempts: {},
      
      // Digression management
      digression_stack: [],
      current_topic: 'booking',
      
      // Session state
      session_state: 'active',
      last_activity: new Date().toISOString(),
      retry_count: 0,
      escalation_flags: [],
      
      // Business context
      business_config: null,
      organization_context: null,
      
      // Conversation flow
      conversation_phase: 'greeting', // greeting, collecting, confirming, booking, completed
      expected_intent: null,
      last_successful_intent: null,
      
      ...initialContext
    };
    
    this.maxDigressionDepth = 3;
    this.maxConfirmationAttempts = 3;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  // Core slot management
  setSlot(name, value, confidence = 1.0) {
    this.context.slots[name] = {
      value: value,
      confidence: confidence,
      timestamp: new Date().toISOString(),
      validated: false
    };
    
    // Reset confirmation attempts for this slot
    if (this.context.confirmation_attempts[name]) {
      delete this.context.confirmation_attempts[name];
    }
    
    this.updateActivity();
    
    console.log(`📝 Slot set: ${name} = "${value}" (confidence: ${confidence})`);
    
    return this.context.slots[name];
  }

  getSlot(name) {
    return this.context.slots[name]?.value || null;
  }

  validateSlot(name, isValid) {
    if (this.context.slots[name]) {
      this.context.slots[name].validated = isValid;
      this.context.slots[name].validation_timestamp = new Date().toISOString();
    }
    return this.context.slots[name];
  }

  getAllSlots() {
    const slots = {};
    Object.keys(this.context.slots).forEach(key => {
      slots[key] = this.context.slots[key].value;
    });
    return slots;
  }

  // Location state management
  setLocation(address = null, branchId = null, preference = null) {
    this.context.location_state = {
      ...this.context.location_state,
      address: address,
      branch_id: branchId,
      preference: preference,
      validated: false,
      last_updated: new Date().toISOString()
    };
    
    // Also set in slots for compatibility
    if (address) this.setSlot('location', address);
    if (branchId) this.setSlot('branch_id', branchId);
    if (preference) this.setSlot('location_preference', preference);
    
    console.log(`📍 Location state updated:`, this.context.location_state);
    
    return this.context.location_state;
  }

  validateLocation(isValid, validationDetails = {}) {
    this.context.location_state.validated = isValid;
    this.context.location_state.validation_details = validationDetails;
    this.context.location_state.validation_timestamp = new Date().toISOString();
    
    return this.context.location_state;
  }

  getLocationState() {
    return this.context.location_state;
  }

  requiresLocationCollection(serviceName) {
    const businessConfig = this.context.business_config;
    if (!businessConfig || !serviceName) return false;
    
    const service = businessConfig.services?.find(s => 
      s.name.toLowerCase().includes(serviceName.toLowerCase())
    );
    
    return service?.location_type === 'customer_location' || 
           service?.location_type === 'flexible';
  }

  // Confirmation attempt tracking
  incrementConfirmationAttempt(slotName) {
    if (!this.context.confirmation_attempts[slotName]) {
      this.context.confirmation_attempts[slotName] = 0;
    }
    
    this.context.confirmation_attempts[slotName]++;
    
    const attempts = this.context.confirmation_attempts[slotName];
    const maxAttempts = this.maxConfirmationAttempts;
    
    console.log(`🔄 Confirmation attempt ${attempts}/${maxAttempts} for ${slotName}`);
    
    if (attempts >= maxAttempts) {
      this.flagForEscalation('max_confirmation_attempts', {
        slot: slotName,
        attempts: attempts
      });
      return { shouldEscalate: true, attempts: attempts };
    }
    
    return { shouldEscalate: false, attempts: attempts };
  }

  getConfirmationAttempts(slotName) {
    return this.context.confirmation_attempts[slotName] || 0;
  }

  resetConfirmationAttempts(slotName = null) {
    if (slotName) {
      delete this.context.confirmation_attempts[slotName];
    } else {
      this.context.confirmation_attempts = {};
    }
  }

  // Digression stack management
  pushDigression(topic, context = {}) {
    if (this.context.digression_stack.length >= this.maxDigressionDepth) {
      console.warn(`⚠️ Max digression depth reached, ignoring: ${topic}`);
      return false;
    }
    
    this.context.digression_stack.push({
      topic: topic,
      context: context,
      timestamp: new Date().toISOString(),
      previous_topic: this.context.current_topic
    });
    
    this.context.current_topic = topic;
    
    console.log(`🔀 Digression started: ${topic} (depth: ${this.context.digression_stack.length})`);
    
    return true;
  }

  popDigression() {
    if (this.context.digression_stack.length === 0) {
      return null;
    }
    
    const digression = this.context.digression_stack.pop();
    this.context.current_topic = digression.previous_topic || 'booking';
    
    console.log(`🔙 Returning from digression: ${digression.topic} -> ${this.context.current_topic}`);
    
    return digression;
  }

  getCurrentTopic() {
    return this.context.current_topic;
  }

  isInDigression() {
    return this.context.digression_stack.length > 0;
  }

  // Session state management
  updateActivity() {
    this.context.last_activity = new Date().toISOString();
  }

  isSessionExpired() {
    const lastActivity = new Date(this.context.last_activity);
    const now = new Date();
    return (now - lastActivity) > this.sessionTimeout;
  }

  setConversationPhase(phase) {
    const validPhases = ['greeting', 'collecting', 'confirming', 'booking', 'completed', 'escalated'];
    
    if (!validPhases.includes(phase)) {
      console.warn(`Invalid conversation phase: ${phase}`);
      return false;
    }
    
    const previousPhase = this.context.conversation_phase;
    this.context.conversation_phase = phase;
    this.context.phase_transition_timestamp = new Date().toISOString();
    
    console.log(`📈 Conversation phase: ${previousPhase} -> ${phase}`);
    
    return true;
  }

  getConversationPhase() {
    return this.context.conversation_phase;
  }

  // Escalation management
  flagForEscalation(reason, details = {}) {
    this.context.escalation_flags.push({
      reason: reason,
      details: details,
      timestamp: new Date().toISOString()
    });
    
    console.log(`🚨 Escalation flagged: ${reason}`, details);
  }

  shouldEscalate() {
    // Check for various escalation conditions
    const conditions = [
      this.context.escalation_flags.length > 0,
      this.context.retry_count >= 5,
      Object.values(this.context.confirmation_attempts).some(attempts => attempts >= this.maxConfirmationAttempts),
      this.context.digression_stack.length >= this.maxDigressionDepth,
      this.isSessionExpired()
    ];
    
    return conditions.some(condition => condition);
  }

  getEscalationContext() {
    return {
      flags: this.context.escalation_flags,
      retry_count: this.context.retry_count,
      confirmation_attempts: this.context.confirmation_attempts,
      captured_slots: this.getAllSlots(),
      session_duration: this.getSessionDuration(),
      conversation_phase: this.context.conversation_phase
    };
  }

  // Progress tracking
  getBookingProgress() {
    const requiredSlots = ['service', 'time_window', 'contact'];
    const optionalSlots = ['location', 'location_preference'];
    
    const completedRequired = requiredSlots.filter(slot => this.getSlot(slot));
    const completedOptional = optionalSlots.filter(slot => this.getSlot(slot));
    
    // Check if location is required for this service
    const serviceName = this.getSlot('service');
    const locationRequired = serviceName ? this.requiresLocationCollection(serviceName) : false;
    
    const actualRequired = locationRequired ? 
      [...requiredSlots, 'location'] : 
      requiredSlots;
    
    const actualCompleted = actualRequired.filter(slot => this.getSlot(slot));
    
    return {
      required_slots: actualRequired,
      completed_required: actualCompleted,
      completed_optional: completedOptional,
      completion_percentage: Math.round((actualCompleted.length / actualRequired.length) * 100),
      is_ready_to_book: actualCompleted.length === actualRequired.length,
      next_required_slot: actualRequired.find(slot => !this.getSlot(slot)),
      location_required: locationRequired
    };
  }

  // Context serialization for persistence
  serialize() {
    return {
      sessionId: this.sessionId,
      context: this.context,
      lastSerialized: new Date().toISOString()
    };
  }

  static deserialize(data) {
    const manager = new ContextManager(data.sessionId, data.context);
    return manager;
  }

  // Utility methods
  getSessionDuration() {
    const start = new Date(this.context.last_activity);
    const now = new Date();
    return Math.round((now - start) / 1000); // seconds
  }

  incrementRetryCount() {
    this.context.retry_count++;
    if (this.context.retry_count >= 5) {
      this.flagForEscalation('max_retries', { count: this.context.retry_count });
    }
    return this.context.retry_count;
  }

  resetRetryCount() {
    this.context.retry_count = 0;
  }

  // Debug and monitoring
  getDebugInfo() {
    return {
      sessionId: this.sessionId,
      slots: this.getAllSlots(),
      location_state: this.context.location_state,
      confirmation_attempts: this.context.confirmation_attempts,
      conversation_phase: this.context.conversation_phase,
      current_topic: this.context.current_topic,
      digression_depth: this.context.digression_stack.length,
      retry_count: this.context.retry_count,
      escalation_flags: this.context.escalation_flags.length,
      progress: this.getBookingProgress(),
      session_duration: this.getSessionDuration(),
      should_escalate: this.shouldEscalate()
    };
  }
}

// Session manager for multiple concurrent sessions
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // 5 minutes
  }

  getSession(sessionId, initialContext = {}) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new ContextManager(sessionId, initialContext));
    }
    return this.sessions.get(sessionId);
  }

  removeSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  cleanupExpiredSessions() {
    const expiredSessions = [];
    
    for (const [sessionId, contextManager] of this.sessions) {
      if (contextManager.isSessionExpired()) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => {
      console.log(`🧹 Cleaning up expired session: ${sessionId}`);
      this.removeSession(sessionId);
    });
    
    return expiredSessions.length;
  }

  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  getSessionCount() {
    return this.sessions.size;
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

module.exports = {
  ContextManager,
  SessionManager
};