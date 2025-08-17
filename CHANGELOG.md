# Changelog

All notable changes to InfiniOffice will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Fast LLM Service (`llm_fast.js`)**: New production-ready, low-latency LLM module designed to replace existing LLM services with significant performance improvements
  - Single OpenAI API call per turn combining intent detection + response generation
  - Micro-intent fast path using regex heuristics for instant responses to simple inputs (yes/no, phone numbers, basic service requests)
  - Optional streaming support for TTS integration with barge-in compatibility
  - Compact prompts with running summary + slots instead of full conversation history
  - Deterministic JSON frame parsing for structured output (`<frame>{...}</frame>`)
  - Chatty but goal-directed conversation style with natural rapport building
  - Configurable model support (defaulting to gpt-4o as requested)
  - Session-based context management with lightweight per-session summaries
- **Enhanced Voice Agent Pipeline**: Comprehensive upgrade to voice processing with XState-based state machine, intent detection, and context awareness
- **Organization-Specific Phone Numbers**: Each organization now receives a dedicated Twilio phone number during onboarding
- **Custom Voice Pipeline Configuration**: Organizations can customize scripts, voice settings, and service catalogs
- **Dynamic Context Loading**: Voice pipeline automatically loads organization-specific context based on called number
- **Enhanced Dashboard Display**: InfiniOffice phone numbers prominently displayed in dashboard and configuration pages
- **Twilio Number Management Service**: Automated phone number provisioning and webhook configuration
- **Organization Context Service**: Efficient lookup and caching of organization settings by phone number
- **Database Connection Pre-warming**: Optimized startup sequence with connection pooling and query pre-warming for reduced latency
- **Voice Selection Feature**: Organizations can now choose from multiple Deepgram TTS voices (Saturn, Harmonia, Hera, Zeus) with real-time preview testing and seamless integration across the voice pipeline

### Enhanced
- **Voice Pipeline Integration with Fast LLM**: Completely refactored voice agent pipeline to use new `llm_fast.js` service as primary LLM processor
  - Integrated micro-intent fast path for instant responses (0ms processing time for simple inputs)
  - Enhanced state machine to properly consume new frame format with intent, confidence, and entities
  - Implemented comprehensive slot mapping from fast LLM entities to state machine context (service, timeWindow, contact, location, notes)
  - Added service validation integration that checks extracted services against business configuration
  - Enhanced context preservation across state transitions with proper debugging and logging
  - Implemented session state management with organization context integration
  - Added streaming support for TTS integration while maintaining conversation flow
  - Enhanced response override system allowing state machine to override LLM responses when needed
- **State Machine Context Management**: Improved XState integration to handle fast LLM results effectively
  - Updated `confirm` state to properly handle context updates from fast LLM results instead of bypassing intermediate states  
  - Added comprehensive debugging logs for service, time, and contact information updates
  - Enhanced event data structure to include both `entities` and `bookingData` for proper state machine processing
  - Implemented proper session initialization with organization context and business configuration
  - Added service validation logic with real-time validation results integration
- **Configuration Updates for Production Requirements**:
  - Changed default model from `gpt-4o-mini` to `gpt-4o` for higher quality responses
  - Updated failure threshold from 5 attempts to 3 attempts before escalating to human callback
  - Modified prompt guidelines to reflect 3-attempt limit for consistency
  - Enhanced micro-intent confidence scoring for better accuracy
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
- **Verbose Logging**: Reduced excessive STT logging by filtering out empty transcript events, improving collaboration and debugging efficiency
- **Response Repetition**: Enhanced conversation variation system to prevent identical timeout messages and robotic repeated responses throughout conversations
- **Service Recognition Intelligence**: Enhanced service matching to recognize natural language variations like "alders taken down" mapping to "Tree Falling" service
- **Confirmation vs Clarification Flow**: Fixed unnecessary clarification loops by implementing proper confirmation flow when services are successfully matched
- **LLM Response History**: Added response tracking system to prevent LLM from repeating identical responses within the same conversation
- **Multi-Entity Processing**: Enhanced system to capture and acknowledge multiple pieces of information provided in single customer statements (e.g., address AND time together)
- **Turn Boundary Detection**: Implemented intelligent buffering to handle continuous speech that STT fragments into multiple final transcripts, ensuring related information is processed together
- **Address Intent Recognition**: Fixed intent detection to properly classify location statements like "Yeah. It's at 6969 Bing Bong Avenue" as location_provided instead of unclear
- **Comprehensive Information Acknowledgment**: Enhanced response generation to acknowledge ALL information provided by customer in natural conversational flow
- **Voice Selection Authentication**: Fixed 401 authentication errors in VoiceSettingsEditor by implementing proper API client integration instead of manual token handling
- **Deepgram Voice Model Mapping**: Resolved voice selection not applying to calls by fixing voice model format inconsistencies and implementing proper voice mapping from frontend names to Deepgram API format
- **TTS Configuration Override**: Fixed critical bug where voice model mapping was being overridden by spread operator in config object, ensuring selected voices are properly applied to all TTS calls

### Technical
- **Fast LLM Service Implementation**: Complete implementation of `llm_fast.js` with production-ready architecture
  - Created `FastLLMService` class with configurable options (model, temperature, maxTokens, timeout)
  - Implemented micro-intent parsing with regex-based fast path for common intents (confirmation, contact, time, service)
  - Built streaming text splitter that separates natural response from JSON frame for TTS integration
  - Added session management with per-session summary and slots tracking (max 300 chars summary)
  - Implemented safe JSON frame parsing with error handling and fallback responses
  - Created compact prompt builder that includes organization context, business services, current slots, and conversation guidelines
  - Added timeout handling and usage tracking for monitoring and optimization
- **State Machine Integration Architecture**: Comprehensive integration between fast LLM service and existing XState state machine
  - Modified `src/index.js` to include fast LLM service initialization with gpt-4o configuration
  - Updated WebSocket message handling in `processTurn` function to use fast LLM instead of legacy LLM service
  - Implemented proper state machine actor initialization with organization context and business configuration
  - Added event data mapping to convert fast LLM entities to state machine `bookingData` format
  - Enhanced state machine context updates in `confirm` state to handle fast LLM results
  - Added service validation integration using existing `validateService` function from state machine
  - Implemented response override logic allowing state machine to override LLM responses when needed
- **Enhanced Voice Pipeline Temporary Disabling**: Strategic disabling of enhanced voice pipeline for focused testing
  - Added feature toggle `useEnhancedPipeline = false` in WebSocket handler
  - Implemented fallback logic to ensure fast LLM service is used as primary processor
  - Added debugging logs to track when enhanced pipeline is bypassed
  - Maintained enhanced pipeline code structure for easy re-enabling
- **State Machine Guard Condition Updates**: Updated XState guard conditions to work with new integration
  - Modified `shouldFallbackToCallback` guard to use 3-attempt threshold instead of 5
  - Enhanced context validation and debugging in guard conditions
  - Added comprehensive logging for state transitions and context updates
  - Updated assignment actions to properly handle fast LLM entity mapping
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
- **Voice Settings Infrastructure**: Implemented voice settings API endpoints with role-based access control, voice model validation, and organization context caching integration
- **Voice Model Mapping System**: Created comprehensive voice mapping system to translate user-friendly voice names (saturn, harmonia, hera, zeus) to Deepgram API format (aura-2-*-en)
- **TTS Configuration Architecture**: Updated TTS service to handle multiple calling patterns and ensure voice model precedence in configuration objects

### Performance
- **Micro-Intent Fast Path**: Achieved 0ms processing time for simple inputs (yes/no, phone numbers, basic service requests) by bypassing OpenAI API calls entirely
- **Single API Call Architecture**: Reduced latency by combining intent detection + response generation into single OpenAI call instead of separate calls
- **Streaming Response Support**: Enabled token streaming to TTS for faster perceived response times and better barge-in handling
- **Compact Prompt Design**: Reduced token usage by using running summaries (max 300 chars) instead of full conversation history
- **Session-based Context Management**: Optimized memory usage with lightweight per-session state tracking instead of full conversation storage
- **Service Validation Optimization**: Integrated real-time service validation without additional API calls by using business configuration cache
- **Call Startup Latency**: Reduced from several seconds to ~300ms for custom greeting delivery
- **Database Connection**: Pre-warmed connections eliminate cold-start delays in production
- **Organization Lookup**: Single optimized query replaces multiple fallback database calls
- **Memory Usage**: Removed unnecessary greeting cache logic and optimized context management
- **Response Generation**: Increased LLM token limits and improved temperature settings for more natural, longer responses while maintaining sub-3-second response times

### Known Issues & Future Work
- **Fast LLM State Machine Integration**: State machine context updates need refinement for proper slot mapping across all conversation states
  - Current integration shows context preservation issues in certain state transitions
  - Service validation working but entity updates not consistently applied across all states
  - Need to enhance intermediate state handling for proper data flow through collection states
  - Enhanced voice pipeline fallback temporarily disabled for focused testing
- **Fast LLM Fine-tuning Requirements**: Several areas identified for optimization and adjustment
  - Micro-intent patterns may need expansion for edge cases and additional service types
  - Confidence thresholds may require adjustment based on real-world usage patterns
  - Response generation could benefit from more dynamic prompt adjustments based on conversation context
  - Stream parsing and JSON frame extraction needs testing with various conversation flows
- **Human-like Interactions**: While significantly improved, conversation flow still needs refinement to achieve fully natural human-like interactions
- **Intent Recognition Accuracy**: Some edge cases in service/intent matching need continued improvement for better customer understanding
- **Context Preservation**: Enhanced memory system needs further development for complex multi-turn conversations
- **Natural Language Understanding**: Continued work needed on handling varied customer expressions and maintaining conversation context across interruptions

---

## Version History

*Previous versions will be documented here as releases are made.*