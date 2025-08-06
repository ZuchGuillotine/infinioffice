
# Sprint 01: Core Prototype Development

## Week 1-2: Core Infrastructure

- [x] Twilio numbers + Media Streams webhook (bi-directional)
- [x] Express/Fastify server with WebSocket/HTTP
- [x] PostgreSQL schema (calls, turns, appointments); **time-based partitions**
- [x] Redis for session state; S3 bucket for recordings (optional)

## Week 3: Voice Pipeline Integration

- [x] Deepgram ASR streaming + biasing
- [x] AWS Polly TTS streaming (PCM 8kHz); **barge-in cancel policy**
- [ ] μ-law/PCM conversion as needed for PSTN
- [ ] Achieve ≤1.5s turn latency (median ≤1.2s)

## Week 4: Dialogue System

- [x] XState slot-gated booking flow
- [x] OpenAI GPT-3.5 with function calls; **max_tokens: 120**
- [ ] Tool timeouts + SMS/voicemail fallback
- [ ] Calendar idempotency + retries
