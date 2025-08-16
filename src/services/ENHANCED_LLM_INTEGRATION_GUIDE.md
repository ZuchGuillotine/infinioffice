# Enhanced LLM Integration Guide

This guide explains how to integrate and use the enhanced tool calling interface and LLM prompt system for your voice agent.

## Architecture Overview

The enhanced system consists of five main components:

1. **Tool Schemas & Executor** (`tools.js`) - Strict function schemas and execution logic
2. **Intent Detection** (`intentDetection.js`) - Enhanced intent recognition with location support
3. **Prompt System** (`promptSystem.js`) - Tenant-customizable prompts with ≤50 token responses
4. **Context Manager** (`contextManager.js`) - Session state, confirmations, and digression handling
5. **Enhanced LLM Service** (`enhancedLlm.js`) - Main orchestration service

## Quick Start

### Basic Usage

```javascript
const { createEnhancedLLMService } = require('./enhancedLlm');

// Create service instance with business context
const llmService = createEnhancedLLMService({
  organizationId: 'org-123',
  businessConfig: {
    services: [
      { name: 'Haircut', active: true, location_type: 'business_location' },
      { name: 'House Cleaning', active: true, location_type: 'customer_location' }
    ],
    scripts: {
      greeting: 'Hi! I'm here to help schedule your appointment.',
      service: 'What service do you need today?'
    }
  },
  organizationContext: {
    organizationName: 'SuperCuts Salon'
  }
});

// Process incoming speech
const result = await llmService.processMessage(
  "I need a haircut tomorrow at 2pm",
  [], // conversation history
  'call-123', // optional call ID
  1 // optional turn index
);

console.log(result.response); // "Great! I have you down for a haircut tomorrow at 2pm..."
console.log(result.tool_calls); // Tools that were executed
console.log(result.session_context); // Current session state
```

### Integration with Existing Code

To integrate with your current `llm.js`, replace the `processMessage` function:

```javascript
// Before (existing llm.js)
const result = await processMessage(transcript, sessionId, context, callId, turnIndex);

// After (enhanced system)
const { processMessage } = require('./enhancedLlm');
const result = await processMessage(transcript, sessionId, context, callId, turnIndex);
```

## Tool System

### Available Tools

The system provides 7 core tools:

1. **set_slot(name, value)** - Capture booking information
2. **request_slot(name)** - Ask for missing information
3. **confirm_slot(name, value, attempt_number)** - Three-strike confirmation
4. **validate_location(kind, address_or_branch_id)** - Location validation
5. **schedule_appointment()** - Create final booking
6. **escalate(kind, details)** - Human handoff
7. **fetch_business_fact(key)** - FAQ responses

### Tool Usage Examples

```javascript
// The LLM will automatically call tools based on user input
// User: "I need a haircut"
// Tool called: set_slot("service", "haircut")

// User: "123 Main Street"  
// Tools called: 
// - set_slot("location", "123 Main Street")
// - validate_location("address", "123 Main Street")

// User: "What are your hours?"
// Tool called: fetch_business_fact("hours")
```

## Location Handling

### Service Types

Configure services with location requirements:

```javascript
const businessConfig = {
  services: [
    {
      name: 'Haircut',
      location_type: 'business_location', // Customer comes to business
      active: true
    },
    {
      name: 'House Cleaning', 
      location_type: 'customer_location', // Service at customer location
      active: true
    },
    {
      name: 'Consultation',
      location_type: 'flexible', // Either location
      active: true
    }
  ]
};
```

### Location Flow

1. **Business Location Services**: No address collection needed
2. **Customer Location Services**: Always collect and validate address
3. **Flexible Services**: Ask for preference, then collect address if needed

### Location Validation

The system validates addresses with basic format checking. In production, integrate with geocoding APIs:

```javascript
// In tools.js, enhance validateLocation method:
async validateLocation(kind, addressOrBranchId) {
  if (kind === "address") {
    // Integrate with Google Maps, MapBox, etc.
    const isValid = await geocodingService.validate(addressOrBranchId);
    return { valid: isValid, normalized_address: result.formatted_address };
  }
  // ... rest of method
}
```

## Intent Detection Enhancement

### New Intent Types

The enhanced system adds location-specific intents:

- `location_provided` - "123 Main Street"
- `location_preference` - "at my house" / "I'll come to you"
- `digression_question` - "What are your hours?"
- `hours_inquiry` - Specific hours question
- `location_inquiry` - "Where are you located?"

### Confidence Scoring

```javascript
// Confidence levels guide system behavior:
// >0.8: Very clear intent, proceed confidently
// 0.6-0.8: Clear intent, may need light confirmation
// 0.4-0.6: Somewhat clear, ask for clarification
// <0.4: Unclear, increment retry counter
```

## Context Management

### Session State Tracking

```javascript
const contextManager = sessionManager.getSession(sessionId);

// Check booking progress
const progress = contextManager.getBookingProgress();
console.log(progress.completion_percentage); // 75%
console.log(progress.next_required_slot); // "contact"
console.log(progress.is_ready_to_book); // false

// Location state
const locationState = contextManager.getLocationState();
console.log(locationState.address); // "123 Main St"
console.log(locationState.validated); // true
console.log(locationState.preference); // "on_site"
```

### Confirmation Attempts

Three-strike confirmation logic automatically escalates:

```javascript
// First attempt: "Is that 123 Main Street?"
// Second attempt: "Let me confirm the address is 123 Main Street"  
// Third attempt: "I want to make sure - the address is 123 Main Street, correct?"
// After 3 failures: Escalate to human
```

### Digression Handling

```javascript
// User asks: "What are your hours?"
contextManager.pushDigression('hours_inquiry');
// System answers hours question
contextManager.popDigression();
// Returns to: "Now, what service did you need?"
```

## Tenant Customization

### Custom Scripts

```javascript
const businessConfig = {
  scripts: {
    greeting: "Welcome to {{orgName}}! How can I help you today?",
    service: "We offer {{serviceList}}. What interests you?",
    success: "Perfect! Your {{service}} is booked for {{time}}."
  }
};

// Scripts support variables:
// {{orgName}} - Organization name
// {{serviceList}} - Active services list  
// {{service}} - Selected service
// {{time}} - Selected time
```

### Organization Context

```javascript
const organizationContext = {
  organizationName: 'SuperCuts Salon',
  timezone: 'America/New_York',
  businessType: 'salon'
};
```

## Response Generation

### Token Limits

Responses are kept ≤50 tokens unless:
- Summarizing full booking details
- Providing business information (hours, location)
- Handling complex confirmations

### Template Responses

```javascript
// Quick fallback responses
const templates = {
  greeting: "Hi! How can I help you schedule an appointment?",
  service_request: "What service do you need?",
  time_request: "When works best for you?",
  contact_request: "I'll need your name and phone number.",
  success: "Your appointment is confirmed!"
};
```

## Error Handling & Escalation

### Automatic Escalation Triggers

1. **Three failed confirmations** for any slot
2. **Five unclear responses** in a row
3. **Technical errors** (API failures, validation errors)
4. **Session timeout** (30 minutes)
5. **Max digression depth** (3 levels)

### Escalation Types

```javascript
// Callback - Schedule human callback
escalate('callback', 'Customer needs help with service selection');

// Transfer - Immediate human transfer  
escalate('transfer', 'Customer requested to speak to someone');

// Voicemail - Route to voicemail
escalate('voicemail', 'After hours escalation');
```

## Performance Considerations

### Response Times

- Intent detection: ~200-500ms
- Tool execution: ~50-200ms
- Response generation: ~300-800ms
- **Total target**: <2 seconds for complete processing

### Optimization Tips

1. **Pre-warm OpenAI connections**
2. **Cache business configurations**
3. **Use streaming for longer responses**
4. **Batch tool executions when possible**

## Migration from Existing System

### Step-by-Step Migration

1. **Install enhanced services** alongside existing `llm.js`
2. **Configure business context** in database/config
3. **Update webhook handler** to use enhanced service
4. **Test with sample conversations**
5. **Gradually roll out** with feature flags

### Backwards Compatibility

The enhanced system maintains compatibility with existing APIs:

```javascript
// Existing code continues to work
const result = await processMessage(transcript, sessionId, context);

// Enhanced features available with new service
const service = createEnhancedLLMService(context);
const enhancedResult = await service.processMessage(transcript);
```

## Testing

### Unit Testing

```javascript
const { ToolExecutor } = require('./tools');

test('set_slot captures service correctly', async () => {
  const executor = new ToolExecutor();
  const result = await executor.executeTool('set_slot', {
    name: 'service',
    value: 'haircut'
  });
  expect(result.success).toBe(true);
  expect(result.slot).toBe('service');
});
```

### Integration Testing

```javascript
test('complete booking flow', async () => {
  const service = createEnhancedLLMService(testConfig);
  
  // Service selection
  let result = await service.processMessage("I need a haircut");
  expect(result.intent).toBe('service_provided');
  
  // Time selection  
  result = await service.processMessage("tomorrow at 2pm");
  expect(result.intent).toBe('time_provided');
  
  // Contact info
  result = await service.processMessage("John Smith 555-1234");
  expect(result.intent).toBe('contact_provided');
  
  // Confirmation
  result = await service.processMessage("yes");
  expect(result.tool_calls).toContainEqual(
    expect.objectContaining({
      function: expect.objectContaining({
        name: 'schedule_appointment'
      })
    })
  );
});
```

## Monitoring & Analytics

### Session Metrics

```javascript
const sessionContext = service.getSessionContext();
console.log({
  completion_percentage: sessionContext.progress.completion_percentage,
  conversation_phase: sessionContext.conversation_phase,
  tool_calls_count: sessionContext.tool_calls_count,
  escalation_flags: sessionContext.escalation_flags.length
});
```

### Business Intelligence

Track key metrics:
- Booking completion rate
- Average conversation length
- Common escalation reasons
- Service selection patterns
- Location preference trends

This enhanced system provides a robust foundation for location-aware, tenant-customizable voice booking while maintaining the performance and reliability requirements for production use.