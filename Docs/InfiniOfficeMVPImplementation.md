# InfiniOffice MVP Implementation Guide

## Executive Summary

Based on market analysis, we're pivoting to a **"assemble, then optimize"** approach using proven cloud services. This guide outlines the 90-day MVP implementation focusing on rapid deployment and real-world validation.

## Week-by-Week Implementation Plan

### Weeks 1-2: Foundation Setup

#### Telephony Infrastructure (Twilio)
```javascript
// 1. Twilio Account Setup
- Register and verify business account
- Purchase local phone numbers for each pilot customer
- Configure geographic redundancy

// 2. Media Streams Webhook
app.post('/voice/incoming', (req, res) => {
  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect();
  connect.stream({
    url: 'wss://your-app.com/media-stream'
  });
  res.type('text/xml');
  res.send(response.toString());
});

// 3. WebSocket Handler for Audio
wss.on('connection', (ws) => {
  let deepgramSocket;
  
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    
    if (data.event === 'media') {
      // Forward audio to Deepgram
      if (deepgramSocket?.readyState === WebSocket.OPEN) {
        deepgramSocket.send(data.media.payload);
      }
    }
  });
});
```

#### Database Schema
```sql
-- Minimal MVP Schema
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  phone_number VARCHAR(20),
  timezone VARCHAR(50),
  settings JSONB
);

CREATE TABLE calls (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  caller_phone VARCHAR(20),
  duration_seconds INT,
  transcript TEXT,
  booking_created BOOLEAN,
  created_at TIMESTAMP
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  call_id UUID REFERENCES calls(id),
  customer_name VARCHAR(255),
  service_type VARCHAR(100),
  appointment_time TIMESTAMP,
  status VARCHAR(50)
);
```

### Weeks 3-4: Voice Pipeline Integration

#### Deepgram ASR Setup
```javascript
const { Deepgram } = require('@deepgram/sdk');
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

async function createASRConnection(callId) {
  const connection = await deepgram.transcription.live({
    model: 'nova-2-phonecall',
    language: 'en-US',
    punctuate: true,
    interim_results: true,
    endpointing: 300,
    keywords: getBusinessKeywords(callId) // Boost accuracy
  });
  
  connection.on('transcriptReceived', (transcript) => {
    const text = transcript.channel.alternatives[0].transcript;
    if (text && transcript.is_final) {
      handleUserInput(callId, text);
    }
  });
  
  return connection;
}
```

#### AWS Polly TTS Configuration
```javascript
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const polly = new PollyClient({ region: 'us-east-1' });

async function synthesizeSpeech(text, voiceId = 'Joanna') {
  const command = new SynthesizeSpeechCommand({
    Text: `<speak>${text}</speak>`,
    TextType: 'ssml',
    OutputFormat: 'pcm',
    SampleRate: '8000', // Phone quality
    VoiceId: voiceId,
    Engine: 'neural'
  });
  
  const response = await polly.send(command);
  return response.AudioStream;
}

// Cache common phrases
const phraseCache = new Map();
async function getTTSAudio(text) {
  if (phraseCache.has(text)) {
    return phraseCache.get(text);
  }
  const audio = await synthesizeSpeech(text);
  phraseCache.set(text, audio);
  return audio;
}
```

### Weeks 5-6: Dialogue System

#### State Machine for Booking Flow
```javascript
const { createMachine, interpret } = require('xstate');

const bookingMachine = createMachine({
  id: 'booking',
  initial: 'greeting',
  context: {
    customerName: null,
    serviceType: null,
    preferredTime: null,
    phoneNumber: null
  },
  states: {
    greeting: {
      entry: 'sayGreeting',
      on: {
        USER_INPUT: {
          target: 'identifyIntent',
          actions: 'processInput'
        }
      }
    },
    identifyIntent: {
      invoke: {
        src: 'classifyIntent',
        onDone: [
          { target: 'collectName', cond: 'isBooking' },
          { target: 'handleInquiry', cond: 'isInquiry' },
          { target: 'escalate', cond: 'isComplex' }
        ]
      }
    },
    collectName: {
      entry: 'askForName',
      on: {
        USER_INPUT: {
          target: 'collectService',
          actions: 'saveName'
        }
      }
    },
    collectService: {
      entry: 'askForService',
      on: {
        USER_INPUT: {
          target: 'collectTime',
          actions: 'saveService'
        }
      }
    },
    collectTime: {
      entry: 'askForTime',
      on: {
        USER_INPUT: {
          target: 'checkAvailability',
          actions: 'saveTime'
        }
      }
    },
    checkAvailability: {
      invoke: {
        src: 'checkCalendar',
        onDone: [
          { target: 'confirmBooking', cond: 'isAvailable' },
          { target: 'suggestAlternative', cond: 'hasAlternatives' }
        ]
      }
    },
    confirmBooking: {
      entry: 'sayConfirmation',
      on: {
        USER_INPUT: [
          { target: 'createBooking', cond: 'isConfirmed' },
          { target: 'collectTime', cond: 'needsChange' }
        ]
      }
    },
    createBooking: {
      invoke: {
        src: 'bookAppointment',
        onDone: 'success',
        onError: 'error'
      }
    },
    success: {
      entry: 'saySuccess',
      type: 'final'
    },
    escalate: {
      entry: 'offerCallback',
      type: 'final'
    },
    error: {
      entry: 'apologizeAndFallback',
      type: 'final'
    }
  }
});
```

#### GPT-3.5 Intent Recognition
```javascript
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function classifyIntent(userInput, context) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-1106',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `You are analyzing phone calls for a ${context.businessType}. 
                  Classify the intent and extract key information.`
      },
      {
        role: 'user',
        content: userInput
      }
    ],
    functions: [
      {
        name: 'classify_intent',
        parameters: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              enum: ['booking', 'inquiry', 'reschedule', 'cancel', 'complex']
            },
            extracted_info: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                service: { type: 'string' },
                preferred_time: { type: 'string' }
              }
            },
            confidence: { type: 'number' }
          }
        }
      }
    ],
    function_call: { name: 'classify_intent' }
  });
  
  return JSON.parse(completion.choices[0].message.function_call.arguments);
}
```

### Weeks 7-8: Calendar Integration

#### Google Calendar Integration
```javascript
const { google } = require('googleapis');
const calendar = google.calendar('v3');

async function checkAvailability(dateTime, duration = 60) {
  const auth = await getOAuthClient();
  
  const response = await calendar.freebusy.query({
    auth,
    requestBody: {
      timeMin: dateTime,
      timeMax: addMinutes(dateTime, duration),
      items: [{ id: 'primary' }]
    }
  });
  
  const busy = response.data.calendars.primary.busy;
  return busy.length === 0;
}

async function createAppointment(booking) {
  const auth = await getOAuthClient();
  
  const event = {
    summary: `${booking.service} - ${booking.customerName}`,
    description: `Phone: ${booking.phoneNumber}\nBooked via InfiniOffice`,
    start: {
      dateTime: booking.dateTime,
      timeZone: booking.timezone
    },
    end: {
      dateTime: addMinutes(booking.dateTime, booking.duration),
      timeZone: booking.timezone
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 }
      ]
    }
  };
  
  const response = await calendar.events.insert({
    auth,
    calendarId: 'primary',
    requestBody: event
  });
  
  return response.data;
}
```

### Weeks 9-12: Pilot Deployment

#### Vertical-Specific Configuration

```javascript
// Configuration Templates
const verticalTemplates = {
  hvac: {
    greeting: "Thanks for calling {businessName}. I'm their virtual assistant. How can I help you today?",
    services: [
      { name: 'AC Repair', duration: 90 },
      { name: 'Heating Repair', duration: 90 },
      { name: 'Maintenance', duration: 60 },
      { name: 'Emergency Service', duration: 120 }
    ],
    keywords: ['furnace', 'air conditioner', 'hvac', 'heating', 'cooling'],
    emergencyHandling: true
  },
  
  automotive: {
    greeting: "Thank you for calling {businessName}. How can we help with your vehicle today?",
    services: [
      { name: 'Oil Change', duration: 30 },
      { name: 'Brake Service', duration: 90 },
      { name: 'General Inspection', duration: 60 },
      { name: 'Tire Service', duration: 45 }
    ],
    keywords: ['brake', 'oil', 'tire', 'engine', 'transmission'],
    collectVehicleInfo: true
  },
  
  dental: {
    greeting: "Thank you for calling {businessName}. I can help schedule your appointment.",
    services: [
      { name: 'Cleaning', duration: 60 },
      { name: 'Consultation', duration: 30 },
      { name: 'Emergency', duration: 90 }
    ],
    keywords: ['tooth', 'teeth', 'cleaning', 'dental', 'dentist'],
    hipaaCompliant: true
  },
  
  salon: {
    greeting: "Thanks for calling {businessName}! I'd be happy to book your appointment.",
    services: [
      { name: 'Haircut', duration: 45 },
      { name: 'Color', duration: 120 },
      { name: 'Highlights', duration: 150 },
      { name: 'Manicure', duration: 45 },
      { name: 'Pedicure', duration: 60 }
    ],
    keywords: ['hair', 'color', 'cut', 'style', 'nails'],
    preferredStylist: true
  }
};
```

#### Monitoring Dashboard

```javascript
// Real-time Metrics Collection
const metrics = {
  callsHandled: 0,
  bookingsCreated: 0,
  averageCallDuration: 0,
  averageLatency: 0,
  failureRate: 0,
  costPerCall: 0
};

function trackCall(callData) {
  metrics.callsHandled++;
  
  if (callData.bookingCreated) {
    metrics.bookingsCreated++;
  }
  
  // Track latency
  const latencies = callData.turnLatencies;
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  metrics.averageLatency = 
    (metrics.averageLatency * (metrics.callsHandled - 1) + avgLatency) / 
    metrics.callsHandled;
  
  // Calculate cost
  const cost = calculateCallCost(callData);
  metrics.costPerCall = 
    (metrics.costPerCall * (metrics.callsHandled - 1) + cost) / 
    metrics.callsHandled;
  
  // Send to monitoring service
  sendToCloudWatch(metrics);
}

function calculateCallCost(callData) {
  const costs = {
    twilio: callData.duration * 0.0085 / 60,
    deepgram: callData.duration * 0.0043 / 60,
    openai: callData.tokens * 0.002 / 1000,
    polly: callData.ttsCharacters * 0.000016
  };
  
  return Object.values(costs).reduce((a, b) => a + b, 0);
}
```

## Pilot Success Criteria

### Key Metrics
- **Booking Success Rate**: >85%
- **Average Turn Latency**: <1 second
- **Cost Per Call**: <$0.50
- **Customer Satisfaction**: No worse than voicemail
- **System Uptime**: 99.9% during pilot

### Daily Review Checklist
- [ ] Review all call transcripts
- [ ] Identify failed bookings and root causes
- [ ] Check latency metrics
- [ ] Monitor cost per call
- [ ] Gather customer feedback
- [ ] Update scripts based on common issues
- [ ] Adjust ASR keywords for accuracy

### Weekly Iterations
1. **Week 9**: Initial deployment, baseline metrics
2. **Week 10**: Script refinements based on real calls
3. **Week 11**: Performance optimizations
4. **Week 12**: Documentation and scale preparation

## Cost Analysis

### Per-Call Breakdown (5-minute average)
| Component | Cost | Notes |
|-----------|------|-------|
| Twilio PSTN | $0.04 | $0.0085/min |
| Deepgram ASR | $0.02 | $0.0043/min |
| GPT-3.5 | $0.01 | ~2K tokens |
| AWS Polly TTS | $0.04 | ~2.5 min speech |
| Infrastructure | $0.02 | AWS costs |
| **Total** | **$0.13** | 88% margin at $1.20/call |

### Monthly Pilot Costs (per customer)
- 100 calls/month: $13
- Infrastructure: $20
- **Total**: $33/customer
- **Revenue**: $99-299/customer
- **Margin**: 67-89%

## Risk Mitigation

### Technical Risks
1. **High Latency**
   - Mitigation: Pre-warm Lambda functions, use connection pooling
   - Fallback: Offer callback if latency >2 seconds

2. **ASR Accuracy Issues**
   - Mitigation: Custom keywords, dual ASR providers
   - Fallback: "Press 1 for yes, 2 for no" DTMF

3. **Integration Failures**
   - Mitigation: Queue bookings for retry
   - Fallback: Email/SMS notification to business

### Business Risks
1. **Poor Adoption**
   - Mitigation: White-glove onboarding, daily check-ins
   - Solution: Iterate based on feedback

2. **Compliance Concerns**
   - Mitigation: Call recording consent, data encryption
   - Solution: Minimal data retention, no medical details

## Next Steps After MVP

### Immediate Optimizations (Month 4)
1. Spanish language support
2. CRM integrations (HubSpot, ServiceTitan)
3. Advanced analytics dashboard
4. A/B testing framework

### Scale Preparations (Month 5-6)
1. Load testing for 1000+ concurrent calls
2. Multi-region deployment
3. Enterprise security audit
4. White-label customization

### Revenue Expansion (Month 7+)
1. Tiered pricing with usage bands
2. Premium features (custom voices, priority support)
3. API access for developers
4. Vertical-specific marketplace

## Conclusion

This MVP focuses on proving value quickly with real customers. By using battle-tested services (Twilio, Deepgram, OpenAI) and focusing on four high-value verticals, we can validate product-market fit within 90 days and scale from there.