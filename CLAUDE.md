# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm install` - Install dependencies
- `npm test` - Run tests (uses Jest)
- `node src/index.js` - Start the application on port 3000
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema changes to database
- `npx prisma migrate dev` - Create and apply migrations

### Testing Individual Services
- `npm test calendar.test.js` - Test calendar service
- `npm test db.test.js` - Test database service  
- `npm test llm.test.js` - Test LLM service
- `npm test stt.test.js` - Test speech-to-text service
- `npm test telephony.test.js` - Test telephony service
- `npm test tts.test.js` - Test text-to-speech service

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

**Infrastructure**:
- Fastify for HTTP/WebSocket server
- PostgreSQL with Prisma ORM
- Redis for session state (referenced but not yet implemented)
- OpenTelemetry for tracing (configured but not fully implemented)

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
- Individual service tests for each component in `tests/`
- Uses Jest testing framework
- Services are tested independently of the main application flow