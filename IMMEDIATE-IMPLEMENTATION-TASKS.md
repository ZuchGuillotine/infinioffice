# Immediate Implementation Tasks for STT-LLM-TTS Pipeline

## 🚨 **Critical Issues to Fix First**

### **1. Fix Integration Test Issues**
**Problem**: Integration tests are failing due to mock initialization issues.

**Solution**:
```javascript
// Fix tests/integration/voicePipeline.test.js
// Move mock imports to top of file
const { 
  mockDeepgramSTT,
  mockOpenAI,
  mockDeepgramTTS 
} = require('../mocks/services');

// Then use in jest.mock calls
jest.mock('@deepgram/sdk', () => ({
  ...mockDeepgramSTT,
  createClient: mockDeepgramTTS.createClient
}));
```

**Tasks**:
- [ ] Fix mock initialization order in `tests/integration/voicePipeline.test.js`
- [ ] Update mock services to match actual service interfaces
- [ ] Add proper error handling in mocks
- [ ] Test integration tests locally

### **2. Environment Configuration**
**Problem**: Missing environment configuration and validation.

**Solution**:
```javascript
// Create src/config/index.js
const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  OPENAI_API_KEY: Joi.string().required(),
  DEEPGRAM_API_KEY: Joi.string().required(),
  TWILIO_ACCOUNT_SID: Joi.string().required(),
  TWILIO_AUTH_TOKEN: Joi.string().required(),
  // Add other required env vars
});

const { error, value: envVars } = envSchema.validate(process.env);
if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

module.exports = envVars;
```

**Tasks**:
- [ ] Create `src/config/index.js` with environment validation
- [ ] Create `.env.example` file with all required variables
- [ ] Add environment validation to application startup
- [ ] Document all required environment variables

### **3. Audio Pipeline Coordination**
**Problem**: Real-time audio streaming coordination needs improvement.

**Solution**:
```javascript
// Enhance src/index.js WebSocket handling
ws.on('message', async (message) => {
  try {
    const { event, stream, callSid } = JSON.parse(message);
    
    if (event === 'media' && stream) {
      // 1. Buffer audio chunks
      const audioBuffer = Buffer.from(stream, 'base64');
      
      // 2. Send to STT service
      const transcription = await getTranscription(audioBuffer);
      
      // 3. Process with LLM
      const llmResult = await processMessage(transcription, sessionId, context);
      
      // 4. Generate TTS response
      const speechStream = await getSpeech(llmResult.response);
      
      // 5. Send back to Twilio
      speechStream.pipe(ws, { end: false });
    }
  } catch (error) {
    console.error('Pipeline error:', error);
    // Send error response
  }
});
```

**Tasks**:
- [ ] Implement audio chunk buffering
- [ ] Add real-time audio streaming coordination
- [ ] Implement proper error handling for audio pipeline
- [ ] Add audio format validation

## 🔧 **Implementation Details**

### **Task 1: Fix Integration Tests**

**File**: `tests/integration/voicePipeline.test.js`

**Changes needed**:
1. Fix mock import order
2. Update mock implementations
3. Add proper error handling
4. Test locally

**Steps**:
```bash
# 1. Fix the test file
# 2. Run tests locally
npm test -- --testPathPatterns="voicePipeline"

# 3. Verify all tests pass
npm test -- --testPathPatterns="voicePipeline" --verbose
```

### **Task 2: Environment Configuration**

**Files to create/modify**:
1. `src/config/index.js` - Environment validation
2. `.env.example` - Example environment variables
3. `src/index.js` - Add environment validation on startup

**Steps**:
```bash
# 1. Create config directory and files
mkdir -p src/config
touch src/config/index.js
touch .env.example

# 2. Add environment validation
# 3. Test configuration locally
# 4. Document required variables
```

### **Task 3: Audio Pipeline Enhancement**

**Files to modify**:
1. `src/index.js` - WebSocket handling
2. `src/services/stt.js` - Audio processing
3. `src/services/tts.js` - Audio response

**Steps**:
```bash
# 1. Enhance WebSocket handling
# 2. Add audio buffering
# 3. Implement real-time coordination
# 4. Test with mock audio
```

## 🧪 **Testing Strategy**

### **Unit Tests**
```bash
# Test individual services
npm test stt.test.js
npm test llm.test.js
npm test tts.test.js
npm test stateMachine.test.js
npm test telephony.test.js
```

### **Integration Tests**
```bash
# Test complete pipeline
npm test voicePipeline.test.js
```

### **Manual Testing**
```bash
# Start application
npm start

# Test with curl or Postman
curl -X POST http://localhost:3000/voice \
  -H "Content-Type: application/json" \
  -d '{"event": "media", "stream": "base64audio"}'
```

## 📊 **Success Criteria**

### **Technical Success**
- [ ] All integration tests passing
- [ ] Environment configuration working
- [ ] Audio pipeline processing correctly
- [ ] Error handling implemented
- [ ] Performance targets met

### **Functional Success**
- [ ] End-to-end conversation flow working
- [ ] Audio streaming coordination working
- [ ] State machine transitions working
- [ ] Database logging working
- [ ] Error recovery working

## 🚀 **Next Steps After Completion**

1. **Performance Optimization**
   - Add latency monitoring
   - Optimize audio processing
   - Implement caching

2. **Production Readiness**
   - Add monitoring and logging
   - Implement health checks
   - Set up deployment pipeline

3. **User Testing**
   - Test with real audio files
   - Validate conversation flows
   - Measure success rates

---

## 📝 **Notes**

- All changes should be tested locally before committing
- Performance should be monitored throughout implementation
- Error handling should be comprehensive
- Documentation should be updated as features are implemented

---

*Last Updated: December 2024*
*Status: Ready for Implementation* 