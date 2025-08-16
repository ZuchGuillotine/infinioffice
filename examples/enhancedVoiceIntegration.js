/**
 * Enhanced Voice Integration Example
 * 
 * This example shows how to integrate the enhanced voice agent features
 * into your existing InfiniOffice WebSocket handler.
 */

const WebSocket = require('ws');
const { interpret } = require('xstate');
const { EnhancedVoicePipeline } = require('../src/services/enhancedVoicePipeline');
const { STTService } = require('../src/services/stt');
const { TTSService } = require('../src/services/tts');
const { OrganizationContextService } = require('../src/services/organizationContext');

// Example WebSocket handler with enhanced voice agent
async function handleEnhancedVoiceCall(ws, req) {
  console.log('🚀 Enhanced Voice Call Handler Started');

  // Initialize services
  const voicePipeline = new EnhancedVoicePipeline({
    enableEnhancedFeatures: true,
    fallbackToLegacy: false,
    telemetryEnabled: true
  });
  
  const sttService = new STTService();
  const ttsService = new TTSService();
  const contextService = new OrganizationContextService();
  
  // Call state
  let sessionId = null;
  let organizationContext = null;
  let callId = null;
  let turnIndex = 0;
  let streamSid = null;
  let isProcessingTurn = false;
  let greetingSent = false;

  // Initialize session when we have organization context
  const initializeEnhancedSession = () => {
    if (organizationContext && !sessionId) {
      sessionId = `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      voicePipeline.initializeSession(sessionId, organizationContext);
      console.log('✅ Enhanced session initialized:', sessionId);
    }
  };

  // Send initial greeting using enhanced features
  const sendEnhancedGreeting = async () => {
    if (greetingSent || !sessionId || !streamSid) return;
    
    try {
      // Get organization-specific greeting
      const greeting = organizationContext.businessConfig?.greeting || 
                      "Hello! I'm here to help you schedule an appointment. How can I assist you today?";
      
      // Use organization's voice settings
      const voiceOptions = {
        streamId: streamSid,
        model: organizationContext.businessConfig?.voiceSettings?.voiceModel || 'aura-asteria-en',
        speed: organizationContext.businessConfig?.voiceSettings?.speed || 1.0
      };
      
      const result = await ttsService.generateAndStream(greeting, ws, voiceOptions);
      greetingSent = true;
      
      console.log('📢 Enhanced greeting sent:', {
        organization: organizationContext.organizationName,
        voiceModel: voiceOptions.model,
        duration: result.metrics?.generationTime
      });
      
    } catch (error) {
      console.error('❌ Failed to send enhanced greeting:', error);
    }
  };

  // Process a complete turn with enhanced features
  const processEnhancedTurn = async (transcript, confidence) => {
    if (isProcessingTurn || !sessionId) {
      console.log('⏭️ Skipping turn - already processing or no session');
      return;
    }

    isProcessingTurn = true;
    const turnStartTime = Date.now();

    try {
      console.log(`🎯 Enhanced Turn ${turnIndex}:`, {
        transcript: transcript.substring(0, 50),
        confidence,
        sessionId
      });

      // Process with enhanced voice pipeline
      const result = await voicePipeline.processTurn(
        sessionId,
        transcript,
        confidence,
        callId,
        turnIndex
      );

      // Log detailed results
      console.log('📊 Enhanced Turn Results:', {
        intent: result.intent,
        confidence: result.confidence,
        state: result.state,
        hasLocation: !!result.context.locationKind,
        progressSummary: result.context.progressSummary,
        confirmationAttempts: result.context.confirmationAttempts,
        processingTime: result.processingTime
      });

      // Generate and stream TTS response
      if (result.response) {
        const ttsStartTime = Date.now();
        
        // Use organization voice settings
        const voiceOptions = {
          streamId: streamSid,
          model: organizationContext.businessConfig?.voiceSettings?.voiceModel || 'aura-asteria-en',
          speed: organizationContext.businessConfig?.voiceSettings?.speed || 1.0
        };
        
        const ttsResult = await ttsService.generateAndStream(
          result.response, 
          ws, 
          voiceOptions
        );
        
        const ttsMs = Date.now() - ttsStartTime;
        console.log('🔊 TTS Complete:', { duration: ttsMs });
      }

      // Handle special states
      if (result.state === 'escalateToHuman' || result.state === 'callbackScheduled') {
        console.log('📞 Escalation triggered:', {
          state: result.state,
          reason: result.context.escalationReason
        });
        
        // Could integrate with CRM or scheduling system here
      }

      if (result.state === 'bookingSuccess') {
        console.log('🎉 Booking successful:', {
          service: result.context.service,
          timeWindow: result.context.timeWindow,
          location: result.context.locationKind,
          contact: result.context.contact
        });
        
        // Could send confirmation SMS/email here
      }

      turnIndex++;
      
    } catch (error) {
      console.error('❌ Enhanced turn processing error:', error);
      
      // Send error response
      try {
        await ttsService.generateAndStream(
          "I'm sorry, I'm having trouble processing that. Could you please repeat?",
          ws,
          { streamId: streamSid }
        );
      } catch (ttsError) {
        console.error('❌ Failed to send error response:', ttsError);
      }
      
    } finally {
      isProcessingTurn = false;
    }
  };

  // STT Event Handlers with Enhanced Features
  sttService.on('ready', () => {
    console.log('🎤 Enhanced STT ready');
    if (streamSid && organizationContext && !greetingSent) {
      sendEnhancedGreeting();
    }
  });

  sttService.on('transcript', async (data) => {
    if (data.isFinal && data.text.trim().length > 0) {
      console.log(`📝 Final transcript: "${data.text}" (confidence: ${data.confidence})`);
      await processEnhancedTurn(data.text, data.confidence);
    } else if (!data.isFinal && data.text.trim().length > 0) {
      console.log(`📝 Interim: "${data.text}"`);
    }
  });

  sttService.on('bargeIn', () => {
    console.log('🚫 Barge-in detected');
    if (sessionId) {
      voicePipeline.handleBargeIn(sessionId);
    }
    ttsService.interruptStream();
  });

  sttService.on('speechStarted', () => {
    console.log('🗣️ Speech started');
    if (sessionId) {
      voicePipeline.handleSpeechEvent(sessionId, 'speechStarted');
    }
  });

  sttService.on('speechEnded', () => {
    console.log('🤐 Speech ended');
    if (sessionId) {
      voicePipeline.handleSpeechEvent(sessionId, 'speechEnded');
    }
  });

  sttService.on('silence', () => {
    console.log('🔇 Silence detected');
    if (sessionId) {
      voicePipeline.handleTimeout(sessionId);
    }
  });

  // WebSocket message handler
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        callId = data.start.callSid;
        
        // Extract call parameters
        const streamParameters = data.start.customParameters || {};
        const toNumber = streamParameters.to;
        const fromNumber = streamParameters.from;
        
        console.log('📞 Enhanced call started:', { 
          streamSid, 
          callId, 
          toNumber, 
          fromNumber 
        });
        
        // Load organization context
        if (toNumber) {
          try {
            organizationContext = await contextService.getOrganizationContext(toNumber);
            console.log('🏢 Organization context loaded:', {
              name: organizationContext.organizationName,
              services: organizationContext.businessConfig?.services?.length || 0,
              locationMode: organizationContext.businessConfig?.locations?.mode
            });
            
            // Initialize enhanced session
            initializeEnhancedSession();
            
          } catch (error) {
            console.error('⚠️ Failed to load organization context:', error);
            organizationContext = contextService.getDefaultContext();
            initializeEnhancedSession();
          }
        } else {
          console.log('⚠️ No phone number provided, using default context');
          organizationContext = contextService.getDefaultContext();
          initializeEnhancedSession();
        }
        
        // Start STT
        sttService.startListening();
        
        // Send greeting if ready
        if (organizationContext && !greetingSent) {
          setTimeout(sendEnhancedGreeting, 500);
        }
        
      } else if (data.event === 'media') {
        // Stream audio to STT
        if (data.media && data.media.payload) {
          const audioBuffer = Buffer.from(data.media.payload, 'base64');
          sttService.sendAudio(audioBuffer);
        }
        
      } else if (data.event === 'stop') {
        console.log('📞 Enhanced call ended');
        
        // Finalize session and get metrics
        if (sessionId) {
          const finalMetrics = voicePipeline.finalizeSession(sessionId);
          console.log('📊 Final call metrics:', finalMetrics);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing Twilio message:', error);
    }
  });

  // WebSocket close handler
  ws.on('close', () => {
    console.log('🔌 Enhanced WebSocket closed');
    
    // Cleanup services
    sttService.stopListening();
    ttsService.interruptStream();
    
    // Finalize session
    if (sessionId) {
      const finalMetrics = voicePipeline.finalizeSession(sessionId);
      console.log('📊 Session finalized:', finalMetrics);
    }
  });

  // WebSocket error handler
  ws.on('error', (error) => {
    console.error('❌ Enhanced WebSocket error:', error);
    
    // Cleanup services
    sttService.stopListening();
    ttsService.interruptStream();
    
    // Finalize session
    if (sessionId) {
      voicePipeline.finalizeSession(sessionId);
    }
  });
}

// Example usage in Fastify WebSocket route
function setupEnhancedVoiceRoutes(fastify) {
  fastify.register(async function (fastify) {
    fastify.get('/enhanced-voice', { websocket: true }, handleEnhancedVoiceCall);
  });
}

// Example of migrating existing handler
function migrateToEnhancedVoice(existingHandler) {
  return async function enhancedHandler(connection, req) {
    const ws = connection;
    
    // Feature flag check
    const useEnhanced = process.env.ENHANCED_VOICE_ENABLED === 'true';
    
    if (useEnhanced) {
      console.log('🚀 Using enhanced voice handler');
      return await handleEnhancedVoiceCall(ws, req);
    } else {
      console.log('📞 Using legacy voice handler');
      return await existingHandler(connection, req);
    }
  };
}

// Example performance monitoring
function monitorEnhancedPerformance(voicePipeline) {
  setInterval(() => {
    const health = voicePipeline.healthCheck();
    console.log('📊 Enhanced Voice Pipeline Health:', health);
    
    // Log metrics for active sessions
    for (const [sessionId, session] of voicePipeline.activeSessions) {
      const metrics = voicePipeline.getSessionMetrics(sessionId);
      if (metrics && metrics.turns.length > 0) {
        const avgLatency = metrics.turns.reduce((sum, turn) => sum + (turn.totalMs || 0), 0) / metrics.turns.length;
        console.log(`📈 Session ${sessionId}: ${metrics.turns.length} turns, ${Math.round(avgLatency)}ms avg latency`);
      }
    }
  }, 30000); // Every 30 seconds
}

// Example error handling and fallback
function setupEnhancedErrorHandling(voicePipeline) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled promise rejection in enhanced voice:', reason);
    
    // Gracefully handle any session cleanup
    for (const sessionId of voicePipeline.activeSessions.keys()) {
      try {
        voicePipeline.finalizeSession(sessionId);
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
  });
}

// Example A/B testing setup
function createEnhancedABTest(legacyHandler, enhancedHandler) {
  return async function abTestHandler(connection, req) {
    // Determine which handler to use based on organization or random selection
    const useEnhanced = Math.random() < 0.5; // 50/50 split for testing
    
    const handler = useEnhanced ? enhancedHandler : legacyHandler;
    const handlerType = useEnhanced ? 'enhanced' : 'legacy';
    
    console.log(`🧪 A/B Test: Using ${handlerType} handler`);
    
    try {
      await handler(connection, req);
    } catch (error) {
      console.error(`❌ ${handlerType} handler error:`, error);
      
      // Fallback to the other handler if there's an error
      const fallbackHandler = useEnhanced ? legacyHandler : enhancedHandler;
      console.log(`🔄 Falling back to ${useEnhanced ? 'legacy' : 'enhanced'} handler`);
      
      try {
        await fallbackHandler(connection, req);
      } catch (fallbackError) {
        console.error('❌ Fallback handler also failed:', fallbackError);
        throw fallbackError;
      }
    }
  };
}

module.exports = {
  handleEnhancedVoiceCall,
  setupEnhancedVoiceRoutes,
  migrateToEnhancedVoice,
  monitorEnhancedPerformance,
  setupEnhancedErrorHandling,
  createEnhancedABTest
};