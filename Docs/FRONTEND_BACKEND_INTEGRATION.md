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

### Voice (`/voice`)
- `POST /voice` - Twilio webhook for incoming calls

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
  timezone: "America/New_York"
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

**Last Updated**: August 2025 - Enhanced UI design requirements added 

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