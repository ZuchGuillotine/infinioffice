# InfiniOffice Audio Pipeline Deployment Guide

## Overview
This guide covers deploying the InfiniOffice audio pipeline with Deepgram STT/TTS and Twilio integration.

## Prerequisites

1. **API Keys Required:**
   - Deepgram API key (for STT and TTS)
   - OpenAI API key (for LLM processing)
   - Twilio Account SID and Auth Token
   - Twilio Phone Number

2. **Tools Installed:**
   - Node.js (v18+)
   - ngrok (configured with auth token ✅)
   - PostgreSQL database (optional - has fallback mode)

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Deepgram Configuration
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# OpenAI Configuration  
OPENAI_API_KEY=your_openai_api_key_here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Database (optional)
DATABASE_URL=postgresql://username:password@localhost:5432/infinioffice

# Default Organization ID (optional)
DEFAULT_ORG_ID=00000000-0000-0000-0000-000000000001
```

## Deployment Steps

### 1. Verify Audio Pipeline

```bash
# Run the verification script
node verify-audio-pipeline.js
```

This will test all components and provide a health report.

### 2. Start the Server

```bash
# Install dependencies
npm install

# Start the server
node src/index.js
```

The server will start on port 3000.

### 3. Expose with ngrok

In a separate terminal:

```bash
# Expose the local server
ngrok http 3000
```

Copy the HTTPS ngrok URL (e.g., `https://abc123.ngrok-free.app`).

### 4. Configure Twilio Webhook

1. Go to your Twilio Console
2. Navigate to Phone Numbers → Manage → Active numbers
3. Click on your Twilio phone number
4. Set the webhook URL to: `https://your-ngrok-url.ngrok-free.app/voice`
5. Set HTTP method to `POST`
6. Save the configuration

## Testing the Pipeline

### Manual Test Call

1. Call your Twilio phone number
2. You should hear: "Hello! I'm here to help you schedule an appointment. How can I assist you today?"
3. Try speaking: "I'd like to book an appointment"
4. The system should respond and guide you through the booking process

### API Endpoints

- **Health Check:** `GET /health`
- **Performance Metrics:** `GET /metrics`
- **Root:** `GET /`

Example:
```bash
curl https://your-ngrok-url.ngrok-free.app/health
```

## Audio Pipeline Features

### Real-time Processing
- **STT:** Deepgram Nova model with interim results
- **LLM:** OpenAI GPT-3.5-turbo with intent detection  
- **TTS:** Deepgram Aura TTS streaming
- **Target Latency:** <1.5 seconds end-to-end

### Advanced Features
- **Barge-in Detection:** Interrupts TTS when user starts speaking
- **Conversation Timeouts:** Handles silence and inactivity
- **Error Recovery:** Graceful handling of API failures
- **Performance Monitoring:** Real-time metrics and database logging
- **State Management:** XState-based conversation flow

### Conversation Flow
1. **Greeting:** Initial welcome message
2. **Service Collection:** What type of appointment?
3. **Time Collection:** When would you like to schedule?
4. **Contact Collection:** Name and phone number
5. **Confirmation:** Confirm all details
6. **Booking:** Create the appointment
7. **Success/Fallback:** Final confirmation or error handling

## Monitoring and Debugging

### Real-time Logs
The application provides detailed console logging for:
- WebSocket connections
- STT transcription results
- LLM intent detection and responses
- TTS generation and streaming
- State machine transitions
- Performance metrics

### Performance Metrics
Access real-time metrics at `/metrics` endpoint:
```json
{
  "timestamp": 1625097600000,
  "performanceStats": {
    "activeTurns": 0,
    "averageProcessingTime": 1245,
    "phaseBreakdown": {
      "llm": { "avg": 650, "count": 10 },
      "tts": { "avg": 595, "count": 10 }
    }
  },
  "targetLatency": 1500
}
```

## Common Issues and Solutions

### 1. "STT connection failed"
- Check DEEPGRAM_API_KEY is set correctly
- Verify Deepgram account has sufficient credits
- Check network connectivity

### 2. "TTS generation failed"  
- Check DEEPGRAM_API_KEY has TTS permissions
- Verify API quota limits
- Check audio format compatibility

### 3. "LLM processing failed"
- Check OPENAI_API_KEY is valid
- Verify API quota and rate limits
- Check model availability

### 4. "Twilio webhook timeout"
- Check ngrok is running and URL is correct
- Verify server is responding on port 3000
- Check Twilio webhook configuration

### 5. Database Connection Issues
- Application runs in fallback mode without database
- Check DATABASE_URL format
- Verify PostgreSQL is running and accessible

## Scaling Considerations

### Production Deployment
- Use a process manager (PM2, systemd)
- Set up proper SSL certificates (not ngrok)
- Configure load balancing for multiple instances
- Set up monitoring and alerting
- Use a proper database setup with connection pooling

### Performance Optimization
- Monitor and optimize LLM prompt efficiency
- Implement connection pooling for Deepgram
- Cache common TTS responses
- Optimize database queries
- Consider CDN for static assets

## Security Notes

- Never expose API keys in client-side code
- Use Twilio request validation in production
- Implement rate limiting for API endpoints
- Set up proper CORS policies
- Use HTTPS in production (not HTTP)

## Support

For issues with this deployment:
1. Check the console logs for detailed error messages
2. Run the verification script to identify component issues
3. Check API service status pages (Deepgram, OpenAI, Twilio)
4. Verify environment variable configuration