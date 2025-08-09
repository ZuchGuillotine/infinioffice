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

### Technical
- Added `twilioNumber` field to Organization model with unique constraint
- Extended BusinessConfig with `scripts`, `rules`, and `voiceSettings` JSON fields
- Implemented organization lookup by Twilio phone number in WebSocket handler
- Created mock number provisioning for development/testing environments
- Added comprehensive integration testing for organization-specific functionality

---

## Version History

*Previous versions will be documented here as releases are made.*