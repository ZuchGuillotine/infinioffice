# InfiniOffice v1 Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Web App (React)          Mobile App (React Native - Phase 2)    │
│  - Admin Dashboard         - Quick Actions                       │
│  - Script Builder          - Call Monitoring                     │
│  - Analytics               - Notifications                       │
└────────────┬───────────────────────────┬────────────────────────┘
             │                           │
             └──────────┬────────────────┘
                        │ HTTPS/WSS
┌───────────────────────▼─────────────────────────────────────────┐
│                    API Gateway Layer                             │
├─────────────────────────────────────────────────────────────────┤
│                 AWS API Gateway / ALB                            │
│                    - Rate Limiting                               │
│                    - JWT Authentication                          │
│                    - Request Routing                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                 Application Services Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Node.js Services (AWS App Runner)               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                           │  │
│  │  Core API Service          Voice Orchestrator            │  │
│  │  - Business Logic          - Twilio WebHooks             │  │
│  │  - CRUD Operations         - Media Streams               │  │
│  │  - Auth/OAuth              - State Machine               │  │
│  │                                                           │  │
│  │  Integration Service       Analytics Service              │  │
│  │  - Calendar Sync           - Call Metrics                │  │
│  │  - CRM Webhooks           - Usage Tracking              │  │
│  │  - Email/SMS Handler      - Cost Calculations           │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                    External Services Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │   Twilio   │  │  Deepgram  │  │   OpenAI   │               │
│  │  - PSTN    │  │  - ASR     │  │  GPT-3.5/4 │               │
│  │  - SMS     │  │  - Real-   │  │  - Intent  │               │
│  │  - Media   │  │    time    │  │  - Tools   │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ AWS Polly  │  │  Calendar  │  │   Stripe   │               │
│  │  - TTS     │  │  - Google  │  │  - Billing │               │
│  │  - Neural  │  │  - Outlook │  │  - Subs    │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                      Data Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐  ┌────────────────────────┐    │
│  │   AWS RDS PostgreSQL       │  │   AWS S3                │    │
│  │   - User Data              │  │   - Call Recordings     │    │
│  │   - Config/Scripts         │  │   - Logs                │    │
│  │   - Call History           │  │   - Static Assets       │    │
│  │   - Analytics              │  │                         │    │
│  └────────────────────────────┘  └────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────┐  ┌────────────────────────┐    │
│  │   Redis/ElastiCache        │  │   AWS SQS/EventBridge  │    │
│  │   - Session Management     │  │   - Event Queue         │    │
│  │   - Real-time State        │  │   - Async Processing    │    │
│  └────────────────────────────┘  └────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Voice Processing Pipeline

**Components:**
- **Telephony Interface** (Twilio Programmable Voice)
  - PSTN connectivity ($0.0085/min inbound)
  - Media Streams API for real-time audio
  - WebRTC for browser-based testing
  - Built-in call recording & transcription

- **Speech Processing** (Hybrid Approach)
  - **ASR**: Deepgram Nova ($0.0043/min) for real-time transcription
    - <500ms initial results
    - Domain-specific keyword biasing
    - Fallback to Google Cloud Speech for accuracy
  - **TTS**: AWS Polly Neural ($0.016/min spoken)
    - <300ms startup latency
    - Multiple voice options
    - Caching for repeated prompts

- **LLM Orchestration** (Deterministic + AI)
  - **State Machine**: Core dialogue flow (Temporal/XState)
  - **LLM**: GPT-3.5-Turbo for understanding ($0.002/1K tokens)
    - Intent recognition & slot filling
    - Function calling for calendar integration
    - GPT-4 escalation for complex queries only
  - **Session Management**: In-memory context with Redis

### 2. Business Management System

**Components:**
- **Account Management**
  - Multi-tenant architecture
  - Role-based access control
  - White-label configuration

- **Configuration Engine**
  - Script builder/editor
  - Action enablement
  - Voice model selection
  - Business hours settings

- **Integration Hub**
  - OAuth token management
  - API credential storage
  - Webhook configuration
  - Rate limit handling

### 3. Data Management

**Database Schema (PostgreSQL):**
```sql
-- Core Tables
organizations
users
subscriptions
call_logs
call_transcripts
actions_taken
scripts
voice_configurations
integration_credentials
billing_events
```

**Caching Strategy (Redis):**
- Active call sessions
- User authentication tokens
- Real-time availability data
- Frequently accessed configurations

### 4. Security & Compliance

**Security Measures:**
- End-to-end encryption for calls
- OAuth 2.0/JWT authentication
- API key management
- PCI DSS compliance for payments
- HIPAA compliance considerations
- Call recording consent management

## Key Technical Decisions

### Cost-Optimized Architecture
- **Usage-based pricing alignment**: All services scale with actual usage
- **Per-call cost target**: $0.20-0.50 total (60-80% gross margin at $1.20/call pricing)
- **Vendor flexibility**: Abstract APIs to swap providers based on cost/performance
- **Caching strategy**: Reduce TTS costs by caching common responses

### Low-Latency Optimizations
- **Streaming everything**: ASR partial results, TTS chunked audio
- **Edge proximity**: Use Twilio's global edge network
- **Parallel processing**: Intent recognition while user speaks
- **Pre-warming**: Keep Lambda/containers warm for instant response

### Integration-First Design
- **Calendar priority**: Google Calendar & Outlook 365 first
- **Webhook fallback**: Email/SMS for systems without APIs
- **Vertical templates**: Pre-built scripts for target industries
- **Simple onboarding**: 15-minute setup with wizard

## Target Verticals & Use Cases

### Primary Markets (Immediate)
1. **Residential Home Services** (HVAC, Plumbing, Electrical)
   - 27% missed call rate, $1,200 lost per miss
   - Emergency calls drive urgency
   - Simple booking: "Send tech tomorrow at 9am"

2. **Automotive Repair Shops**
   - 51% conversion on answered calls
   - $200-500 average ticket
   - Straightforward scheduling slots

3. **Dental Practices**
   - High-value appointments
   - Existing scheduling systems
   - HIPAA-light approach (no medical details)

4. **Beauty Salons & Spas**
   - High rebooking rate
   - Time-slot based scheduling
   - Upsell opportunities during booking

## API Structure

### Core Endpoints
```
/api/v1/auth/*           - Authentication/OAuth
/api/v1/organizations/*  - Org management
/api/v1/scripts/*        - Script CRUD
/api/v1/calls/*          - Call history/logs
/api/v1/integrations/*   - CRM/Calendar setup
/api/v1/analytics/*      - Usage/metrics
/api/v1/billing/*        - Subscription/payments
/ws/voice/*              - WebSocket for voice
```

## Deployment Pipeline

### Environments
1. **Development** - Feature development
2. **Staging** - Integration testing
3. **Production** - Live system

### CI/CD Process
- GitHub Actions for build/test
- AWS ECR for container registry
- App Runner automatic deployments
- Database migrations via Flyway/Alembic

## Monitoring & Observability

### Key Metrics
- Call latency (target: <300ms)
- Speech recognition accuracy
- System uptime (target: 99.9%)
- API response times
- Error rates by service

### Tools
- AWS CloudWatch for infrastructure
- Sentry for error tracking
- Custom dashboard for business metrics
- Call quality monitoring system

## Phase 1 MVP Features (90 Days)

### Week 1-4: Core Development
1. **Twilio Integration**
   - Phone number provisioning
   - Media Streams setup
   - Call flow configuration

2. **Basic Voice Pipeline**
   - Deepgram ASR integration
   - AWS Polly TTS setup
   - <1 second turn latency achieved

3. **Dialogue System**
   - State machine for appointment booking
   - GPT-3.5 intent recognition
   - Slot collection (name, date, service)

### Week 5-8: Integration & Testing
1. **Calendar Integration**
   - Google Calendar API
   - Outlook 365 support
   - Conflict detection

2. **Business Configuration**
   - Script templates per vertical
   - Business hours setup
   - Service type configuration

3. **Fallback Handling**
   - Voicemail on failure
   - SMS confirmation option
   - Human escalation path

### Week 9-12: Pilot Deployment
1. **Customer Onboarding**
   - 2-3 customers per vertical
   - Custom script configuration
   - Integration setup

2. **Monitoring & Analytics**
   - Call success metrics
   - Latency tracking
   - Cost per call analysis

3. **Rapid Iteration**
   - Daily performance reviews
   - Weekly customer feedback
   - Continuous optimization

## Unit Economics & Pricing

### Cost Structure (Per 5-min Call)
- **Telephony**: $0.04 (Twilio PSTN)
- **ASR**: $0.02-0.05 (Deepgram)
- **LLM**: $0.01-0.10 (GPT-3.5 primarily)
- **TTS**: $0.04 (AWS Polly)
- **Infrastructure**: $0.02
- **Total**: $0.20-0.50

### Pricing Model
- **Starter**: $99/mo - 100 calls
- **Growth**: $299/mo - 300 calls
- **Scale**: $599/mo - 1000 calls
- **Overage**: $1.50 per additional call

### Target Metrics
- 85%+ booking success rate
- <1 second response latency
- 60-80% gross margin
- $5-10K recovered revenue per customer/month