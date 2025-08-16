/**
 * Example: Enhanced LLM Service Integration
 * Demonstrates location-aware booking with tool calling
 */

const { createEnhancedLLMService } = require('../src/services/enhancedLlm');

// Example business configuration
const businessConfig = {
  services: [
    {
      name: 'Haircut',
      active: true,
      location_type: 'business_location',
      duration: 60,
      category: 'hair'
    },
    {
      name: 'House Cleaning',
      active: true,
      location_type: 'customer_location',
      duration: 120,
      category: 'cleaning'
    },
    {
      name: 'Consultation',
      active: true,
      location_type: 'flexible',
      duration: 30,
      category: 'general'
    }
  ],
  scripts: {
    greeting: "Hi! I'm here to help you schedule with {{orgName}}. What service do you need?",
    service: "We offer {{serviceList}}. Which one interests you?",
    timeWindow: "When would work best for your {{service}}?",
    contact: "Great! I'll need your name and phone number to book your {{service}}.",
    success: "Perfect! Your {{service}} is confirmed for {{time}}. You'll get a confirmation text."
  },
  businessHours: {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '09:00', close: '14:00' },
    sunday: { closed: true }
  }
};

const organizationContext = {
  organizationName: 'SuperCuts & Clean',
  organizationId: 'org-demo-123'
};

async function runBookingExample() {
  console.log('🚀 Enhanced LLM Service Example\n');

  // Create enhanced LLM service
  const service = createEnhancedLLMService({
    businessConfig,
    organizationContext,
    sessionId: 'demo-session-123'
  });

  console.log('📞 Simulating Voice Conversation\n');

  // Conversation flow examples
  const conversations = [
    {
      name: 'Business Location Service (Haircut)',
      turns: [
        "Hi, I need a haircut",
        "tomorrow at 2pm", 
        "John Smith, 555-1234",
        "yes, that's correct"
      ]
    },
    {
      name: 'Customer Location Service (House Cleaning)',
      turns: [
        "I need house cleaning",
        "this Friday morning",
        "123 Oak Street, apartment 4B",
        "Jane Doe, 555-5678", 
        "yes, book it"
      ]
    },
    {
      name: 'FAQ Digression',
      turns: [
        "What are your hours?",
        "I'd like to book a consultation",
        "next Monday at 10am",
        "Bob Johnson, 555-9999",
        "actually, can I come to your office instead?",
        "yes, that works"
      ]
    }
  ];

  for (const conversation of conversations) {
    console.log(`\n--- ${conversation.name} ---`);
    
    // Create fresh service for each conversation
    const convService = createEnhancedLLMService({
      businessConfig,
      organizationContext,
      sessionId: `demo-${Date.now()}`
    });

    const conversationHistory = [];

    for (let i = 0; i < conversation.turns.length; i++) {
      const userInput = conversation.turns[i];
      console.log(`\n👤 Customer: "${userInput}"`);

      try {
        const result = await convService.processMessage(
          userInput,
          conversationHistory,
          `call-demo-${Date.now()}`,
          i + 1
        );

        console.log(`🤖 Assistant: "${result.response}"`);
        console.log(`   Intent: ${result.intent} (${Math.round(result.confidence * 100)}%)`);
        
        if (result.tool_calls && result.tool_calls.length > 0) {
          console.log(`   Tools used: ${result.tool_calls.map(tc => tc.function.name).join(', ')}`);
        }

        const progress = convService.getBookingProgress();
        console.log(`   Progress: ${progress.completion_percentage}% complete`);

        // Add to conversation history
        conversationHistory.push(
          { role: 'user', content: userInput },
          { role: 'assistant', content: result.response }
        );

        // Show session state for interesting turns
        if (progress.is_ready_to_book || result.tool_calls?.length > 0) {
          const sessionContext = convService.getSessionContext();
          console.log(`   Session slots: ${JSON.stringify(sessionContext.context.slots, null, 2)}`);
        }

      } catch (error) {
        console.error(`❌ Error processing turn: ${error.message}`);
      }
    }

    // Show final session state
    const finalContext = convService.getSessionContext();
    console.log(`\n📊 Final Session State:`);
    console.log(`   Phase: ${finalContext.context.conversation_phase}`);
    console.log(`   Slots captured: ${Object.keys(finalContext.context.slots).length}`);
    console.log(`   Location required: ${finalContext.context.slots.service ? 
      convService.contextManager.requiresLocationCollection(finalContext.context.slots.service.value) : 'N/A'}`);
  }
}

async function runToolExamples() {
  console.log('\n\n🔧 Tool System Examples\n');

  const { ToolExecutor } = require('../src/services/tools');
  const executor = new ToolExecutor({
    businessConfig,
    organizationContext
  });

  // Example tool calls
  const toolExamples = [
    {
      name: 'set_slot',
      args: { name: 'service', value: 'haircut' }
    },
    {
      name: 'validate_location', 
      args: { kind: 'address', address_or_branch_id: '123 Main Street, Apt 2B' }
    },
    {
      name: 'fetch_business_fact',
      args: { key: 'hours' }
    },
    {
      name: 'confirm_slot',
      args: { name: 'service', value: 'house cleaning', attempt_number: 1 }
    }
  ];

  for (const example of toolExamples) {
    console.log(`\n🔨 Testing tool: ${example.name}`);
    console.log(`   Args: ${JSON.stringify(example.args)}`);
    
    try {
      const result = await executor.executeTool(example.name, example.args);
      console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      console.error(`   Error: ${error.message}`);
    }
  }
}

async function runIntentDetectionExamples() {
  console.log('\n\n🧠 Intent Detection Examples\n');

  const { ContextualIntentDetector } = require('../src/services/intentDetection');
  const detector = new ContextualIntentDetector({
    businessConfig,
    organizationContext,
    currentState: 'collecting',
    slots: { service: { value: 'haircut' } }
  });

  const testPhrases = [
    "I need a haircut",
    "tomorrow at 2pm",
    "123 Oak Street",
    "at my house please", 
    "John Smith 555-1234",
    "what are your hours?",
    "yes that's correct",
    "no, that's wrong",
    "let me speak to someone",
    "umm... I'm not sure"
  ];

  for (const phrase of testPhrases) {
    console.log(`\n📝 Testing phrase: "${phrase}"`);
    
    try {
      const result = await detector.detectContextualIntent(phrase, []);
      console.log(`   Intent: ${result.intent}`);
      console.log(`   Confidence: ${Math.round(result.confidence * 100)}%`);
      if (Object.keys(result.entities).length > 0) {
        console.log(`   Entities: ${JSON.stringify(result.entities)}`);
      }
      if (result.state_aligned) {
        console.log(`   ✅ Aligned with current state`);
      }
      if (result.state_mismatch) {
        console.log(`   ⚠️  Unexpected for current state`);
      }
    } catch (error) {
      console.error(`   Error: ${error.message}`);
    }
  }
}

// Run examples
async function main() {
  try {
    await runBookingExample();
    await runToolExamples();
    await runIntentDetectionExamples();
    
    console.log('\n✅ All examples completed successfully!');
    
    // Show session manager stats
    const { SessionManager } = require('../src/services/enhancedLlm');
    const sessionManager = SessionManager.getSessionManager();
    console.log(`\n📈 Session Manager Stats:`);
    console.log(`   Active sessions: ${sessionManager.getSessionCount()}`);
    console.log(`   Session IDs: ${sessionManager.getActiveSessions().join(', ')}`);
    
    // Cleanup
    SessionManager.shutdownSessions();
    console.log('\n🧹 Sessions cleaned up');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other files
module.exports = {
  runBookingExample,
  runToolExamples, 
  runIntentDetectionExamples,
  businessConfig,
  organizationContext
};

// Run if called directly
if (require.main === module) {
  main();
}