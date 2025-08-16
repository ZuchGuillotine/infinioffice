/**
 * Enhanced Tool Calling Interface for Voice Agent
 * Supports location capture, tenant customization, and MVP requirements
 */

// Tool schemas for OpenAI function calling
const TOOL_SCHEMAS = {
  set_slot: {
    name: "set_slot",
    description: "Set a booking slot with extracted value",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["service", "time_window", "contact", "location", "location_preference"]
        },
        value: {
          type: "string",
          description: "The extracted value for the slot"
        }
      },
      required: ["name", "value"]
    }
  },

  request_slot: {
    name: "request_slot", 
    description: "Request a missing slot from the user",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["service", "time_window", "contact", "location", "location_preference"]
        }
      },
      required: ["name"]
    }
  },

  confirm_slot: {
    name: "confirm_slot",
    description: "Confirm a slot value with the user (three-strike logic)",
    parameters: {
      type: "object", 
      properties: {
        name: {
          type: "string",
          enum: ["service", "time_window", "contact", "location", "all_details"]
        },
        value: {
          type: "string",
          description: "The value to confirm"
        },
        attempt_number: {
          type: "integer",
          minimum: 1,
          maximum: 3,
          description: "Current confirmation attempt (1-3)"
        }
      },
      required: ["name", "value", "attempt_number"]
    }
  },

  validate_location: {
    name: "validate_location",
    description: "Validate location information (address or branch selection)",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string", 
          enum: ["address", "branch_id"],
          description: "Type of location validation"
        },
        address_or_branch_id: {
          type: "string",
          description: "Address string or branch identifier"
        }
      },
      required: ["kind", "address_or_branch_id"]
    }
  },

  schedule_appointment: {
    name: "schedule_appointment",
    description: "Create appointment with full location and booking details",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string" },
        time_window: { type: "string" },
        contact: { type: "string" },
        location: { 
          type: "string",
          description: "Customer location (address or branch selection)"
        },
        location_preference: {
          type: "string",
          enum: ["on_site", "at_business", "remote"],
          description: "Where service should be performed"
        },
        notes: { 
          type: "string",
          description: "Additional booking notes"
        }
      },
      required: ["service", "time_window", "contact"]
    }
  },

  escalate: {
    name: "escalate",
    description: "Escalate to human or callback with reason",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["callback", "transfer", "voicemail"],
          description: "Type of escalation"
        },
        details: {
          type: "string",
          description: "Reason for escalation and captured context"
        }
      },
      required: ["kind", "details"]
    }
  },

  fetch_business_fact: {
    name: "fetch_business_fact",
    description: "Get business information for FAQ responses",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: ["hours", "location", "services", "contact", "parking", "policies"],
          description: "Type of business information requested"
        }
      },
      required: ["key"]
    }
  }
};

// Tool execution functions
class ToolExecutor {
  constructor(context = {}) {
    this.context = context;
    this.slots = context.slots || {};
    this.confirmationAttempts = context.confirmationAttempts || {};
    this.digressionStack = context.digressionStack || [];
  }

  async executeTools(toolCalls) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
        results.push({
          tool_call_id: toolCall.id,
          result: result
        });
      } catch (error) {
        console.error(`Tool execution error for ${toolCall.function.name}:`, error);
        results.push({
          tool_call_id: toolCall.id,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'set_slot':
        return this.setSlot(args.name, args.value);
      
      case 'request_slot':
        return this.requestSlot(args.name);
      
      case 'confirm_slot':
        return this.confirmSlot(args.name, args.value, args.attempt_number);
      
      case 'validate_location':
        return this.validateLocation(args.kind, args.address_or_branch_id);
      
      case 'schedule_appointment':
        return this.scheduleAppointment(args);
      
      case 'escalate':
        return this.escalate(args.kind, args.details);
      
      case 'fetch_business_fact':
        return this.fetchBusinessFact(args.key);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  setSlot(name, value) {
    this.slots[name] = value;
    
    // Reset confirmation attempts for this slot
    if (this.confirmationAttempts[name]) {
      delete this.confirmationAttempts[name];
    }
    
    console.log(`✅ Slot set: ${name} = "${value}"`);
    
    return {
      success: true,
      slot: name,
      value: value,
      message: `Captured ${name}: ${value}`
    };
  }

  requestSlot(name) {
    const prompts = {
      service: this.context.businessConfig?.scripts?.service || 
        `What type of service do you need today? We offer ${this.getServiceList()}.`,
      time_window: this.context.businessConfig?.scripts?.timeWindow ||
        "When would you like to schedule this appointment?",
      contact: this.context.businessConfig?.scripts?.contact ||
        "I'll need your name and phone number to complete the booking.",
      location: "What's the address where you need this service?",
      location_preference: "Would you prefer this service at your location or would you like to come to our business?"
    };

    console.log(`🔍 Requesting slot: ${name}`);
    
    return {
      success: true,
      slot: name,
      prompt: prompts[name] || `Could you provide your ${name}?`,
      message: `Requesting ${name} from user`
    };
  }

  confirmSlot(name, value, attemptNumber) {
    // Track confirmation attempts
    if (!this.confirmationAttempts[name]) {
      this.confirmationAttempts[name] = 0;
    }
    this.confirmationAttempts[name] = attemptNumber;

    const confirmationPrompts = {
      service: `Just to confirm, you need ${value}?`,
      time_window: `So that's ${value} - is that correct?`, 
      contact: `I have your contact as ${value}. Is that right?`,
      location: `The address is ${value} - correct?`,
      all_details: `Let me confirm everything: ${this.formatAllDetails()} - is this all correct?`
    };

    const escalationThreshold = 3;
    if (attemptNumber >= escalationThreshold) {
      return {
        success: false,
        slot: name,
        escalate: true,
        message: `Failed to confirm ${name} after ${attemptNumber} attempts`
      };
    }

    console.log(`❓ Confirming slot: ${name} = "${value}" (attempt ${attemptNumber})`);

    return {
      success: true,
      slot: name,
      value: value,
      attempt: attemptNumber,
      prompt: confirmationPrompts[name] || `Is ${value} correct?`,
      message: `Confirming ${name} (attempt ${attemptNumber})`
    };
  }

  async validateLocation(kind, addressOrBranchId) {
    console.log(`📍 Validating location: ${kind} = "${addressOrBranchId}"`);
    
    if (kind === "branch_id") {
      // Validate against business config branches
      const branches = this.context.businessConfig?.branches || [];
      const isValid = branches.some(branch => branch.id === addressOrBranchId);
      
      return {
        success: true,
        valid: isValid,
        kind: kind,
        value: addressOrBranchId,
        message: isValid ? "Valid branch selected" : "Invalid branch ID"
      };
    }
    
    if (kind === "address") {
      // Basic address validation (in production, use geocoding API)
      const hasStreetNumber = /\d+/.test(addressOrBranchId);
      const hasStreetName = addressOrBranchId.split(' ').length >= 2;
      const isValid = hasStreetNumber && hasStreetName;
      
      return {
        success: true,
        valid: isValid,
        kind: kind,
        value: addressOrBranchId,
        message: isValid ? "Address format appears valid" : "Address may be incomplete"
      };
    }
    
    return {
      success: false,
      error: `Unknown location validation kind: ${kind}`
    };
  }

  async scheduleAppointment(appointmentData) {
    console.log(`📅 Scheduling appointment:`, appointmentData);
    
    try {
      const { createAppointment } = require('./db');
      
      // Validate required data
      const requiredFields = ['service', 'time_window', 'contact'];
      const missing = requiredFields.filter(field => !appointmentData[field]);
      
      if (missing.length > 0) {
        return {
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        };
      }

      // Create appointment record
      const appointment = await createAppointment({
        organizationId: this.context.organizationId || process.env.DEFAULT_ORG_ID,
        service: appointmentData.service,
        contactPhone: this.extractPhoneNumber(appointmentData.contact),
        notes: this.formatAppointmentNotes(appointmentData),
        status: 'scheduled',
        startAt: this.parseDateTime(appointmentData.time_window),
        endAt: this.addHour(this.parseDateTime(appointmentData.time_window))
      });

      return {
        success: true,
        appointment_id: appointment.id,
        message: "Appointment successfully scheduled",
        confirmation: this.formatConfirmation(appointmentData)
      };
      
    } catch (error) {
      console.error('Appointment scheduling error:', error);
      return {
        success: false,
        error: error.message,
        fallback_required: true
      };
    }
  }

  escalate(kind, details) {
    console.log(`🚨 Escalating: ${kind} - ${details}`);
    
    const escalationMessages = {
      callback: "I'll have someone call you back within the hour to complete your booking.",
      transfer: "Let me transfer you to someone who can help you right away.",
      voicemail: "I'll connect you to our voicemail system."
    };

    // Store escalation context for follow-up
    this.context.escalation = {
      kind: kind,
      details: details,
      timestamp: new Date().toISOString(),
      capturedSlots: { ...this.slots }
    };

    return {
      success: true,
      escalation_type: kind,
      message: escalationMessages[kind] || "Escalating to human assistance",
      captured_context: this.slots
    };
  }

  fetchBusinessFact(key) {
    console.log(`📋 Fetching business fact: ${key}`);
    
    const businessConfig = this.context.businessConfig || {};
    
    const facts = {
      hours: this.formatBusinessHours(businessConfig.businessHours),
      location: businessConfig.address || "Please call us for our location details",
      services: this.getServiceList(),
      contact: businessConfig.phone || businessConfig.escalationNumber || "Please call our main number",
      parking: businessConfig.parking || "Parking information available when you call",
      policies: businessConfig.policies || "Please call for information about our policies"
    };

    return {
      success: true,
      key: key,
      value: facts[key] || "Information not available",
      message: `Retrieved ${key} information`
    };
  }

  // Helper methods
  getServiceList() {
    const services = this.context.businessConfig?.services || [];
    const activeServices = services.filter(s => s.active).map(s => s.name);
    return activeServices.length > 0 ? activeServices.slice(0, 3).join(', ') : 'general appointments';
  }

  formatAllDetails() {
    return Object.entries(this.slots)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  formatAppointmentNotes(data) {
    const parts = [
      `Service: ${data.service}`,
      `Time: ${data.time_window}`, 
      `Contact: ${data.contact}`
    ];
    
    if (data.location) parts.push(`Location: ${data.location}`);
    if (data.location_preference) parts.push(`Preference: ${data.location_preference}`);
    if (data.notes) parts.push(`Notes: ${data.notes}`);
    
    return parts.join(', ');
  }

  formatConfirmation(data) {
    return `Your ${data.service} appointment is confirmed for ${data.time_window}. Contact: ${data.contact}`;
  }

  formatBusinessHours(hours) {
    if (!hours) return "Please call for our current hours";
    // Format business hours object into readable string
    return "Monday-Friday 9AM-5PM, Saturday 9AM-2PM"; // Simplified example
  }

  extractPhoneNumber(contact) {
    const phoneMatch = contact?.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    return phoneMatch ? phoneMatch[0] : null;
  }

  parseDateTime(timeString) {
    // Simplified date parsing - use proper library in production
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  }

  addHour(date) {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + 1);
    return newDate;
  }
}

module.exports = {
  TOOL_SCHEMAS,
  ToolExecutor
};