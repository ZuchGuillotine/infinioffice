# Frontend-Backend Integration Guide

## Overview

This document outlines the integration points between the React frontend and Node.js backend to ensure seamless development and deployment.

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Create new organization and admin user
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/verify` - Verify JWT token

### Organizations (`/api/organizations`)
- `GET /api/organizations` - Get organization details with config
- `PUT /api/organizations` - Update organization
- `GET /api/organizations/config` - Get business configuration
- `PUT /api/organizations/config` - Update business configuration
- `GET /api/organizations/integrations` - Get integrations
- `POST /api/organizations/integrations` - Create/update integration
- `DELETE /api/organizations/integrations/:type` - Delete integration

### Calls (`/api/calls`)
- `GET /api/calls` - Get call logs with pagination
- `GET /api/calls/:id` - Get specific call details
- `GET /api/calls/analytics/summary` - Get call analytics
- `GET /api/calls/analytics/performance` - Get performance metrics

### Voice (`/api/voice`)
- `POST /voice` - Twilio webhook for incoming calls
- `GET /api/voice/settings` - Get organization voice settings
- `POST /api/voice/settings` - Update voice model selection (requires admin/operator role)
- `POST /api/voice/test` - Test voice with custom text and selected model
- `GET /api/voice/available` - Get list of available voice options

## Data Models

### Organization
```javascript
{
  id: "uuid",
  name: "string",
  plan: "starter|professional|enterprise",
  smsBranding: "string?",
  createdAt: "datetime",
  updatedAt: "datetime"
}
```

### User
```javascript
{
  id: "uuid",
  organizationId: "uuid",
  email: "string",
  role: "admin|operator|viewer",
  googleId: "string?",
  createdAt: "datetime",
  updatedAt: "datetime"
}
```

### BusinessConfig
```javascript
{
  id: "uuid",
  organizationId: "uuid",
  businessHours: {
    monday: { start: "09:00", end: "17:00" },
    // ... other days
  },
  holidays: ["2025-12-25", "2025-01-01"],
  services: [
    { name: "Consultation", duration: 30 },
    { name: "Maintenance", duration: 60 }
  ],
  providers: ["Dr. Smith", "Dr. Johnson"],
  escalationNumber: "string?",
  smsCopy: "string?",
  greeting: "string?",
  timezone: "America/New_York",
  voiceSettings: {
    voiceModel: "saturn|harmonia|hera|zeus",
    speed: 1.0,
    pitch: 1.0,
    updatedAt: "datetime"
  }
}
```

### Call
```javascript
{
  id: "uuid",
  organizationId: "uuid",
  twilioCallSid: "string?",
  callerPhone: "string?",
  status: "in-progress|completed|failed",
  currentState: "string?",
  context: "object?",
  durationSeconds: "number?",
  totalTurns: "number?",
  transcript: "string?",
  recordingUrl: "string?",
  metadata: "object?",
  error: "string?",
  startedAt: "datetime?",
  endedAt: "datetime?",
  createdAt: "datetime",
  turns: Turn[]
}
```

## Authentication Flow

1. **Login/Register**: Frontend calls auth endpoints
2. **Token Storage**: Store JWT in localStorage or secure cookie
3. **API Calls**: Include `Authorization: Bearer <token>` header
4. **Token Refresh**: Implement automatic refresh before expiration

## Error Handling

### Standard Error Response
```javascript
{
  error: "Error message",
  code?: "ERROR_CODE",
  details?: {}
}
```

### Common Error Codes
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `422` - Validation error
- `500` - Internal server error

## Real-time Features

### WebSocket Connection
- Backend provides WebSocket endpoint for real-time updates
- Frontend connects for live call status updates
- Use for agent status, incoming calls, performance metrics

### Polling Fallback
- If WebSocket unavailable, fall back to polling
- Poll every 5-10 seconds for status updates

## Development Workflow

### Environment Setup
1. Backend runs on `localhost:3001`
2. Frontend runs on `localhost:3000`
3. Vite proxy handles API calls to backend
4. Shared environment variables for API keys

### API Development
1. Backend team implements endpoints first
2. Frontend team creates TypeScript interfaces
3. Use Postman/Insomnia for API testing
4. Document API changes in this guide

### Database Migrations
1. Backend team runs Prisma migrations
2. Frontend team updates TypeScript types
3. Coordinate schema changes between teams

## Testing Strategy

### Backend Testing
- Unit tests for services
- Integration tests for API endpoints
- E2E tests for voice pipeline

### Frontend Testing
- Unit tests for components
- Integration tests for API calls
- E2E tests for user flows

### Shared Testing
- API contract testing
- Performance testing
- Security testing

## Deployment

### Development
- Backend: `npm run dev` (port 3001)
- Frontend: `npm run dev` (port 3000)

### Production
- Backend: AWS App Runner
- Frontend: Static hosting (CloudFront/S3)
- Shared domain with subdomain routing

## Security Considerations

### Authentication
- JWT tokens with 24h expiration
- Secure token storage
- HTTPS only in production

### Authorization
- Role-based access control (RBAC)
- Organization-level data isolation
- API rate limiting

### Data Protection
- PII encryption at rest
- Secure API communication
- Audit logging for sensitive operations

## Performance Optimization

### Frontend
- React Query for caching
- Lazy loading for routes
- Bundle optimization

### Backend
- Database query optimization
- Redis caching for sessions
- Connection pooling

### API
- Pagination for large datasets
- Compression for responses
- CDN for static assets

## Monitoring & Observability

### Backend Metrics
- API response times
- Error rates
- Database performance
- Voice pipeline latency

### Frontend Metrics
- Page load times
- User interactions
- Error tracking
- Performance monitoring

### Shared Monitoring
- Uptime monitoring
- Alert notifications
- Log aggregation
- Performance dashboards

## Troubleshooting

### Common Issues
1. **CORS errors**: Check proxy configuration
2. **Authentication failures**: Verify JWT token
3. **Database connection**: Check environment variables
4. **WebSocket disconnects**: Implement reconnection logic

### Debug Tools
- Browser DevTools for frontend
- Postman for API testing
- Database GUI for data inspection
- Log aggregation for error tracking

## Future Enhancements

### P1 Features
- CRM integrations (HubSpot, Salesforce)
- Advanced analytics dashboard
- Multi-language support
- White-labeling

### P2 Features
- Mobile app (React Native)
- Advanced reporting
- Custom voice cloning
- Enterprise features

---

*This document should be updated as the integration evolves. Both teams should review and approve changes.*

---

**Last Updated**: August 2025 - Organization-specific voice pipeline and phone number integration added 

## Recommended Updates from Frontend Scaffolding

The new onboarding and configuration UIs surfaced a few concrete backend contract needs to enable a smooth pilot:

- Onboarding flows
  - POST `/api/telephony/setup-routing` – Given `businessPhone`, provision an application number and configure Twilio webhooks/routing behind the scenes; returns routing status.
  - POST `/api/calls/test` – Initiate a test outbound call to admin, play current greeting, record feedback; returns job id/status.
  - POST `/api/tts/preview` – Generate short TTS preview from provided text and selected voice; returns temporary audio URL.

- Business configuration
  - Current `BusinessConfig` covers `services`, `businessHours`, `timezone`, `escalationNumber`, and `greeting`.
  - Proposed additions:
    - `scripts.fallback` (string) – Fallback phrase when ASR confidence is low.
    - `rules.defaultSlotMinutes` (number)
    - `rules.bufferMinutes` (number)
    - `rules.allowDoubleBooking` (boolean)
  - API shape (suggested):
    - `GET /api/organizations/config` – Returns full `BusinessConfig` (including `services` and `rules`).
    - `PUT /api/organizations/config` – Upserts full `BusinessConfig`.
    - Optional granular endpoints if needed later: `/api/organizations/config/services`, `/rules`, `/scripts`.

- Integrations
  - `GET /api/organizations/integrations` already listed; add OAuth begin/callback routes for calendars and Stripe:
    - `GET /api/integrations/google-calendar/authorize`
    - `GET /api/integrations/google-calendar/callback`
    - `GET /api/integrations/outlook/authorize`
    - `GET /api/integrations/outlook/callback`
    - `GET /api/integrations/stripe/authorize`
    - `GET /api/integrations/stripe/callback`

- Realtime status
  - Confirm WS endpoint path and payload for live agent/call metrics used by dashboard header status chip:
    - `wss://…/realtime` or `/ws/status` with payload `{ latencyMs, routingMode, activeCalls }`.

- Auth
  - Frontend will need a simple session endpoint for dashboard shell:
    - `GET /api/auth/session` – Returns current user and organization summary.

These can be stubs for pilot and incrementally wired as backend finalizes.

## Recent Integration Updates (August 2025)

### Organization-Specific Voice Pipeline
- **Database Schema**: Added `twilioNumber` to Organization model, extended BusinessConfig with `scripts`, `rules`, `voiceSettings`
- **Phone Number Management**: 
  - `POST /api/onboarding/create-organization` now provisions Twilio numbers automatically
  - Organizations endpoint returns `twilioNumber` field
  - Mock provisioning available for development via `TWILIO_MOCK_NUMBERS=true`
- **Voice Pipeline Context**:
  - WebSocket connections now receive organization context via query parameters
  - Voice pipeline loads organization-specific scripts, services, and voice settings
  - LLM processing uses custom prompts and service catalogs per organization
- **Frontend Integration**:
  - Dashboard header displays assigned InfiniOffice number
  - Business Info configuration shows phone number prominently
  - Organization API client includes `twilioNumber` in responses
- **Call Routing**: Twilio webhook passes `to`, `from`, `callSid` parameters to WebSocket for organization lookup

## Additional Requirements from Enhanced UI Design (August 2025)

The new enhanced frontend design introduces several additional backend requirements:

### Real-time Dashboard Features
- **WebSocket Events**:
  - `call.started` - Live call beginning notification
  - `call.ended` - Call completion with outcome
  - `metrics.updated` - Real-time performance metrics
  - `agent.status` - Agent online/offline/processing status
  - `booking.created` - New appointment confirmation

- **Enhanced API Endpoints**:
  - `GET /api/dashboard/realtime-metrics` - Current metrics for dashboard cards
  - `GET /api/calls/recent` - Last 10 calls with status/outcome
  - `GET /api/bookings/today` - Today's appointments
  - `POST /api/agent/status` - Update agent routing mode (auto/manual/offline)

### Enhanced Onboarding Flow
- **Business Profile Extension**:
  ```javascript
  // Add to BusinessConfig model
  {
    businessType: "hvac|dental|auto|beauty|other",
    completedSteps: ["step1", "step2"], // Track onboarding progress
    setupProgress: 80 // Percentage completion
  }
  ```

- **Progress Tracking**:
  - `PUT /api/organizations/onboarding-progress` - Update completion status
  - `GET /api/organizations/setup-status` - Get current setup state

### Audio/Voice Features
- **Demo Audio**:
  - `GET /api/tts/demo` - Generate sample AI voice for landing page
  - `POST /api/calls/demo` - Trigger demo call to admin number

### Analytics & Performance
- **Trending Metrics**:
  - Track day-over-day changes for dashboard trend indicators
  - Store hourly/daily aggregations for performance charts
  - Cost tracking per call for revenue analytics

### UI Component Data Requirements

1. **StatusIndicator Component**:
   - Needs real-time latency from voice pipeline
   - Agent status (online/processing/offline)
   - Current call count

2. **MetricCard Component**:
   - Requires trend calculations (% change from previous period)
   - Color coding based on thresholds
   - Real-time updates via WebSocket

3. **AudioVisualization Component**:
   - Live audio level data during calls (optional)
   - Call recording playback visualization

### Security Considerations
- Real-time data should be scoped to organization
- WebSocket connections need JWT authentication
- Rate limiting for real-time endpoints
- Demo features should not expose sensitive data

### Performance Optimizations
- Dashboard metrics cached for 30-60 seconds
- WebSocket connection pooling
- Lazy loading for historical data
- Pagination for call logs and bookings

These enhancements significantly improve user engagement and provide the "futuristic" AI experience outlined in the requirements while maintaining the professional, business-focused approach needed for the target SMB market.

---

## Current Integration Status & Action Items (August 2025)

### Analysis Summary

Based on comprehensive code review and manual testing, the frontend-backend integration architecture is sound with proper API client implementation and complete endpoint coverage. However, critical issues are blocking the onboarding flow and preventing initial user setup.

### 🚨 Critical Issues Requiring Immediate Action

#### 1. **Onboarding Form Input Fields Not Accepting Data** (HIGH PRIORITY)
- **Issue**: Business name and phone number input fields in onboarding do not accept user input
- **Impact**: Complete blockage of user registration and setup flow
- **Location**: `frontend/src/pages/Onboarding/steps/BusinessBasics.jsx:113-136`
- **Analysis**: 
  - React Hook Form implementation appears structurally correct
  - Input component event handling may be broken
  - Possible OnboardingContext state update conflicts
- **Action Items**:
  1. Debug Input component (`frontend/src/components/ui/Input.jsx`) event handlers
  2. Verify OnboardingContext state management and provider wrapping
  3. Test for CSS/z-index issues preventing user interaction
  4. Validate react-hook-form register() function binding

#### 2. **"Skip Setup" Button Routes to Blank Page** (HIGH PRIORITY)
- **Issue**: Skip setup functionality leaves users on empty page instead of dashboard
- **Impact**: Users cannot bypass onboarding when needed
- **Location**: `frontend/src/pages/Onboarding/OnboardingPage.jsx:34`
- **Root Cause**: Navigation to `/app` without checking organization setup completion
- **Action Items**:
  1. Implement organization setup validation before dashboard access
  2. Create fallback routing for incomplete organization setups
  3. Add intermediate setup prompt or redirect logic
  4. Test skip setup flow for different user states

#### 3. **Missing Google OAuth UI Component** (MEDIUM PRIORITY)
- **Issue**: Google OAuth infrastructure exists but no UI component for user signup/login
- **Impact**: Reduced user conversion, missing signup option
- **Evidence**: 
  - Backend endpoint implemented: `src/routes/auth.js:74-127`
  - Frontend auth context ready: `frontend/src/contexts/AuthContext.jsx:90-106`
  - Environment variables configured for Google OAuth
- **Action Items**:
  1. Create GoogleLoginButton component with proper OAuth flow
  2. Integrate Google OAuth script loading and token handling
  3. Add Google sign-in option to LoginPage and RegisterPage
  4. Test complete Google OAuth flow end-to-end

### 🟡 Secondary Integration Issues

#### 4. **Onboarding Data Not Persisting to Backend** (MEDIUM PRIORITY)
- **Issue**: Onboarding form uses simulated API call instead of real backend integration
- **Location**: `BusinessBasics.jsx:40-49` - setTimeout simulation instead of API call
- **Impact**: User onboarding progress not saved between sessions
- **Action Items**:
  1. Replace setTimeout simulation with actual backend API integration
  2. Connect to `/onboarding/create-organization` endpoint
  3. Implement proper error handling and user feedback
  4. Add progress persistence and recovery for interrupted flows

#### 5. **Dashboard Components Missing API Integration** (LOW PRIORITY)
- **Issue**: Dashboard pages exist but not fully connected to backend data
- **Components Affected**:
  - `CallsPage.jsx` → needs `/dashboard/recent-calls` integration
  - `DashboardHome.jsx` → needs `/dashboard/metrics` integration  
  - `IntegrationsPage.jsx` → needs `/organizations/integrations` integration
- **Action Items**:
  1. Implement API calls in dashboard components using existing API client
  2. Add loading states, error handling, and retry logic
  3. Test data flow from backend endpoints to UI display
  4. Verify real-time updates where appropriate

#### 6. **Calendar Integration Incomplete** (LOW PRIORITY)  
- **Issue**: CalendarPage component exists but lacks implementation
- **Backend Support**: Calendar integration endpoints available
- **Action Items**:
  1. Implement calendar view component
  2. Connect to backend appointment data via API client
  3. Add calendar integration setup flow with OAuth providers

### Integration Health Matrix

| Component Area | Frontend Status | Backend Status | Integration Status | Priority |
|----------------|----------------|----------------|-------------------|----------|
| User Authentication | ✅ Complete | ✅ Complete | 🟡 Google OAuth UI Missing | HIGH |
| Onboarding Flow | ✅ UI Built | ✅ API Ready | ❌ Input Blocking | HIGH |
| Organization Setup | ✅ Complete | ✅ Complete | ✅ Working | LOW |
| Dashboard Layout | ✅ Complete | ✅ API Ready | 🟡 Data Integration Needed | MEDIUM |
| Voice Configuration | ✅ UI Complete | ✅ API Complete | 🟡 Testing Required | MEDIUM |
| Calendar Management | 🟡 Page Exists | ✅ API Complete | 🟡 Implementation Needed | LOW |
| User Management | ✅ Complete | ✅ Complete | ✅ Working | LOW |

### Testing Recommendations

**Immediate Testing Required**:
- [ ] Manual test onboarding form input fields across browsers
- [ ] Test skip setup navigation for different user states  
- [ ] Verify Google OAuth environment configuration
- [ ] Test backend API endpoints independently with Postman
- [ ] Validate token authentication and session management

**Integration Testing**:
- [ ] Complete user registration and onboarding flow
- [ ] Dashboard data loading and error handling
- [ ] Authentication state persistence across page reloads
- [ ] API error propagation to UI components
- [ ] Real-time data updates via WebSocket connections

### Development Priority

1. **Phase 1 (Critical)**: Fix onboarding input blocking and skip setup navigation
2. **Phase 2 (High)**: Implement Google OAuth UI component  
3. **Phase 3 (Medium)**: Complete dashboard data integration
4. **Phase 4 (Low)**: Finish calendar and advanced features

### Risk Assessment

**Immediate Risks**:
- Onboarding blockage prevents user acquisition and testing
- Skip setup navigation creates poor user experience

**Medium-term Risks**:
- Missing Google OAuth reduces signup conversion
- Incomplete dashboard affects user retention post-setup

**Low Risks**:
- Advanced features can be implemented in future iterations without blocking core functionality

### Conclusion

The frontend-backend integration foundation is solid with comprehensive API coverage and proper architecture. The critical issues are primarily UI-layer problems (input handling, navigation) rather than fundamental integration failures. Addressing the high-priority onboarding issues will unlock user testing and feedback collection to guide further development.

---

## Voice Selection Feature Implementation (August 2025)

### Overview
Successfully implemented comprehensive voice selection feature allowing organizations to choose from multiple Deepgram TTS voices with real-time testing and seamless voice pipeline integration.

### Implementation Details

#### Frontend Components
- **VoiceSettingsEditor Component**: Complete UI for voice selection with:
  - Visual voice cards for Saturn, Harmonia, Hera, Zeus voices
  - Real-time voice testing with custom script input
  - Status indicators and loading states
  - Integration with organization-specific settings

#### Backend Integration
- **Voice Settings API** (`/api/voice/settings`):
  - GET endpoint returns current organization voice settings
  - POST endpoint updates voice selection with role-based access control
  - Automatic organization context cache invalidation on changes

- **Voice Testing API** (`/api/voice/test`):
  - Real-time voice preview with custom text
  - Audio streaming response for immediate playback
  - Support for all available voice models

- **Voice Model Mapping System**:
  - Translates user-friendly names (saturn, harmonia, hera, zeus) to Deepgram API format (aura-2-*-en)
  - Handles multiple TTS calling patterns throughout the voice pipeline
  - Ensures voice selection consistency across greeting and conversation TTS

#### Key Technical Solutions

1. **Authentication Integration**:
   ```javascript
   // Fixed: Replace manual token handling with API client
   const config = await apiClient.get('/voice/settings')
   await apiClient.post('/voice/settings', { voiceModel: selectedVoice })
   ```

2. **Voice Model Mapping**:
   ```javascript
   const voiceModelMap = {
     'saturn': 'aura-2-saturn-en',
     'harmonia': 'aura-2-harmonia-en', 
     'hera': 'aura-2-hera-en',
     'zeus': 'aura-2-zeus-en'
   };
   ```

3. **TTS Configuration Fix**:
   ```javascript
   // Critical fix: Ensure mapped model overrides spread options
   const config = {
     encoding: 'mulaw',
     sample_rate: 8000,
     container: 'none',
     ...options,
     model: deepgramModel  // Must be last to override options.model
   };
   ```

#### Integration Points

- **Organization Context**: Voice settings automatically cached and invalidated
- **Role-Based Access**: Admin/operator roles required for voice changes
- **Voice Pipeline**: Selected voice applies to both greeting and conversation TTS
- **Real-time Updates**: Settings changes immediately affect new calls

#### Testing & Validation

- Manual testing confirmed voice selection persists and applies correctly
- Audio preview functionality working across all voice models
- Authentication flows properly integrated with organization context
- Voice model mapping verified with Deepgram API requirements

### Business Impact

- **Enhanced Customization**: Organizations can now match voice personality to brand
- **Professional Variety**: Four distinct voice options (authoritative male, warm female, professional female, commanding male)
- **User Experience**: Real-time testing eliminates guesswork in voice selection
- **Technical Foundation**: Architecture supports future voice feature expansion

This implementation represents a significant enhancement to the voice agent platform, providing organizations with meaningful customization options while maintaining technical reliability and performance.