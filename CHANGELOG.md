# Changelog

All notable changes to InfiniOffice will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Organization-Specific Phone Numbers**: Each organization now receives a dedicated Twilio phone number during onboarding
- **Custom Voice Pipeline Configuration**: Organizations can customize scripts, voice settings, and service catalogs
- **Dynamic Context Loading**: Voice pipeline automatically loads organization-specific context based on called number
- **Enhanced Dashboard Display**: InfiniOffice phone numbers prominently displayed in dashboard and configuration pages
- **Twilio Number Management Service**: Automated phone number provisioning and webhook configuration
- **Organization Context Service**: Efficient lookup and caching of organization settings by phone number

### Enhanced
- **LLM Intent Detection**: Now uses organization-specific service catalogs for improved accuracy
- **Response Generation**: Dynamic script templates based on organization configuration
- **Database Schema**: Extended Organization and BusinessConfig models with phone number and customization fields
- **Voice Pipeline**: Real-time organization context switching for multi-tenant support
- **Business Info Configuration**: Enhanced UI showing assigned phone number and organization settings

### Fixed
- **Organization Context Loading**: Fixed critical issue where voice agent was loading "Default Organization" instead of user-specific organization context
- **Twilio WebSocket Parameter Passing**: Implemented proper parameter passing from Twilio webhook to WebSocket handler using Stream custom parameters and callStore fallback
- **Custom Script Application**: Voice agents now correctly apply organization-specific greetings, services, and conversation scripts
- **Fallback Behavior**: Reduced aggressive fallback triggers, allowing LLM more attempts to understand user intent before reverting to callback
- **Service Validation**: Enhanced fuzzy matching for service recognition with organization-specific service catalogs
- **Voice Agent Persistence**: Improved context preservation across conversation turns to maintain organization-specific settings

### Technical
- Added `twilioNumber` field to Organization model with unique constraint
- Extended BusinessConfig with `scripts`, `rules`, and `voiceSettings` JSON fields
- Implemented organization lookup by Twilio phone number in WebSocket handler
- Created mock number provisioning for development/testing environments
- Added comprehensive integration testing for organization-specific functionality
- Fixed Twilio Stream TwiML generation to properly pass custom parameters
- Implemented in-memory callStore as fallback mechanism for call parameter retrieval
- Enhanced phone number normalization for reliable organization context lookups
- Added cache invalidation triggers for real-time organization configuration updates

---

## Version History

*Previous versions will be documented here as releases are made.*