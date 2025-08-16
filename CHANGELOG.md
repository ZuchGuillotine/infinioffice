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

### Fixed
- **Critical Call Latency Issues**: Resolved extremely high latency on call startup by removing blocking default greeting logic and optimizing database connection flow
- **Custom Greeting Delivery**: Fixed issue where system sent generic default greeting instead of organization's custom greeting
- **Organization Context Loading**: Fixed critical issue where voice agent was loading "Default Organization" instead of user-specific organization context
- **Twilio WebSocket Parameter Passing**: Implemented proper parameter passing from Twilio webhook to WebSocket handler using Stream custom parameters and callStore fallback
- **Custom Script Application**: Voice agents now correctly apply organization-specific greetings, services, and conversation scripts
- **Fallback Behavior**: Reduced aggressive fallback triggers, allowing LLM more attempts to understand user intent before reverting to callback
- **Service Validation**: Enhanced fuzzy matching for service recognition with organization-specific service catalogs
- **Voice Agent Persistence**: Improved context preservation across conversation turns to maintain organization-specific settings

### Technical
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

---

## Version History

*Previous versions will be documented here as releases are made.*