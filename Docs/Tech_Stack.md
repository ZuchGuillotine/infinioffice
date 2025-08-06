InfiniOffice Technical Stack Documentation (Updated)
Last updated: August 2025

This document reflects the agreed MVP stack with implementable latency, reliability, and unit-cost controls, plus the requested edits: barge-in/streaming behavior, ASR tuning, deterministic state, calendar idempotency, App Runner streaming notes, A2P 10DLC consent, OpenTelemetry, LLM token budgets, fourth pilot vertical (salons), and time-based partitioning.

Technology Stack Overview
Core Technologies – MVP Focus
Layer	Primary Choice	Why This Choice	Fallback Option
Frontend Web	React 18 + Vite	Fast builds, proven ecosystem	Next.js for SSR
Backend Runtime	Node.js 20 LTS	Unified JS stack, async handling	Python/FastAPI
Telephony	Twilio Programmable Voice	Battle-tested, US coverage, media streams	Telnyx (cost savings)
ASR	Deepgram Nova (phonecall)	Low WER on PSTN, partials, ~<500ms first partial	Google Cloud Speech
LLM	OpenAI GPT-3.5-Turbo	Low cost, function calling, predictable	GPT-4 for edge/complex turns
TTS	AWS Polly Neural	Streaming, natural prosody, low cost	Google Cloud TTS
Database	PostgreSQL 15	Reliable, ACID; supports partitioning	MongoDB (non-core)
Infra	AWS App Runner	Managed, autoscaling HTTP	ECS Fargate for media/WS
Cache/Queues	Redis 7 / SQS	Session state; async retries	NATS / RabbitMQ
Observability	OpenTelemetry + OTLP exporter	Per-turn tracing and SLOs	New Relic/DataDog agents

Pricing notes (orientation): Twilio US inbound local ≈ $0.0085/min; Deepgram ≈ low single-digit ¢/min; Polly bills per character (≈$16 per 1M chars for neural; ~$0.01–$0.02 per min typical phone cadence).

Voice Pipeline Architecture
Telephony Layer (Twilio)
json
Copy
Edit
{
  "dependencies": {
    "@twilio/voice-sdk": "^2.x",
    "twilio": "^4.20.0"
  }
}
Key Features Used

Programmable Voice (US inbound), Media Streams (bi-directional RTP/WebSocket), DTMF

Consent bannering + recording (tenant toggle; two-party consent states)

SMS API for confirmations (A2P 10DLC registration required)

Geographic redundancy & webhooks

Streaming & barge-in policy

Treat barge-in in app logic: immediately cancel any in-flight TTS when ASR partials arrive.

Short utterances only (≤ ~1.0–1.5s) and stream immediately; avoid long <Say> blocks.

Prefer Media Streams with PCM 8kHz and server-side playback controller to cut audio mid-utterance.

Keep per-turn boundaries tight; confirm when needed, otherwise advance the state machine.

Speech Recognition (Deepgram)
json
Copy
Edit
{
  "dependencies": { "@deepgram/sdk": "^3.x" }
}
js
Copy
Edit
// Deepgram config tuned for PSTN
const deepgram = {
  model: "nova-2-phonecall",
  language: "en-US",
  punctuate: true,
  smart_format: true,         // phone numbers, dates, currency
  interim_results: true,      // partials for barge-in
  vad_events: true,           // speaking/silence events
  endpointing: 250,           // 200–350ms typical
  diarize: false,             // off for MVP to reduce latency
  keywords: ["dr lee:2", "water heater:2", "alternator:2"] // per-tenant boosts
};
Audio formats: 8kHz mono PCM/μ-law for phone. Keep end-to-end at 8kHz to avoid resample artifacts.

Latency targets: first partial ≤ 500ms; finalization ≤ 1.5s best-effort.

Biasing: refresh per tenant (services, provider names, streets).

LLM Orchestration (Hybrid: State Machine + LLM)
json
Copy
Edit
{
  "dependencies": {
    "openai": "^4.24.0",
    "xstate": "^5.x",
    "@langchain/core": "^0.1.x"
  }
}
Deterministic dialogue

Use XState to enforce slot gates: service → time window → contact → confirm. GPT acts to interpret and phrase, not to control flow.

Tool calls: availability check, create/reschedule/cancel appointment, all with timeouts (1.5–2.0s).

LLM settings (cost & brevity controls)

js
Copy
Edit
const SYSTEM = `You are a scheduling agent. Be concise and directive.
Goal: complete booking/reschedule/cancel with minimal words.
No chit-chat. Offer at most top 2–3 options. Avoid long explanations.`;

const OPENAI_MODEL_PRIMARY = "gpt-3.5-turbo-0125"; // example; update as needed
const OPENAI_MODEL_ESCALATE = "gpt-4o-mini";       // or latest GPT-4 preview

const common = {
  temperature: 0.2,
  // Budget controls
  max_tokens: 120,                 // cap per turn
  presence_penalty: 0,
  frequency_penalty: 0,
  // Truncate conversation memory to recent few turns
};
Escalation policy

Default 3.5; escalate to GPT-4 only on ambiguity score, repeated NLU failure, or special intents.

Hard tool timeout → fallback to SMS link or voicemail capture (deterministic state).

Calendar Writes: Idempotency & Retries
http
Copy
Edit
POST /calendar/event
Headers:
  Idempotency-Key: <callId>:<attempt>

On 409/5xx:
  1) Read-after-write to confirm state
  2) Retry with backoff (200ms, 500ms, 1s)
  3) Persist failure, send SMS booking link + email to business
Text-to-Speech (AWS Polly)
json
Copy
Edit
{
  "dependencies": {
    "@aws-sdk/client-polly": "^3.x",
    "@aws-sdk/client-s3": "^3.x"
  }
}
js
Copy
Edit
const pollyParams = {
  OutputFormat: "pcm",   // streaming
  SampleRate: "8000",    // phone quality
  VoiceId: "Joanna",     // per-tenant configurable
  Engine: "neural",
  TextType: "ssml"
};
Playback & cost notes

Stream immediately; keep chunks ≤ ~1s; cancel on ASR partial.

Polly is billed per character (≈$16 / 1M chars neural). Typical phone cadence ≈ $0.01–$0.02/min; cache common prompts (greetings, disclaimers).

MVP Development Timeline (90 Days)
Weeks 1–4: Prototype Development
yaml
Copy
Edit
Week 1–2: Core Infrastructure
- Twilio numbers + Media Streams webhook (bi-directional)
- Express/Fastify server with WebSocket/HTTP
- PostgreSQL schema (calls, turns, appointments); **time-based partitions**
- Redis for session state; S3 bucket for recordings (optional)

Week 3: Voice Pipeline Integration
- Deepgram ASR streaming + biasing
- AWS Polly TTS streaming (PCM 8kHz); **barge-in cancel policy**
- μ-law/PCM conversion as needed for PSTN
- Achieve ≤1.5s turn latency (median ≤1.2s)

Week 4: Dialogue System
- XState slot-gated booking flow
- OpenAI GPT-3.5 with function calls; **max_tokens: 120**
- Tool timeouts + SMS/voicemail fallback
- Calendar idempotency + retries
Weeks 5–8: Business Logic & Integrations
yaml
Copy
Edit
Week 5–6: Calendar Integration
- Google Calendar OAuth; Microsoft Graph OAuth
- Availability lookup, conflict detection, timezone handling
- Confirmation SMS (A2P 10DLC brand/campaign registration)

Week 7: Vertical Customization
- Script templates: Home Services, Auto, Dental, **Salons (sandbox)**
- Business hours/holidays setup
- Per-tenant ASR keywords

Week 8: Testing & Refinement
- k6 load tests: 5/50/100 concurrent; 2/5/10-min mixes
- Synthetic calls incl. accents/noise
- Latency/availability SLO alarms
Weeks 9–12: Pilot Deployment
yaml
Copy
Edit
Week 9: Customer Onboarding
- **2–3 pilots per vertical (4 verticals ⇒ 8–12 total)** including salons as low-risk sandbox
- Tenant config, scripts, A2P registration, monitoring dashboards

Week 10–11: Live Monitoring
- Real-time turn tracing (OpenTelemetry)
- Booking success & containment tracking
- Per-call COGS (telephony, ASR, LLM, TTS)

Week 12: Iteration & Scale Prep
- Address feedback; tune ASR endpointing/keywords
- Optimize TTS chunk sizes; refine prompts
- Decide if media/WS moves to ECS Fargate
Cost Optimization Strategy
Immediate (MVP)
Prompt & audio caching: cache greetings/consents; reuse TTS audio.

ASR biasing: reduce repeats and misrecognitions.

Smart escalation: 3.5 default; 4 only on failure/complexity.

Connection pooling: DB/Redis; reuse Twilio websockets when possible.

3–6 Months
Volume discounts / BYOC: negotiate Twilio/Deepgram; optional BYOC for large tenants.

Open-source ASR on GPU (Whisper) for heavy tenants; cost model comparison.

Regional deployments: reduce RTT for East/West/Central US.

6–12 Months
Custom voices (brand cloning) where ROI justifies.

Vertical-tuned LLMs; distill small NLU for cheap turns.

Self-hosted LLM for large tenants; model routing based on complexity.

Backend Stack
API Server
json
Copy
Edit
{
  "dependencies": {
    "fastify": "^4.x",
    "cors": "^2.8.5",
    "helmet": "^7.x",
    "zod": "^3.x",
    "prisma": "^5.x",
    "@prisma/client": "^5.x",
    "pg": "^8.x",
    "ioredis": "^5.x",
    "ws": "^8.x",
    "winston": "^3.x",
    "morgan": "^1.10.0",
    "@opentelemetry/api": "^1.x",
    "@opentelemetry/sdk-node": "^0.5x",
    "@opentelemetry/auto-instrumentations-node": "^0.4x",
    "@opentelemetry/exporter-trace-otlp-http": "^0.5x"
  }
}
Auth: JWT + Google OAuth.
Validation: Zod (schema-first).
Real-time: ws or Socket.IO (if needed for ops UI).

OpenTelemetry (OTel) – per-turn tracing
Spans: call.receive, asr.first_partial, asr.final, llm.tool_call, tts.ttfb, tts.stream, calendar.lookup, calendar.write.

Attributes: tenant_id, call_id, turn_index, latencies (ms), token_in/out, cogs per component.

Export: OTLP HTTP to collector (DataDog/New Relic/Tempo) with SLO dashboards and alerts.

Voice Processing Services
Declare primaries explicitly (to avoid confusion):

json
Copy
Edit
{
  "@deepgram/sdk": "^3.x",            // ASR primary
  "@aws-sdk/client-polly": "^3.x",    // TTS primary
  "openai": "^4.24.0"                 // LLM primary (chat + tools)
  // Optionals:
  // "@google-cloud/speech": "^6.x",
  // "@google-cloud/text-to-speech": "^5.x"
}
Infrastructure & DevOps
AWS Services
yaml
Copy
Edit
Compute & Hosting
- AWS App Runner (API/LLM gateway; set min instances > 0; connection draining)
- **ECS Fargate** (recommended for media/WS if App Runner shows drops)

Storage
- RDS PostgreSQL (partitioned tables)
- S3 (recordings/transcripts with retention)

Networking
- ALB for WS services (HTTP/1.1 keep-alive; sticky sessions)
- Route53, CloudFront (static)

Messaging & Queues
- SQS (calendar write queue + retries)
- EventBridge (tenant events)

Security
- IAM least-privilege; Secrets Manager; KMS
- WAF + rate limits; per-tenant throttles

Monitoring
- CloudWatch metrics/logs
- **OpenTelemetry collector** (OTLP) → APM backend
CI/CD Pipeline
yaml
Copy
Edit
jobs:
  test:
    - Unit (Jest/Vitest) + contract tests
    - Synthetic call tests (recorded WAVs w/ noise/accents)
    - k6 load test smoke (5/10 concurrent)
  build:
    - Docker build + push to ECR
  deploy:
    - App Runner/ECS
    - DB migrations (safe/online)
    - Cache warm; health checks
A2P 10DLC Registration & Consent
Register brand/campaign for each tenant or for InfiniOffice-hosted short code.

Enforce opt-in/opt-out (START/STOP/HELP).

Track consent per tenant + phone number; block SMS until registered.

App Runner streaming notes
Set min instances (1–2) to prevent cold starts from killing WS.

Health checks that don’t close WS; graceful drain on scale-down.

If p95 WS disconnects recur → move media/WS to ECS Fargate.

Third-Party Integrations
Service	Purpose	Integration	Notes
Google Calendar	Scheduling	OAuth 2.0	Conflict detection, read-after-write
Microsoft 365	Scheduling	Graph API	Shared calendars supported
HubSpot (P1)	CRM	REST	Contacts + activities
Salesforce (P1)	CRM	REST/SOAP	Heavier auth/scopes
Stripe	Billing	SDK	Tiered + metered usage
Slack (opt)	Notifications	Webhook/API	Ops alerts

Database Schema & Partitioning
Core Tables (excerpt)
sql
Copy
Edit
-- Calls: parent partitioned by month (created_at)
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  caller_phone VARCHAR(20),
  duration_seconds INTEGER,
  transcript TEXT,
  recording_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Example monthly partition
CREATE TABLE calls_2025_08 PARTITION OF calls
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

-- Turns: child table linked to calls (optional partition by call_id hash or created_at)
CREATE TABLE turns (
  id BIGSERIAL PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  turn_index INT NOT NULL,
  asr_ms INT,
  llm_ms INT,
  tts_ms INT,
  transcript_in TEXT,
  transcript_out TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  external_id TEXT,
  calendar_provider TEXT CHECK (calendar_provider IN ('google','microsoft')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  service TEXT,
  provider TEXT,
  contact_phone VARCHAR(20),
  notes TEXT,
  status TEXT CHECK (status IN ('booked','canceled','rescheduled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recommended indexes
CREATE INDEX idx_calls_org_created ON calls (organization_id, created_at DESC);
CREATE INDEX idx_turns_call_idx ON turns (call_id, turn_index);
CREATE INDEX idx_appts_org_start ON appointments (organization_id, start_at);
Add a monthly partition creation job (e.g., pg_cron) to roll partitions and detach/archive old ones.

Security Implementation
Authentication & Authorization
JWT (short-lived) + refresh; Google OAuth.

RBAC: Org Admin, Operator, Viewer.

Per-tenant secrets in AWS KMS/Secrets Manager.

Recording & PII
Recording default OFF in two-party consent states unless tenant opts in.

Redact SSNs/credit card patterns from transcripts; PHI-light posture for clinics.

Security Headers (Helmet)
js
Copy
Edit
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"], imgSrc: ["'self'", "data:", "https:"]
  }},
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
Monitoring & Observability
SLOs & Alerts
Turn latency median ≤1.2s, P95 ≤1.5s (5-min windows) → alert.

ASR first partial > 600ms sustained → alert.

Booking failure rate (eligible intents) > 15% → alert.

WS disconnects p95 > threshold → investigate App Runner/ECS.

Metrics
App: API latency p50/p95/p99, error rates, queue depth.

Voice: ASR partial latency, TTS TTFB, barge-in interrupts, LLM token in/out.

Business: bookings, containment, per-call COGS (PSTN/ASR/LLM/TTS breakdown).

Logging
Structured JSON (winston/pino); correlation IDs (call_id, tenant_id).

Redact PII; retain per policy (30–90 days typical).

Development Environment
bash
Copy
Edit
# .env (example)
DATABASE_URL=postgresql://user:pass@localhost:5432/infinioffice
REDIS_URL=redis://localhost:6379
JWT_SECRET=development-secret
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
DEEPGRAM_API_KEY=...
AWS_REGION=us-west-2
POLLY_VOICE=Joanna
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.example.com/v1/traces
Deployment Strategy
Environments
Env	Purpose	Trigger	Approval
Dev	Active dev	Manual	–
Staging	Pre-prod tests	PR merge	–
Prod	Live	Release tag	Required

Rollback
Blue-green; database forward-compatible migrations; feature flags for risky paths (e.g., new intents).

Pilot Verticals
Residential Home Services

Automotive Repair

Dental Clinics

Salons (sandbox) ← low-risk pilot for early analytics; margins not critical for MVP.

Appendix: XState Outline
js
Copy
Edit
createMachine({
  id: 'booking',
  initial: 'greet',
  states: {
    greet: { on: { INTENT_BOOK: 'collectService' } },
    collectService: { on: { SLOT_SERVICE: 'collectTimeWindow' } },
    collectTimeWindow: { on: { SLOT_TIME: 'collectContact' } },
    collectContact: { on: { SLOT_CONTACT: 'confirm' } },
    confirm: {
      on: { CONFIRM_YES: 'book', CONFIRM_NO: 'collectTimeWindow' }
    },
    book: { invoke: { src: 'createEvent', onDone: 'success', onError: 'fallback' } },
    fallback: {/* SMS link/voicemail */},
    success: {/* SMS confirmation */}
  }
});
End of document.

