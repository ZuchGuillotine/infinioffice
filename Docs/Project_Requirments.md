 InfiniOffice – Unified Project Requirements Document (PRD)
Version: 1.0 (Unified)
Date: August 2025
Product Owner: [Ben Cox]
Technical Lead: [TBD]

Reconciliation Highlights (what changed & why)
Latency targets clarified: Prior drafts mixed TTS startup <300ms with overall/turn latency goals. We standardize on turn-level end-to-end latency targets (ASR partials, LLM/tool call, TTS) rather than per-component only.

MVP target: median ≤1.2s, P95 ≤1.5s per turn; ASR first partial ≤500ms; TTS time-to-first-audio ≤300ms.

Scope discipline for MVP: Kept Google Calendar + Outlook 365 as P0. Vertical CRMs (ServiceTitan, Shop-Ware/Tekmetric, Dentrix/Open Dental, HubSpot/Salesforce) are P1+ (adapters).

Stack specificity but swappable: We keep concrete choices for MVP (Twilio, Deepgram ASR/TTS, GPT-3.5 primary with GPT-4 fallback) while enforcing adapter interfaces so vendors are swappable.

Compliance framing (US-only): TCPA SMS consent, two-party consent states for recording, HIPAA-light posture for dental/clinics (no PHI in prompts/memory; encrypted storage if present).

P0 vs P1: P0 = after-hours new booking + basic reschedule/cancel, SMS confirmation, transcripts, minimal dashboard, Stripe basic. P1 adds CRM sync, analytics depth, white label, BYOC, multilingual.

1) Executive Summary
Vision
InfiniOffice enables SMBs to capture after-hours revenue by answering calls with a natural voice agent that books appointments, handles basic changes, and confirms via SMS—reliably, quickly, and at unit costs that support tiered pricing.

Why now
SMBs in Home Services, Auto Repair, and Dental miss a material share of calls after-hours. Replacing voicemail with an always-on, low-latency agent produces immediate lift in booked jobs with minimal change management.

MVP outcomes (90 days)

Handle real inbound calls for pilot customers with >85% booking success on eligible intents.

Turn latency median ≤1.2s, P95 ≤1.5s under 50 concurrent calls.

Cost per 5-min call ≤$0.50 at MVP volumes.

Seamless fallbacks: voicemail or SMS booking link if systems degrade.

2) Goals & Success Metrics
G1. Answer-after-hours conversion: reduce missed calls by ≥60% at pilot sites.

G2. Booking success (eligible intents): ≥85% (MVP), ≥90% (post-pilot).

G3. Latency SLOs: median ≤1.2s, P95 ≤1.5s per turn (ASR→LLM→TTS).

G4. Reliability: 99.9% call handling availability; graceful degradation.

G5. CSAT proxy: <10% “operator request” or hang-up due to UX/friction.

G6. Unit economics: 5-min call ≤$0.50 COGS at MVP volumes.

3) Scope
In-Scope (MVP / P0)
Telephony: US inbound voice via CPaaS (Twilio). DTMF capture; recording with consent bannering.

Streaming pipeline: ASR (partials), LLM orchestration with tool calling, streaming TTS, barge-in.

Intents: new booking, reschedule, cancel, hours/location; lightweight service menu.

Slot strategy: service, duration, provider (optional), time window, contact number, notes.

Scheduling: Google Calendar (OAuth), Outlook 365/Graph (OAuth). Conflict detection; SMS confirmation.

Fallbacks: voicemail handoff; SMS booking link when API errors; human escalation number.

Config: business hours, holiday calendar, greeting, service catalog/durations, provider list, SMS consent copy.

Observability: transcripts with timestamps, turn traces, outcomes; basic dashboard.

Billing: Stripe subscriptions (tiered); usage counters for bookings/minutes.

Security/Compliance: TLS 1.2+/1.3, at-rest encryption, SMS consent capture, US recording consent prompts; HIPAA-light defaults.

Near-Term (P1)
CRMs: HubSpot, Salesforce; Verticals: ServiceTitan/Housecall Pro/Jobber; Shop-Ware/Tekmetric; Open Dental/Dentrix/Eaglesoft (where feasible).

Analytics: funnel, containment, WER, latency heatmaps, cost per call.

White labeling; multi-language (Spanish first); BYOC/SIP trunking options.

Audit & governance: retention policies, redaction, export.

Out-of-Scope (for MVP)
Payment collection by phone, insurance eligibility checks, custom voice cloning, full EMR writeback.

4) Target Users & Verticals
Primary Verticals (phase order):

Residential Home Services (HVAC, Plumbing, Electrical)

Automotive Repair

Dental Practices & Clinics (HIPAA-light)

(P1) Beauty/Wellness (salons/spas)

Personas

Owner/Manager: wants revenue capture after-hours.

Office Admin: wants fewer voicemails to return; clear calendar entries.

IT Admin: wants simple, secure, low-touch setup.

5) Architecture Overview
MVP Reference Stack (swappable adapters)

Telephony/Call Control: Twilio Programmable Voice (SIP/PSTN, webhooks, media streams, DTMF, recording).

ASR: Deepgram/Google streaming ASR (partials, endpointing, biasing).

Orchestration: Deterministic state machine + tool calling (LangGraph/Temporal pattern).

LLM: GPT-3.5 (primary) + GPT-4 (escalations/edge).

TTS: Deepgram TTS (streaming; SSML; barge-in friendly).

Scheduling Adapters: Google Calendar, Outlook 365 (P0); CRM/verticals as P1 adapters.

Data Plane: Redis (session/state cache), Postgres (multi-tenant config, call logs, audit), S3 (recordings/transcripts with retention).

Observability: OpenTelemetry traces by turn; dashboards; alerting on error/latency spikes.

Turn pipeline (target budget)
Caller audio → ASR partial (≤500ms) → LLM+tools (200–600ms avg) → TTS TTFB (≤300ms) → audio stream; barge-in cancels pending TTS.

Failure modes & graceful degrade

ASR stall → retry; fall back to DTMF menu for booking window selection.

Calendar API timeout → SMS booking link + email summary to business.

LLM/tool failure → deterministic fallback script; voicemail drop.

Telephony incident → overflow to prior answering service number.

6) Functional Requirements
6.1 Voice Agent Core (P0)
Answer within 2 rings; present consent message where required.

Streaming ASR with partials; endpointer for fast turns; barge-in supported.

Deterministic state machine for critical paths (confirmations, time slots, phone).

Tool calls: calendar availability lookup, create/update/delete events.

Interrupt handling, repetition, slow/fast speech control (accessibility).

6.2 Business Configuration (P0)
Wizard to complete setup in <15 minutes: hours, services/durations, providers, holidays, SMS copy, escalation number.

Voice/greeting selection; script templates by vertical; optional custom keywords for ASR.

6.3 Calendar & Scheduling (P0)
OAuth to connect Google/Outlook (tenant-scoped).

Availability check with conflict detection & timezone handling.

Create/cancel/reschedule events; include caller info & notes.

SMS confirmation with opt-in; email fallback.

6.4 CRM Integrations (P1)
HubSpot/Salesforce: create/update contact; log call as activity; map custom fields.

6.5 Analytics & Reporting (P1)
Calls table: timestamps, outcomes (booked/failed/voicemail), durations, costs.

Transcripts & recordings (retention policy); export CSV.

6.6 User Management (P0)
Email/password; Google OAuth; RBAC (Org Admin, Operator, Viewer); reset flows.

6.7 Billing & Subscription (P0)
Stripe: plans, metered usage (bookings/minutes), upgrade/downgrade, invoices.

6.8 White-Label (P2)
Branding (logo/colors), subdomain; branded emails/SMS.

7) Non-Functional Requirements
Performance
Turn latency: median ≤1.2s, P95 ≤1.5s under 50 concurrent calls (MVP).

ASR first partial: ≤500ms; TTS TTFB: ≤300ms.

Concurrency: MVP 100 concurrent calls without material degradation; roadmap to 1,000 with autoscaling.

Reliability
Availability: 99.9% call handling; circuit breakers & retries for external APIs.

Resilience: operate through single component failure; queue & retry calendar writes.

Security
TLS 1.2+/1.3; AES-256 at rest; least-privilege; secrets in KMS/Parameter Store.

OWASP ASVS controls; per-tenant isolation; rate limiting & WAF.

Scalability
Stateless workers; horizontal autoscaling; Redis for ephemeral session state.

Partitioned Postgres; archival strategy for call logs & recordings.

Compliance (US-only)
Recording consent: two-party consent state bannering; toggle recording by tenant.

TCPA: SMS opt-in capture; opt-out (STOP/HELP).

HIPAA-light: avoid PHI in prompts/memory; if present, encrypt & restrict; configurable retention & BAA for clinics (P1).

8) Conversation Design (MVP Pack)
Core intents: new booking, reschedule, cancel, hours/location, service options (brief).
Slots: service, duration, provider (optional), date/time window, phone, notes.
Grounding: quote constraints back (“You prefer after 3pm next Tuesday with Dr. Lee; ok?”).
Disambiguation: offer top 2–3 slot options; confirm via natural language or DTMF.
No availability: propose next-best; offer waitlist/SMS link.
Reschedules/cancels: lookup by phone/time; confirm change & send SMS.
Compliance guardrails: no medical/legal advice; emergency disclaimer (“If this is an emergency, please hang up and dial 911.”); SMS consent prompt.
Accessibility: adjustable speech rate; repeat/confirm patterns; avoid jargon.

9) Data, Privacy, Governance
Minimize PII: store phone, name, booking fields only; redact payment/SSNs if spoken.

Retention: tenant-configurable (e.g., transcripts 30–90 days; recordings optional).

Audit: immutable logs for bookings/cancellations with actor and timestamp.

Exports: per-tenant export (CSV/JSON) on demand.

10) Observability & Ops
Tracing: per turn (ASR latency, LLM latency, TTS TTFB, tool timings).

Health: SLO dashboards; alerts on error surge, WER degradation, latency spikes.

Synthetic tests: hourly call to golden number; verify booking round-trip.

Replay: anonymized transcript replays to regression-test flows.

Cost monitors: per-call COGS breakdown (telephony, ASR, LLM, TTS).

11) Release Plan
Phase 1 – MVP (Weeks 1–12)
W1–4: Twilio wiring; streaming ASR/TTS; state machine; GPT-3.5 + tool calls; Google/Outlook adapters; SMS confirm; dashboard v0; Stripe basic; P0 scripts/templates.

W5–8: Latency tuning; failovers (voicemail/SMS/human); security hardening; synthetic test rig; pilot configs.

W9–12: 2–3 pilots per priority vertical (Home Services, Auto, Dental); daily monitoring; achieve booking success ≥85%.

Phase 2 – Scale (Months 4–6)
CRM adapters (HubSpot, Salesforce); first vertical CRM (ServiceTitan or Tekmetric); analytics v1; Spanish; BYOC option; white-label basics.

Phase 3 – Optimize (Months 7–12)
Voice persona enhancements; vertical model tuning; additional CRMs; SOC 2 readiness; self-hosted options for large tenants.

12) Acceptance Criteria (MVP)
 ≥100 real pilot calls completed; ≥85% booking success (eligible intents).

 Latency: median ≤1.2s, P95 ≤1.5s per turn (pilot hours).

 Availability: ≥99.9% call handling with graceful fallbacks proven.

 Stripe live; invoices generated; metered counters correct.

 Security review passed; logging & retention policies enabled.

 Dashboard shows calls, outcomes, transcripts; export works.

13) Risks & Mitigations
Risk	Prob.	Impact	Mitigation
Latency spikes under load	Med	High	Prewarm models, ASR biasing, connection pooling, autoscale; degrade to DTMF menu if needed
Vendor/API rate limits	Med	Med	Backoff, multi-vendor adapters, queueing, idempotent writes
WER on names/addresses	Med	Med	Custom vocabulary, post-correction on NER, disambiguation prompts
HIPAA/PHI drift	Low	High	Guardrails in prompts; redact; PHI-free memory; configurable retention
Recording consent gaps	Low	High	Per-state bannering; tenant toggles; legal review
Calendar conflicts	Med	Med	Re-read-after-write; transactional booking with retry & SMS confirmation
Cost overruns (LLM)	Med	Med	Use GPT-3.5 primary, “escalate-on-fail”; token budgets; short system prompts

14) Open Questions
Pilot mix: confirm 2–3 named pilot customers per vertical.

SMS brand registration (A2P 10DLC): who owns registration per tenant?

Recording defaults: on or off for MVP; retention window?

No-show handling: add optional reminder SMS 24h prior (P1)?

BYOC roadmap: at what volume threshold to prioritize?

15) Appendices
A. Minimal Data Model (high level)
Tenant(id, name, plan, configs, sms_branding)

User(id, tenant_id, role, auth)

BusinessConfig(tenant_id, hours, holidays, services, providers, escalation_number, sms_copy)

Integration(tenant_id, type, oauth_tokens, scopes, status)

Call(id, tenant_id, started_at, ended_at, outcome, recording_uri, cost_breakdown, metrics)

Turn(call_id, idx, asr_ms, llm_ms, tts_ms, transcript_in, transcript_out)

Appointment(id, tenant_id, calendar_id, external_id, start, end, service, provider, contact_phone, notes, status)

B. Canonical Call Flow (MVP)
Greeting + consent → “If you’d like, I can book you now. Is this for repair or maintenance?”

Slot collection → service → time window → provider (optional) → name/phone confirm.

Availability check (tool call) → offer top 2–3 slots → confirm.

Book → confirm verbally → SMS confirmation with details.

Edge cases → no availability → propose next best / SMS link; reschedule/cancel flow; hours/location info; escalate to voicemail/human as configured.

MVP P0 Backlog (checklist)
 Twilio inbound number + webhooks + media streams + DTMF

 ASR (Deepgram/Google) streaming with partials + biasing

 TTS (Deepgram) streaming with SSML + barge-in control

 State machine + tool calling (LangGraph/Temporal pattern)

 GPT-3.5 prompts + guardrails; GPT-4 escalation path

 Google Calendar & Outlook adapters (OAuth, conflict detection)

 SMS provider setup, consent and opt-out flows (A2P registration)

 Config wizard (<15 min): hours, services, providers, greetings, escalation

 Observability: traces, logs, transcripts, outcome tags, alerts

 Stripe plans + metered usage + invoices

 Security: KMS, RBAC, rate limits, retention defaults, audit logs

 Synthetic test harness (golden path; noisy/accent set)