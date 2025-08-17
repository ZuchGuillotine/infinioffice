/**
 * llm_fast.js — Low-latency, chatty single-call LLM service with optional streaming
 *
 * Goals addressed:
 *  - Single OpenAI call per turn (intent + response together)
 *  - Optional token streaming to start TTS quickly (barge-in friendly)
 *  - Lightweight "micro-intent" fast path for yes/no, numbers, contact, etc.
 *  - Chatty yet goal-directed replies; collects extra, useful context naturally
 *  - Tiny, stable prompt; per-tenant info kept short; running summary instead of full history
 *  - Deterministic JSON <frame> appended to the end of the assistant response for parsing
 *  - Minimal tool/function overhead (no function calling by default)
 *
 * Integrates with: Deepgram (STT/TTS) + Twilio (voice). Streaming hooks are provided via callbacks.
 *
 * Usage:
 *  const svc = createLLMService({ model: process.env.LLM_MODEL });
 *  const result = await svc.processMessage({
 *    transcript,
 *    sessionId,
 *    context,              // { businessConfig, summary, slots, uiScripts, ... }
 *    stream: true,         // enable token streaming for TTS
 *    onTextDelta: (t) => { // send t to TTS },
 *    onTextStart: () => { // TTS start },
 *    onTextDone: (finalText) => { // finalize TTS },
 *  });
 *
 * Returns { response, intent, confidence, entities, frame, processingTime, usage }
 */

const OpenAI = require('openai');

// ---------- Config ----------
const DEFAULTS = {
  MODEL: process.env.LLM_MODEL || 'gpt-4o', // Use gpt-4o as requested by user
  TEMPERATURE: 0.4,
  MAX_TOKENS: 160, // keep it short; streaming delivers the first sentence fast
  TIMEOUT_MS: 12000, // defensive timeout per API call
  STREAM_SENTINEL_OPEN: '<frame>',
  STREAM_SENTINEL_CLOSE: '</frame>',
};

let openai = null;
function getClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ---------- Utility: micro-intent (fast path to dodge an LLM call when trivial) ----------
const YES = new Set(['yes','yep','yeah','correct','right','affirmative','sure','ok','okay','sounds good','that works']);
const NO = new Set(['no','nope','nah','negative','not really','don\'t']);

function microParse(transcript, context) {
  if (!transcript) return null;
  const t = transcript.trim().toLowerCase();

  // yes/no confirmations
  if (YES.has(t)) {
    return { intent: 'confirmation_yes', confidence: 0.95, entities: {}, reply: null };
  }
  if (NO.has(t)) {
    return { intent: 'confirmation_no', confidence: 0.95, entities: {}, reply: null };
  }

  // phone/email quick capture
  const phone = t.match(/(\+?1[- .]?)?\(?\d{3}\)?[- .]?\d{3}[- .]?\d{4}/);
  const email = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (phone || email) {
    const contact = [phone?.[0], email?.[0]].filter(Boolean).join(' ');
    return { intent: 'contact_provided', confidence: 0.9, entities: { contact }, reply: null };
  }

  // simple time phrases (tomorrow, next friday, specific times) — heuristic
  if (/(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+(week|mon|tue|wed|thu|fri|sat|sun)|\b(\d{1,2})(?:\s)?(am|pm)\b|\b\d{1,2}[:.]\d{2}\b)/i.test(t)) {
    return { intent: 'time_provided', confidence: 0.75, entities: { timeWindow: transcript }, reply: null };
  }

  // service fuzzy match against configured services (simple contains)
  const services = (context?.businessConfig?.services || []).filter(s => s.active).map(s => s.name.toLowerCase());
  if (services.length) {
    const hit = services.find(svc => t.includes(svc) || (svc.includes('tree') && /(remove|removal|take down|fell|falling)/.test(t)));
    if (hit) return { intent: 'service_provided', confidence: 0.8, entities: { service: hit }, reply: null };
  }

  return null; // fall through to LLM
}

// ---------- Prompt builder ----------
function buildPrompt({ transcript, context, sentinelOpen, sentinelClose }) {
  const orgName = context?.organizationContext?.organizationName || 'our business';
  const services = (context?.businessConfig?.services || []).filter(s => s.active).map(s => s.name);
  const shortServices = services.slice(0, 4).join(', ') || 'general appointments';

  const summary = context?.summary || '';
  const slots = context?.slots || {}; // { service, timeWindow, contact, location, notes }

  // Keep the system prompt tiny and stable for latency
  const system = `You are a friendly scheduling assistant for ${orgName}. Goal: book or collect enough info to hand off.\n` +
    `Be warm and human, a bit chatty, but keep momentum. Vary phrasing.\n` +
    `ALWAYS return a natural reply first, then on a new line append ${sentinelOpen}{...}${sentinelClose} JSON with intent + entities.\n` +
    `Never put the JSON before the natural reply. Do not include any other JSON.\n` +
    `Prefer concise first sentence so TTS can start early. Keep total under 120 tokens when possible.`;

  const state = `Known info so far (slots): ${JSON.stringify({
    service: slots.service || null,
    timeWindow: slots.timeWindow || null,
    contact: slots.contact || null,
    location: slots.location || null,
    notes: slots.notes || null,
  })}`;

  const guidelines = `Conversation style:\n` +
    `- Acknowledge specifics the caller says.\n` +
    `- Opportunistically collect useful details (e.g., hair color history, tree obstructions), but don't derail.\n` +
    `- If caller gives multiple items in one utterance, pick PRIMARY intent but capture all entities in JSON.\n` +
    `- If time is given before service, confirm/ask service next.\n` +
    `- If service is uncertain, suggest the closest match from: ${shortServices}.\n` +
    `- Soft boundaries: 3 attempts per slot before offering a callback/hand-off.\n` +
    `- Avoid repeating the same question verbatim.`;

  const jsonSpec = `JSON frame schema in ${sentinelOpen}...${sentinelClose}:\n` +
    `{"intent":"booking|service_provided|time_provided|contact_provided|confirmation_yes|confirmation_no|location_provided|digression_question|unclear",` +
    `"confidence":0.0-1.0,` +
    `"entities":{"service":"?","timeWindow":"?","contact":"?","location":"?","notes":"?"}}`;

  const user = `Caller said: "${transcript}"\n` +
    `Business services (short list): ${shortServices}\n` +
    (summary ? `Conversation summary: ${summary}\n` : '') +
    `${state}\n` +
    `Respond now. Natural reply first. Then append the JSON frame.`;

  return [
    { role: 'system', content: system },
    { role: 'system', content: guidelines },
    { role: 'system', content: jsonSpec },
    { role: 'user', content: user },
  ];
}

// ---------- Streaming helpers ----------
function createStreamSplitter({ sentinelOpen, sentinelClose, onTextDelta }) {
  let buffer = '';
  let inFrame = false;
  let frameBuffer = '';

  return {
    push(chunk) {
      buffer += chunk;

      // If the JSON frame hasn't started, stream text to TTS
      if (!inFrame) {
        const openIdx = buffer.indexOf(sentinelOpen);
        if (openIdx === -1) {
          // No frame yet — everything so far is natural text
          if (onTextDelta) onTextDelta(buffer);
          buffer = '';
          return;
        }
        // Stream text up to the frame marker
        const textPart = buffer.slice(0, openIdx);
        if (textPart && onTextDelta) onTextDelta(textPart);
        buffer = buffer.slice(openIdx + sentinelOpen.length);
        inFrame = true;
      }

      // Collect JSON frame
      if (inFrame) {
        const closeIdx = buffer.indexOf(sentinelClose);
        if (closeIdx === -1) {
          frameBuffer += buffer;
          buffer = '';
        } else {
          frameBuffer += buffer.slice(0, closeIdx);
          buffer = buffer.slice(closeIdx + sentinelClose.length);
          inFrame = false; // done
        }
      }
    },
    finalize() {
      return frameBuffer.trim();
    }
  };
}

function safeParseFrame(jsonText) {
  if (!jsonText) return { intent: 'unclear', confidence: 0, entities: {} };
  try {
    // Some models might emit trailing commas or minor issues; attempt a minimal cleanup
    const cleaned = jsonText
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s{2,}/g, ' ');
    const obj = JSON.parse(cleaned);
    const entities = obj.entities || {};
    return { intent: obj.intent || 'unclear', confidence: obj.confidence ?? 0, entities, _raw: obj };
  } catch (e) {
    return { intent: 'unclear', confidence: 0, entities: {}, error: 'FRAME_PARSE_ERROR' };
  }
}

// ---------- Main service ----------
class FastLLMService {
  constructor(options = {}) {
    this.model = options.model || DEFAULTS.MODEL;
    this.temperature = options.temperature ?? DEFAULTS.TEMPERATURE;
    this.maxTokens = options.maxTokens || DEFAULTS.MAX_TOKENS;
    this.timeoutMs = options.timeoutMs || DEFAULTS.TIMEOUT_MS;
    this.sentinelOpen = options.sentinelOpen || DEFAULTS.STREAM_SENTINEL_OPEN;
    this.sentinelClose = options.sentinelClose || DEFAULTS.STREAM_SENTINEL_CLOSE;

    // lightweight per-session summaries to shrink prompt size
    this.sessions = new Map(); // sessionId -> { summary, slots, lastResponses[] }
  }

  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { summary: '', slots: {}, lastResponses: [] });
    }
    return this.sessions.get(sessionId);
  }

  updateSummary(sessionId, transcript, frame) {
    const s = this.getSession(sessionId);
    // compress into a one-liner summary; keep max ~300 chars
    const add = [];
    if (frame?.entities?.service && !s.slots.service) add.push(`service=${frame.entities.service}`);
    if (frame?.entities?.timeWindow && !s.slots.timeWindow) add.push(`time=${frame.entities.timeWindow}`);
    if (frame?.entities?.contact && !s.slots.contact) add.push(`contact`);
    if (frame?.entities?.location && !s.slots.location) add.push(`location`);
    if (frame?.entities?.notes) add.push(`notes+`);

    const newBits = add.join(', ');
    const base = s.summary ? s.summary + ' | ' : '';
    const next = (base + newBits).trim();
    s.summary = next.slice(0, 300);

    // update slots
    s.slots = {
      ...s.slots,
      ...frame?.entities,
    };
  }

  // One public entry point per turn
  async processMessage({ transcript, sessionId = 'default', context = {}, stream = false, onTextStart, onTextDelta, onTextDone } = {}) {
    const t0 = Date.now();

    // 0) Try the micro-intent fast path
    const micro = microParse(transcript, { businessConfig: context.businessConfig });
    if (micro) {
      const s = this.getSession(sessionId);
      // Minimal canned replies for micro path (still chatty-ish but short)
      let reply = '';
      switch (micro.intent) {
        case 'confirmation_yes':
          if (!s.slots.service) reply = 'Got it! What service do you need?';
          else if (!s.slots.timeWindow) reply = `Perfect. What day or time works best for your ${s.slots.service}?`;
          else if (!s.slots.contact) reply = 'Great — what\'s the best name and number to reach you?';
          else reply = 'Awesome, I\'ll lock that in. Anything else you\'d like to add?';
          break;
        case 'confirmation_no':
          reply = 'No problem — what should we change?';
          break;
        case 'contact_provided':
          s.slots.contact = micro.entities.contact;
          reply = s.slots.service && s.slots.timeWindow ? 'Thanks! I\'ll get that scheduled. Anything else I should note?' : 'Thanks! And when would you like to come in?';
          break;
        case 'time_provided':
          s.slots.timeWindow = micro.entities.timeWindow;
          reply = s.slots.service ? 'Great — I\'ve got that window. What\'s the best contact info for you?' : 'Nice! And what service should I book you for?';
          break;
        case 'service_provided':
          s.slots.service = micro.entities.service;
          reply = s.slots.timeWindow ? 'Perfect. What\'s the best contact info to confirm?' : `Got it — ${micro.entities.service}. When works for you?`;
          break;
        default:
          reply = null;
      }

      const frame = { intent: micro.intent, confidence: micro.confidence, entities: micro.entities };
      this.updateSummary(sessionId, transcript, frame);

      console.log('🔍 DEBUG - Micro-intent result:', {
        intent: micro.intent,
        entities: micro.entities,
        reply,
        frame,
        sessionSlots: this.getSession(sessionId).slots
      });

      const dt = Date.now() - t0;
      const resp = { response: reply, intent: micro.intent, confidence: micro.confidence, entities: micro.entities, frame, processingTime: { total: dt, llm: 0, stream: false }, usage: { tokens: 0 } };

      if (stream && onTextStart) onTextStart();
      if (stream && onTextDelta && reply) onTextDelta(reply);
      if (stream && onTextDone) onTextDone(reply);

      return resp;
    }

    // 1) Build compact prompt
    const session = this.getSession(sessionId);
    const messages = buildPrompt({
      transcript,
      context: { ...context, summary: session.summary, slots: session.slots },
      sentinelOpen: this.sentinelOpen,
      sentinelClose: this.sentinelClose,
    });

    const client = getClient();
    const callParams = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      // NOTE: no tools/functions to keep latency down. The JSON frame is plain text we parse.
    };

    const tCall = Date.now();

    if (stream) {
      // Streaming path: deliver natural text immediately; collect JSON frame at the end
      
      const splitter = createStreamSplitter({
        sentinelOpen: this.sentinelOpen,
        sentinelClose: this.sentinelClose,
        onTextDelta: (txt) => onTextDelta && onTextDelta(txt),
      });

      if (onTextStart) onTextStart();

      let fullText = '';
      let usage = null;

      const streamResp = await client.chat.completions.create({ ...callParams, stream: true });
      for await (const part of streamResp) {
        const choice = part.choices?.[0];
        const delta = choice?.delta?.content || '';
        if (delta) {
          fullText += delta;
          splitter.push(delta);
        }
        // usage is only present at the end for streaming v2; guard it
        if (part.usage) usage = part.usage;
      }

      let frameJson = splitter.finalize();
      
      // CRITICAL FIX: Fallback frame extraction if splitter failed
      if (!frameJson || frameJson.length === 0) {
        const openIdx = fullText.indexOf(this.sentinelOpen);
        const closeIdx = fullText.lastIndexOf(this.sentinelClose);
        if (openIdx >= 0 && closeIdx > openIdx) {
          frameJson = fullText.slice(openIdx + this.sentinelOpen.length, closeIdx);
        }
      }
      
      if (onTextDone) onTextDone(fullText.replace(this.sentinelOpen + frameJson + this.sentinelClose, '').trim());

      const frame = safeParseFrame(frameJson);
      
      this.updateSummary(sessionId, transcript, frame);

      const dt = Date.now() - t0;
      return {
        response: fullText.replace(this.sentinelOpen + frameJson + this.sentinelClose, '').trim(),
        intent: frame.intent,
        confidence: frame.confidence,
        entities: frame.entities,
        frame,
        processingTime: { total: dt, llm: Date.now() - tCall, stream: true },
        usage: usage || {},
      };
    }

    // 2) Non-streaming path: single shot
    const resp = await client.chat.completions.create(callParams);
    const content = resp.choices?.[0]?.message?.content || '';

    const openIdx = content.indexOf(this.sentinelOpen);
    const closeIdx = content.lastIndexOf(this.sentinelClose);
    const replyText = openIdx >= 0 ? content.slice(0, openIdx).trim() : content.trim();
    const frameJson = openIdx >= 0 && closeIdx > openIdx ? content.slice(openIdx + this.sentinelOpen.length, closeIdx) : '';

    const frame = safeParseFrame(frameJson);
    this.updateSummary(sessionId, transcript, frame);

    const dt = Date.now() - t0;
    return {
      response: replyText,
      intent: frame.intent,
      confidence: frame.confidence,
      entities: frame.entities,
      frame,
      processingTime: { total: dt, llm: Date.now() - tCall, stream: false },
      usage: resp.usage || {},
    };
  }
}

// ---------- Factory ----------
function createLLMService(options) {
  return new FastLLMService(options);
}

module.exports = { createLLMService, FastLLMService };
