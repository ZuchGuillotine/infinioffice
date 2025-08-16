# Changelog

All notable changes to InfiniOffice will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Enhanced Voice Agent Pipeline**: Comprehensive upgrade to voice processing with XState-based state machine, intent detection, and context awareness
- **Organization-Specific Phone Numbers**: Each organization now receives a dedicated Twilio phone number during onboarding
- **Custom Voice Pipeline Configuration**: Organizations can customize scripts, voice settings, and service catalogs
- **Dynamic Context Loading**: Voice pipeline automatically loads organization-specific context based on called number
- **Enhanced Dashboard Display**: InfiniOffice phone numbers prominently displayed in dashboard and configuration pages
- **Twilio Number Management Service**: Automated phone number provisioning and webhook configuration
- **Organization Context Service**: Efficient lookup and caching of organization settings by phone number
- **Database Connection Pre-warming**: Optimized startup sequence with connection pooling and query pre-warming for reduced latency

### Enhanced
- **Voice Agent Architecture**: Implemented enhanced voice pipeline with state machine management, progressive summarization, and digression handling
- **Call Startup Performance**: Eliminated default greeting cache logic, optimized database queries, and implemented immediate custom greeting delivery
- **LLM Intent Detection**: Now uses organization-specific service catalogs for improved accuracy with tool-based LLM integration
- **Response Generation**: Dynamic script templates based on organization configuration
- **Database Performance**: Optimized connection pooling (15 connections for production, 30 for development) with selective field queries
- **Organization Lookup**: Single-query organization retrieval with phone number variant matching instead of multiple fallback queries
- **Voice Pipeline**: Real-time organization context switching for multi-tenant support
- **Business Info Configuration**: Enhanced UI showing assigned phone number and organization settings
- **Natural Conversation Flow**: Transformed voice agent from robotic Q&A to natural, chatty interactions that sound like a helpful neighbor rather than a machine
- **Multi-Entity Recognition**: Enhanced intent detection to capture multiple pieces of information in a single customer statement (e.g., time AND location)
- **Contextual Timeout Responses**: Silence handling now provides helpful, context-aware responses based on conversation progress rather than generic prompts
- **Service Recognition Intelligence**: Improved service matching to handle natural language variations and prevent ambiguity loops with single-service offerings
- **Information Persistence**: Enhanced memory system to prevent re-requesting information already provided by customers

### Fixed
- **Critical Startup Infinite Loop**: Resolved infinite loop during application startup caused by circular dependency between enhanced voice services and database initialization. Implemented lazy loading pattern for enhanced voice pipeline to break circular import chain.
- **Custom Greeting Race Condition**: Fixed critical issue where organization-specific greetings were not being delivered to callers due to timing race condition between STT readiness, organization context loading, and stream initialization. Implemented multi-trigger greeting system with 3-second fallback guarantee.
- **STT Audio Streaming Issue**: Fixed critical bug where Deepgram STT connection was queuing audio data instead of streaming it due to undefined readyState property. Implemented custom connection ready flag to properly track Deepgram connection state.
- **OpenAI Function Calling Format Error**: Fixed "Missing required parameter: 'tools[0].type'" error by updating all TOOL_SCHEMAS entries in enhanced LLM service to include required `type: "function"` wrapper for OpenAI's function calling API.
- **Variable Reference Errors**: Fixed `enhancedResult is not defined` and `currentTurnId is not defined` errors in processTurn function by renaming variables and removing dead code references.
- **Critical Call Latency Issues**: Resolved extremely high latency on call startup by removing blocking default greeting logic and optimizing database connection flow
- **Custom Greeting Delivery**: Fixed issue where system sent generic default greeting instead of organization's custom greeting
- **Organization Context Loading**: Fixed critical issue where voice agent was loading "Default Organization" instead of user-specific organization context
- **Twilio WebSocket Parameter Passing**: Implemented proper parameter passing from Twilio webhook to WebSocket handler using Stream custom parameters and callStore fallback
- **Custom Script Application**: Voice agents now correctly apply organization-specific greetings, services, and conversation scripts
- **Fallback Behavior**: Reduced aggressive fallback triggers, allowing LLM more attempts to understand user intent before reverting to callback
- **Service Validation**: Enhanced fuzzy matching for service recognition with organization-specific service catalogs
- **Voice Agent Persistence**: Improved context preservation across conversation turns to maintain organization-specific settings
- **Critical Intent Detection Error**: Fixed "Cannot read properties of null (reading 'entities')" error that was breaking conversation flow by adding proper null checks and safety guards
- **Unnatural Timeout Interruptions**: Fixed robotic "I'm still here" responses interrupting conversations by extending silence timeout from 5 to 12 seconds and making timeout responses contextual and friendly
- **Service Ambiguity Issues**: Resolved confusion where agent couldn't distinguish "Quote or Bid" as a single service, causing infinite clarification loops
- **Information Re-requesting**: Fixed issue where agent would repeatedly ask for time, date, or address information that customers had already provided
- **Robotic Conversation Flow**: Completely overhauled conversation style from rigid Q&A to natural, chatty interactions that acknowledge customer details and build rapport

### Technical
- **Circular Dependency Resolution**: Refactored enhanced voice pipeline imports in `src/index.js` to use lazy loading pattern. Replaced immediate instantiation with `getEnhancedServices()`, `getEnhancedVoicePipeline()`, and `getGlobalEnhancedVoicePipeline()` functions to break circular import chain at module load time.
- **Greeting System Redesign**: Replaced complex conditional greeting logic with simplified `tryToSendGreeting()` function. Added multiple trigger points (stream start, STT ready, context loaded) plus 3-second timeout fallback to guarantee greeting delivery.
- **Enhanced Voice Pipeline Services**: Added `enhancedVoicePipeline.js`, `enhancedStateMachine.js`, `enhancedLlm.js`, `contextManager.js`, `intentDetection.js`, `promptSystem.js`, and `tools.js`
- **Database Optimization**: Implemented connection pre-warming, optimized connection pooling, and selective field queries for faster organization lookups
- **Call Flow Optimization**: Restructured greeting delivery to wait for organization context instead of sending default greeting immediately
- **Voice Agent State Management**: Integrated XState for deterministic conversation flow with context preservation
- **Enhanced Configuration**: Added voice agent feature toggles and configuration management through `config/enhancedVoice.js`
- Added `twilioNumber` field to Organization model with unique constraint
- Extended BusinessConfig with `scripts`, `rules`, and `voiceSettings` JSON fields
- Implemented organization lookup by Twilio phone number in WebSocket handler
- Created mock number provisioning for development/testing environments
- Added comprehensive integration testing for organization-specific functionality
- Fixed Twilio Stream TwiML generation to properly pass custom parameters
- Implemented in-memory callStore as fallback mechanism for call parameter retrieval
- Enhanced phone number normalization for reliable organization context lookups
- Added cache invalidation triggers for real-time organization configuration updates

### Performance
- **Call Startup Latency**: Reduced from several seconds to ~300ms for custom greeting delivery
- **Database Connection**: Pre-warmed connections eliminate cold-start delays in production
- **Organization Lookup**: Single optimized query replaces multiple fallback database calls
- **Memory Usage**: Removed unnecessary greeting cache logic and optimized context management
- **Response Generation**: Increased LLM token limits and improved temperature settings for more natural, longer responses while maintaining sub-3-second response times

### Known Issues & Future Work
- **Human-like Interactions**: While significantly improved, conversation flow still needs refinement to achieve fully natural human-like interactions
- **Intent Recognition Accuracy**: Some edge cases in service/intent matching need continued improvement for better customer understanding
- **Context Preservation**: Enhanced memory system needs further development for complex multi-turn conversations
- **Natural Language Understanding**: Continued work needed on handling varied customer expressions and maintaining conversation context across interruptions

---

## Version History

*Previous versions will be documented here as releases are made.*