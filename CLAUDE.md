# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development Commands
- `npm run dev` - Start both backend (port 3001) and frontend (port 5173) concurrently using scripts/dev.sh
- `npm run dev:backend` - Start only backend server in development mode on port 3001
- `npm run dev:frontend` - Start only frontend dev server (cd frontend && npm run dev)
- `npm run dev:ngrok` - Start ngrok tunnel for Twilio webhook testing

### Production Commands
- `npm run build` - Build entire application using scripts/build.sh
- `npm run build:frontend` - Build only frontend for production
- `npm run build:docker` - Build Docker image
- `npm start` - Start production server on port 3000

### Testing Commands
- `npm test` - Run all tests using Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report (80% threshold)
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:performance` - Run performance tests
- `npm run test:ci` - Run tests for CI environment

### Frontend Commands (in `frontend/` directory)
- `cd frontend && npm run dev` - Start Vite dev server on port 5173
- `cd frontend && npm run build` - Build frontend for production
- `cd frontend && npm run lint` - Run ESLint on frontend code
- `cd frontend && npm run preview` - Preview production build

### Database Management
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema changes to database
- `npx prisma migrate dev` - Create and apply migrations

### Testing Individual Services
- `npm test tests/unit/calendar.test.js` - Test calendar service
- `npm test tests/unit/db.test.js` - Test database service  
- `npm test tests/unit/llm.test.js` - Test LLM service
- `npm test tests/unit/stt.test.js` - Test speech-to-text service
- `npm test tests/unit/telephony.test.js` - Test telephony service
- `npm test tests/unit/tts.test.js` - Test text-to-speech service
- `npm test tests/unit/stateMachine.test.js` - Test XState booking flow

## Architecture Overview

### Core Application Flow
InfiniOffice is a voice-driven office assistant that handles phone calls through a real-time pipeline:

1. **Entry Point** (`src/index.js`): Fastify server with WebSocket support for Twilio Media Streams
2. **Voice Pipeline**: Incoming calls → ASR (Deepgram) → State Machine (XState) → LLM (OpenAI) → TTS (AWS Polly) → Response
3. **State Management**: Uses XState for deterministic conversation flow through booking states (greet → collectService → collectTimeWindow → collectContact → confirm → book)

### Key Services Architecture

**Services Layer** (`src/services/`):
- `telephony.js` - Twilio integration for handling incoming calls and TwiML responses
- `stateMachine.js` - XState booking flow with context for service, timeWindow, and contact
- `stt.js` - Deepgram speech-to-text integration
- `llm.js` - OpenAI GPT integration for conversation processing
- `tts.js` - AWS Polly text-to-speech with streaming
- `calendar.js` - Calendar management and appointment booking
- `db.js` - Database operations using Prisma ORM

**Real-time Flow**:
- WebSocket connection receives Twilio media streams
- Each message triggers: STT → State Machine transition → LLM processing → TTS response
- State machine ensures deterministic progression through booking slots

### Database Schema (Prisma)

**Core Models**:
- `Call` - Phone call records with caller info, duration, transcript
- `Turn` - Individual conversation turns with latency metrics (ASR, LLM, TTS timing)
- `Appointment` - Scheduled appointments with calendar integration

**Key Features**:
- UUID primary keys with `gen_random_uuid()`
- Cascade deletion from Call to Turn
- Time-based partitioning ready (calls by created_at)
- JSONB metadata storage for flexible data

### Technology Stack Integration

**Voice Pipeline**:
- Twilio Programmable Voice + Media Streams for telephony
- Deepgram Nova (phonecall model) for ASR with interim results
- OpenAI GPT-3.5-turbo for conversation processing
- AWS Polly Neural for TTS streaming
- XState for deterministic dialogue flow

**Backend Infrastructure**:
- Fastify for HTTP/WebSocket server
- PostgreSQL with Prisma ORM
- Redis for session state (referenced but not yet implemented)
- OpenTelemetry for tracing (configured but not fully implemented)

**Frontend Stack**:
- React 18 with Vite for development and building
- React Router for navigation
- TanStack Query for API state management
- Tailwind CSS for styling
- Lucide React for icons
- React Hook Form with Zod for form validation
- Recharts for data visualization

## Development Notes

### Service Dependencies
Each service is designed as an independent module that can be tested in isolation. The main application (`src/index.js`) orchestrates these services through WebSocket message handling.

### State Machine Flow
The XState machine in `stateMachine.js` enforces a strict progression:
- `greet` → `collectService` → `collectTimeWindow` → `collectContact` → `confirm` → `book`
- Each state transition requires specific speech input
- Context accumulates booking details (service, timeWindow, contact)

### Real-time Considerations
- WebSocket connections handle bi-directional audio streams from Twilio
- Audio processing is asynchronous with streaming responses
- State transitions happen immediately on speech recognition results

### Testing Approach
- Individual service tests for each component in `tests/unit/`
- Integration tests in `tests/integration/`
- End-to-end tests in `tests/e2e/`
- Performance tests in `tests/performance/`
- Uses Jest testing framework with 80% coverage threshold
- Services are tested independently of the main application flow
- Mock services available in `tests/mocks/`
- Test helpers and fixtures provided

### Multi-Service Architecture
This is a full-stack application with:
- **Backend**: Node.js/Fastify server in the root directory
- **Frontend**: React/Vite application in `frontend/` directory
- **Database**: PostgreSQL with Prisma ORM
- **Voice Pipeline**: Real-time WebSocket integration with Twilio Media Streams

### Multi-Tenancy & Organization Models
The database includes comprehensive multi-tenancy support:
- `Organization` - Main tenant entity with plans, SMS branding, UUID primary keys
- `User` - Organization members with Google OAuth support and role-based access (admin/operator/viewer)
- `BusinessConfig` - Organization-specific settings (business hours, holidays, services, providers, escalation, greeting, timezone)
- `Integration` - Third-party service connections (Google Calendar, etc.)
- `Call`/`Turn`/`Appointment` - All transactional data scoped to organizations
- Cascade deletion from Organization → User, Call → Turn for data consistency

### Frontend Architecture & Routes
The React frontend (`frontend/`) includes:
- **Authentication**: Login/Register pages with Google OAuth integration
- **Onboarding Flow**: Multi-step setup (BusinessBasics, Services, SchedulingRules, PhoneNumbers, ScriptComposer, TestCall)
- **Dashboard Layout**: Comprehensive management interface with:
  - DashboardHome with metrics and call monitoring
  - CallsPage for call history and analytics
  - CalendarPage for appointment management
  - Configuration pages (Business Info, Services, Scheduling, Voice Script editors)
  - IntegrationsPage, SettingsPage, ScriptStudioPage, BillingPage
- **UI Components**: Reusable components (Button, Card, Input, Select, LoadingSpinner, AudioVisualization, StatusIndicator, etc.)
- **State Management**: React Context for authentication, TanStack Query for API state