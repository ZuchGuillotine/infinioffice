require('dotenv').config();

const path = require('path');
const fastify = require('fastify')({ 
  logger: process.env.NODE_ENV === 'development',
  trustProxy: true 
});
const WebSocket = require('ws');
const { interpret } = require('xstate');

// Add content type parser for Twilio webhooks
fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, function (req, body, done) {
  try {
    const parsed = new URLSearchParams(body);
    const result = {};
    for (const [key, value] of parsed) {
      result[key] = value;
    }
    done(null, result);
  } catch (err) {
    done(err);
  }
});

// Fix for empty JSON bodies on DELETE requests
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    // Handle empty body for DELETE requests
    if (body.trim() === '') {
      done(null, {});
    } else {
      done(null, JSON.parse(body));
    }
  } catch (err) {
    done(err);
  }
});

const { handleIncomingCall, callStore } = require('./services/telephony');
const { STTService } = require('./services/stt');
const { processMessage, sessionManager, getCompletion } = require('./services/llm');
const { TTSService } = require('./services/tts');
const { bookingMachine } = require('./services/stateMachine');
const { createCall, createTurn, updateTurn, updateCall } = require('./services/db');
const { performanceMonitor } = require('./services/performance');
const { OrganizationContextService } = require('./services/organizationContext');

// Import enhanced voice agent services with lazy loading
let EnhancedVoicePipeline = null;
let isEnhancedEnabled = null;
let getEnhancedConfig = null;

// Lazy load enhanced voice services to prevent circular dependencies
function getEnhancedServices() {
  if (!EnhancedVoicePipeline) {
    const voicePipelineModule = require('./services/enhancedVoicePipeline');
    const enhancedConfigModule = require('./config/enhancedVoice');
    
    EnhancedVoicePipeline = voicePipelineModule.EnhancedVoicePipeline;
    isEnhancedEnabled = enhancedConfigModule.isEnhancedEnabled;
    getEnhancedConfig = enhancedConfigModule.getEnhancedConfig;
  }
  return { EnhancedVoicePipeline, isEnhancedEnabled, getEnhancedConfig };
}

// Lazy global enhanced voice pipeline instance for health checks
let globalEnhancedVoicePipeline = null;
function getGlobalEnhancedVoicePipeline() {
  if (!globalEnhancedVoicePipeline) {
    const { EnhancedVoicePipeline } = getEnhancedServices();
    globalEnhancedVoicePipeline = new EnhancedVoicePipeline({
      enableEnhancedFeatures: true,
      fallbackToLegacy: true,
      telemetryEnabled: true
    });
  }
  return globalEnhancedVoicePipeline;
}

// Default greeting for fallback scenarios only
const FALLBACK_GREETING = "Hello! Thank you for calling. I'm here to help you schedule an appointment. How can I assist you today?";

// Import route modules
const authRoutes = require('./routes/auth');
const organizationRoutes = require('./routes/organizations');
const callRoutes = require('./routes/calls');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/user');
const servicesRoutes = require('./routes/services');
const onboardingRoutes = require('./routes/onboarding');
const voiceRoutes = require('./routes/voice');

// Import middleware
const { authMiddleware } = require('./middleware/auth');

// Register CORS support
fastify.register(require('@fastify/cors'), {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || `https://${process.env.DOMAIN || 'localhost'}`]
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Register static file serving for production
if (process.env.NODE_ENV === 'production') {
  fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, '..', 'frontend', 'dist'),
    prefix: '/', // optional: default '/'
  });
}

// Register WebSocket support
fastify.register(require('@fastify/websocket'));

// Register API routes (auth routes don't need auth middleware)
fastify.register(authRoutes, { prefix: '/api/auth' });

// Register protected API routes with auth middleware
fastify.register(async function (fastify) {
  fastify.addHook('preHandler', authMiddleware);
  
  await fastify.register(organizationRoutes, { prefix: '/api/organizations' });
  await fastify.register(callRoutes, { prefix: '/api/calls' });
  await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await fastify.register(userRoutes, { prefix: '/api/user' });
  await fastify.register(servicesRoutes, { prefix: '/api/services' });
  await fastify.register(onboardingRoutes, { prefix: '/api/onboarding' });
  await fastify.register(voiceRoutes, { prefix: '/api/voice' });
});

// Voice webhook endpoint
fastify.post('/voice', handleIncomingCall);

// WebSocket endpoint for Twilio Media Streams
fastify.register(async function (fastify) {
  fastify.get('/', { websocket: true }, async (connection, req) => {
    const ws = connection;
    console.log('Client connected - initializing enhanced booking service');

    // Call parameters will be extracted from Twilio 'start' event data
    let toNumber = null;
    let fromNumber = null;
    let callSid = null;
    
    console.log('📞 WebSocket connection established - waiting for Twilio start event to get call parameters');
    console.log('🔍 Request URL:', req.url);
    console.log('🔍 Request headers:', {
      host: req.headers.host,
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-forwarded-proto': req.headers['x-forwarded-proto']
    });

    // Initialize organization context service
    const contextService = new OrganizationContextService();
    let organizationContext = null;
    
    // Organization context will be loaded when we receive the Twilio start event
    console.log('⏳ Organization context will be loaded when Twilio start event is received...');

    // Initialize services
    const sttService = new STTService();
    const ttsService = new TTSService();
    
    // Initialize enhanced voice pipeline (with fallback to legacy) - lazy loaded
    let enhancedVoicePipeline = null;
    function getEnhancedVoicePipeline() {
      if (!enhancedVoicePipeline) {
        const { EnhancedVoicePipeline } = getEnhancedServices();
        enhancedVoicePipeline = new EnhancedVoicePipeline({
          enableEnhancedFeatures: true,
          fallbackToLegacy: true,
          telemetryEnabled: true
        });
      }
      return enhancedVoicePipeline;
    }
    
    // Enhanced voice pipeline session will be initialized when organization context is loaded
    let enhancedSession = null;
    
    // Connection state
    let callId = null;
    let turnIndex = 0;
    let streamSid = null;
    let isProcessingTurn = false;
    let conversationTimeout = null;
    let silenceTimeout = null;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Session initialized:', sessionId);
    
    // Enhanced voice pipeline session will be initialized when organization context is loaded

    // Enhanced voice pipeline will handle state transitions internally
    console.log('Enhanced voice pipeline ready - state transitions will be logged internally');

    // STT will be started when Twilio stream begins
    let sttReady = false;
    let streamStarted = false;
    let greetingSent = false;
    let organizationContextLoaded = false;
    let loadingOrgContext = false;

    // Handle STT events
    sttService.on('ready', () => {
      console.log('STT service ready');
      sttReady = true;
      
      // Flush any queued audio data now that STT is ready
      if (sttService.flushAudioQueue) {
        sttService.flushAudioQueue();
      }
      
      // Check if we can send greeting now (in case org context is already loaded)
      console.log('🚀 STT ready - checking if we can send custom greeting');
      tryToSendGreeting();
    });

    sttService.on('transcript', async (data) => {
      if (data.isFinal && !isProcessingTurn && data.text.trim().length > 0) {
        console.log(`Final transcript: "${data.text}" (confidence: ${data.confidence})`);
        console.log(`Processing turn - isProcessingTurn: ${isProcessingTurn}`);
        await processTurn(data.text, data.confidence);
      } else if (!data.isFinal && data.text.trim().length > 0) {
        console.log(`Interim transcript: "${data.text}"`);
        // Reset conversation timeout on any speech activity
        resetConversationTimeout();
      }
    });

    sttService.on('bargeIn', () => {
      console.log('Barge-in detected - interrupting TTS');
      ttsService.interruptStream();
      
      // Notify enhanced voice pipeline of barge-in if available
      if (enhancedSession) {
        const { isEnhancedEnabled } = getEnhancedServices();
        if (isEnhancedEnabled(organizationContext)) {
          getEnhancedVoicePipeline().handleBargeIn(sessionId);
        }
      }
      
      resetConversationTimeout();
    });

    sttService.on('speechStarted', () => {
      console.log('Speech started');
      clearSilenceTimeout();
      
      // Notify enhanced voice pipeline if available
      if (enhancedSession) {
        const { isEnhancedEnabled } = getEnhancedServices();
        if (isEnhancedEnabled(organizationContext)) {
          getEnhancedVoicePipeline().handleSpeechEvent(sessionId, 'speechStarted');
        }
      }
    });

    sttService.on('speechEnded', () => {
      console.log('Speech ended');
      // Only start silence timeout if we're not processing a turn
      if (!isProcessingTurn) {
        resetSilenceTimeout();
      }
      
      // Notify enhanced voice pipeline if available
      if (enhancedSession) {
        const { isEnhancedEnabled } = getEnhancedServices();
        if (isEnhancedEnabled(organizationContext)) {
          getEnhancedVoicePipeline().handleSpeechEvent(sessionId, 'speechEnded');
        }
      }
    });

    sttService.on('silence', () => {
      console.log('Silence detected');
      // Handle prolonged silence
      if (!isProcessingTurn) {
        handleSilence();
      }
      
      // Notify enhanced voice pipeline if available
      if (enhancedSession) {
        const { isEnhancedEnabled } = getEnhancedServices();
        if (isEnhancedEnabled(organizationContext)) {
          getEnhancedVoicePipeline().handleSpeechEvent(sessionId, 'silence');
        }
      }
    });

    sttService.on('error', (error) => {
      console.error('STT Service error:', error);
      // Attempt to restart STT on error
      setTimeout(() => {
        if (!sttService.isListening) {
          console.log('Attempting to restart STT service');
          sttService.startListening();
        }
      }, 1000);
    });

  // 🚀 Send custom greeting after organization context loads
  const sendCustomGreeting = async () => {
    try {
      if (!toNumber || !organizationContext) {
        console.log('⚠️ Missing toNumber or organization context, cannot send custom greeting');
        return;
      }
      
      // Get custom greeting from organization context
      const greeting = organizationContext.businessConfig?.greeting || 
                      organizationContext.businessConfig?.scripts?.greeting ||
                      FALLBACK_GREETING;
      
      const voiceModel = organizationContext.businessConfig?.voiceSettings?.voiceModel || 'aura-asteria-en';
      
      console.log('📢 Sending CUSTOM greeting for:', organizationContext.organizationName);
      
      ttsService.resetBargeInDetection && ttsService.resetBargeInDetection();
      
      const result = await ttsService.generateAndStream(greeting, ws, { 
        streamId: streamSid,
        model: voiceModel,
        speed: 1.0
      });
      
      console.log('✅ Custom greeting sent:', {
        organization: organizationContext.organizationName,
        phone: toNumber,
        text: greeting.substring(0, 50) + '...',
        voiceModel,
        metrics: result.metrics
      });
      
      resetConversationTimeout();
      
    } catch (error) {
      console.error('❌ Error sending custom greeting:', error);
      // Fallback to basic greeting
      try {
        await ttsService.generateAndStream(FALLBACK_GREETING, ws, { streamId: streamSid });
      } catch (fallbackError) {
        console.error('❌ Error sending fallback greeting:', fallbackError);
      }
    }
  };

  // Send greeting when all conditions are met
  const tryToSendGreeting = async () => {
    console.log('🔍 Checking greeting conditions:', {
      hasOrganizationContext: !!organizationContext,
      sttReady,
      streamStarted,
      greetingSent,
      streamSid: !!streamSid
    });
    
    // All conditions must be met: org context loaded, STT ready, stream started, greeting not sent, and we have streamSid
    if (organizationContext && sttReady && streamStarted && !greetingSent && streamSid) {
      greetingSent = true;
      organizationContextLoaded = true;
      console.log('🚀 All conditions met - sending custom greeting now!');
      await sendCustomGreeting();
      return true;
    }
    return false;
  };

  // Process a complete turn using enhanced voice pipeline
  const processTurn = async (transcript, confidence) => {
    console.log(`processTurn called with transcript: "${transcript}", isProcessingTurn: ${isProcessingTurn}`);
    
    if (isProcessingTurn) {
      console.log('Turn already in progress, ignoring:', transcript);
      return;
    }

    isProcessingTurn = true;
    const turnStartTime = Date.now();

    try {
      console.log(`Starting enhanced turn ${turnIndex}: "${transcript}"`);

      let responseText;
      
      const { isEnhancedEnabled } = getEnhancedServices();
      if (enhancedSession && isEnhancedEnabled(organizationContext)) {
        // Use enhanced voice pipeline for turn processing
        const enhancedResult = await getEnhancedVoicePipeline().processTurn(
          sessionId,
          transcript,
          confidence,
          callId,
          turnIndex
        );

        console.log('✅ Enhanced turn processing complete:', {
          intent: enhancedResult.intent,
          confidence: enhancedResult.confidence,
          state: enhancedResult.state,
          hasResponse: !!enhancedResult.response,
          processingTime: enhancedResult.processingTime
        });

        // Use enhanced response
        responseText = enhancedResult.response;
      } else {
        // Fallback to legacy LLM processing
        console.log('🔄 Using legacy LLM processing');
        const llmResult = await processMessage(
          transcript,
          sessionId,
          { 
            state: 'idle',
            organizationContext: organizationContext,
            organizationId: organizationContext.organizationId,
            businessConfig: organizationContext.businessConfig
          }
        );
        
        responseText = llmResult.response;
        console.log('✅ Legacy turn processing complete:', {
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          response: responseText?.substring(0, 100) + '...'
        });
      }

      // Step 3: Generate and stream TTS
      console.log('🔊 Starting TTS generation:', {
        text: responseText?.substring(0, 50) + '...',
        streamSid: streamSid
      });
      
      const ttsStartTime = Date.now();
      const ttsResult = await ttsService.generateAndStream(responseText, ws, { streamId: streamSid });
      const ttsMs = Date.now() - ttsStartTime;
      
      console.log('✅ TTS completed:', {
        generationTime: ttsResult.metrics?.generationTime || 'unknown',
        streamingTime: ttsResult.metrics?.streamingTime || 'unknown',
        audioSize: ttsResult.metrics?.audioSize || 'unknown'
      });

      // Step 4: Log performance metrics
      const totalMs = Date.now() - turnStartTime;
      
      console.log(`Enhanced turn ${turnIndex} completed:`, {
        transcript,
        response: responseText,
        intent: enhancedResult.intent,
        confidence: enhancedResult.confidence,
        state: enhancedResult.state,
        processingTime: {
          enhanced: enhancedResult.processingTime,
          tts: ttsMs,
          total: totalMs
        }
      });

      turnIndex++;

      // Check for final state using enhanced pipeline if available
      if (enhancedSession) {
        const { isEnhancedEnabled } = getEnhancedServices();
        if (isEnhancedEnabled(organizationContext)) {
          const enhancedState = getEnhancedVoicePipeline().getSessionState(sessionId);
          if (enhancedState && (enhancedState.state === 'bookingSuccess' || enhancedState.state === 'conversationComplete' || enhancedState.state === 'escalateToHuman')) {
            await handleConversationEnd(enhancedState);
          }
        }
      }

    } catch (error) {
      console.error('Error processing turn:', error);
      
      // Complete performance monitoring with error
      if (currentTurnId) {
        try {
          await performanceMonitor.completeTurn(currentTurnId);
        } catch (perfError) {
          console.error('Error completing performance monitoring:', perfError);
        }
      }
      
      await handleProcessingError(error);
    } finally {
      isProcessingTurn = false;
      resetConversationTimeout();
      resetSilenceTimeout(); // Restart silence detection after processing
    }
  };

  // Handle prolonged silence
  const handleSilence = async () => {
    try {
      const timeoutResponse = "I'm still here. Are you ready to schedule an appointment?";
      await ttsService.generateAndStream(timeoutResponse, ws, { streamId: streamSid });
      resetConversationTimeout();
    } catch (error) {
      console.error('Error handling silence:', error);
    }
  };

  // Handle processing errors
  const handleProcessingError = async (error) => {
    try {
      const errorResponse = "I'm sorry, I'm experiencing technical difficulties. Could you please repeat that?";
      await ttsService.generateAndStream(errorResponse, ws, { streamId: streamSid });
      
      if (callId) {
        await updateCall(callId, {
          error: error.message,
          status: 'error'
        });
      }
    } catch (ttsError) {
      console.error('Failed to send error response:', ttsError);
    }
  };

  // Handle conversation end
  const handleConversationEnd = async (finalState) => {
    let status = 'completed';
    
    // Map enhanced states to call statuses
    if (finalState.state === 'escalateToHuman') {
      status = 'escalated';
    } else if (finalState.state === 'conversationComplete') {
      status = 'completed';
    } else if (finalState.state === 'bookingSuccess') {
      status = 'completed';
    } else {
      status = 'failed';
    }
    
    if (callId) {
      try {
        await updateCall(callId, {
          status,
          endedAt: new Date(),
          finalContext: finalState.context,
          totalTurns: turnIndex
        });
      } catch (error) {
        console.error('Failed to update final call status:', error);
      }
    }

    console.log('Enhanced conversation completed:', {
      finalState: finalState.state,
      finalContext: finalState.context
    });

    // Finalize enhanced voice pipeline session if it exists
    if (enhancedSession) {
      try {
        const { isEnhancedEnabled } = getEnhancedServices();
        if (isEnhancedEnabled(organizationContext)) {
          const finalMetrics = getEnhancedVoicePipeline().finalizeSession(sessionId);
          console.log('Enhanced session finalized with metrics:', finalMetrics);
        }
      } catch (error) {
        console.error('Error finalizing enhanced session:', error);
      }
    }

    // Set a longer timeout for call completion
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 5000);
  };

  // Timeout management
  const resetConversationTimeout = () => {
    if (conversationTimeout) {
      clearTimeout(conversationTimeout);
    }
    conversationTimeout = setTimeout(() => {
      handleConversationTimeout();
    }, 30000); // 30 second conversation timeout
  };

  const resetSilenceTimeout = () => {
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
    }
    silenceTimeout = setTimeout(() => {
      if (!isProcessingTurn) {
        handleSilence();
      }
    }, 5000); // 5 second silence timeout
  };

  const clearSilenceTimeout = () => {
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }
  };

  const handleConversationTimeout = async () => {
    try {
      console.log('Conversation timeout reached');
      const timeoutMessage = "I haven't heard from you in a while. If you'd like to schedule an appointment, please call back. Have a great day!";
      await ttsService.generateAndStream(timeoutMessage, ws, { streamId: streamSid });
      
      if (callId) {
        await updateCall(callId, {
          status: 'timeout',
          endedAt: new Date()
        });
      }
      
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 3000);
    } catch (error) {
      console.error('Error handling conversation timeout:', error);
      ws.close();
    }
  };

    // Handle Twilio WebSocket messages
    ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        callSid = data.start.callSid;
        
        // Extract call parameters from Twilio stream parameters
        const streamParameters = data.start.customParameters || {};
        toNumber = streamParameters.to;
        fromNumber = streamParameters.from;
        
        console.log('Twilio stream started:', { streamSid, callSid, toNumber, fromNumber });
        console.log('📋 Full start event data:', JSON.stringify(data.start, null, 2));
        console.log('📋 Stream custom parameters:', streamParameters);
        
        // Fallback: if custom parameters didn't work, try the callStore
        if (!toNumber && callSid && callStore.has(callSid)) {
          const storedCallData = callStore.get(callSid);
          toNumber = storedCallData.to;
          fromNumber = storedCallData.from;
          console.log('📋 Retrieved call parameters from callStore:', storedCallData);
          
          // Clean up the stored data
          callStore.delete(callSid);
        }
        
        // 🚀 IMMEDIATE: Start STT service without waiting for DB
        console.log('🚀 Starting STT service immediately (no DB wait)');
        streamStarted = true;
        sttService.startListening();
        
        // Try to send greeting immediately after stream starts
        console.log('🔍 Stream started, attempting to send greeting...');
        await tryToSendGreeting();
        
        // 📋 BACKGROUND: Load organization context asynchronously
        const loadOrgContextAsync = async () => {
          if (toNumber && !loadingOrgContext) {
            loadingOrgContext = true;
            console.log('📋 Loading organization context in background...');
            
            try {
              organizationContext = await contextService.getOrganizationContext(toNumber);
            console.log('🏢 Loaded organization context for:', organizationContext.organizationName, '- Phone:', toNumber);
            console.log('🏢 Organization services available:', organizationContext.businessConfig?.services?.length || 0);
            
            // Log the organization context for debugging
            if (organizationContext?.businessConfig) {
              console.log('🏢 Business config loaded:', {
                services: organizationContext.businessConfig.services?.map(s => ({ name: s.name, active: s.active })) || [],
                greeting: organizationContext.businessConfig.greeting ? 'Custom greeting set' : 'Using default greeting',
                scripts: Object.keys(organizationContext.businessConfig.scripts || {}).join(', ') || 'None'
              });
            }
            
            // Check if enhanced features are enabled for this organization
            const { isEnhancedEnabled, getEnhancedConfig } = getEnhancedServices();
            const enhancedConfig = getEnhancedConfig(organizationContext);
            const featuresEnabled = isEnhancedEnabled(organizationContext);
            
            console.log('🔧 Enhanced voice configuration:', {
              enabled: featuresEnabled,
              features: enhancedConfig.features,
              confirmationThresholds: enhancedConfig.confirmationThresholds
            });
            
            if (featuresEnabled) {
              // Initialize enhanced voice pipeline session with organization context
              console.log('🚀 Initializing enhanced voice pipeline session');
              enhancedSession = getEnhancedVoicePipeline().initializeSession(sessionId, organizationContext);
              
              console.log('✅ Enhanced session initialized:', {
                sessionId: enhancedSession.sessionId,
                isEnhanced: enhancedSession.isEnhanced,
                hasStateMachine: !!enhancedSession.stateMachine
              });
            } else {
              console.log('⚠️ Enhanced features disabled for this organization, using legacy pipeline');
            }
            
            // 🚀 IMMEDIATE: Send custom greeting now that context is loaded
            await tryToSendGreeting();
            
          } catch (error) {
            console.error('⚠️ Failed to load organization context for', toNumber, ':', error.message);
            organizationContext = contextService.getDefaultContext();
            
            // Initialize with default context if enhanced features are enabled
            const { isEnhancedEnabled } = getEnhancedServices();
            if (isEnhancedEnabled(organizationContext)) {
              enhancedSession = getEnhancedVoicePipeline().initializeSession(sessionId, organizationContext);
              console.log('✅ Enhanced session initialized with default context');
            }
          }
          
          } else {
            // No toNumber provided
            console.log('⚠️ No toNumber provided in stream parameters, using default context');
            organizationContext = contextService.getDefaultContext();
            
            const { isEnhancedEnabled } = getEnhancedServices();
            if (isEnhancedEnabled(organizationContext)) {
              enhancedSession = getEnhancedVoicePipeline().initializeSession(sessionId, organizationContext);
              console.log('✅ Enhanced session initialized with default context');
            }
          }
        };
        
        // Execute organization context loading in background
        loadOrgContextAsync();
        
        // Fallback: ensure greeting is sent within 3 seconds even if race conditions occur
        setTimeout(async () => {
          if (!greetingSent && streamSid) {
            console.log('⏰ Fallback timeout: sending greeting after 3 seconds');
            greetingSent = true;
            // Use fallback greeting if organization context didn't load in time
            const greeting = organizationContext?.businessConfig?.greeting || 
                            organizationContext?.businessConfig?.scripts?.greeting ||
                            FALLBACK_GREETING;
            
            try {
              await ttsService.generateAndStream(greeting, ws, { streamId: streamSid });
              console.log('✅ Fallback greeting sent successfully');
            } catch (error) {
              console.error('❌ Error sending fallback greeting:', error);
            }
          }
        }, 3000);
        
        // Initialize call tracking
        /* if (callSid && !callId) {
          try {
            const call = await createCall({
              twilioCallSid: callSid,
              status: 'in_progress',
              startedAt: new Date(),
              currentState: 'greeting',
              organizationId: organizationContext.organizationId,
              callerPhone: fromNumber
            });
            callId = call.id;
            console.log('Call tracking initialized:', callId);
          } catch (error) {
            console.error('Failed to initialize call tracking:', error);
            // Continue without database tracking
          }
        } */

        // STT and greeting are now handled immediately above (no DB wait)
        
      } else if (data.event === 'media') {
        // Stream audio data to STT service
        if (data.media && data.media.payload) {
          const audioBuffer = Buffer.from(data.media.payload, 'base64');
          // console.log(`Received audio chunk: ${audioBuffer.length} bytes`);
          sttService.sendAudio(audioBuffer);
        } else {
          console.log('Received media event without payload');
        }
        
      } else if (data.event === 'stop') {
        console.log('Twilio stream stopped');
        
        // Update call status
        /* if (callId) {
          try {
            await updateCall(callId, {
              status: 'disconnected',
              endedAt: new Date()
            });
          } catch (error) {
            console.error('Failed to update call disconnect status:', error);
          }
        } */
      }
      
    } catch (error) {
      console.error('Error processing Twilio message:', error);
    }
  });

    ws.on('close', () => {
    console.log('WebSocket client disconnected');
    
    // Clean up services
    sttService.stopListening();
    ttsService.interruptStream();
    
    // Clear timeouts
    if (conversationTimeout) clearTimeout(conversationTimeout);
    if (silenceTimeout) clearTimeout(silenceTimeout);
    
    // Clean up session
    sessionManager.clearSession(sessionId);
    
    // Update call status to disconnected
    /* if (callId) {
      updateCall(callId, {
        status: 'disconnected',
        endedAt: new Date(),
        totalTurns: turnIndex
      }).catch(error => {
        console.error('Failed to update call disconnect status:', error);
      });
    } */
  });

    ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    
    // Clean up services
    sttService.stopListening();
    ttsService.interruptStream();
    
    // Finalize enhanced voice pipeline session if it exists
    if (enhancedSession) {
      try {
        const { isEnhancedEnabled } = getEnhancedServices();
        if (isEnhancedEnabled(organizationContext)) {
          getEnhancedVoicePipeline().finalizeSession(sessionId);
        }
      } catch (error) {
        console.error('Error finalizing enhanced session on websocket error:', error);
      }
    }
    
    // Clear timeouts
    if (conversationTimeout) clearTimeout(conversationTimeout);
    if (silenceTimeout) clearTimeout(silenceTimeout);
    
    // Log websocket error
    /* if (callId) {
      updateCall(callId, {
        status: 'error',
        error: error.message,
        endedAt: new Date(),
        totalTurns: turnIndex
      }).catch(dbError => {
        console.error('Failed to log websocket error:', dbError);
      });
    } */
  });
  });
});

// Default HTTP route
fastify.get('/hello', async (request, reply) => {
  return { hello: 'world' };
});

// Performance metrics endpoint
fastify.get('/metrics', async (request, reply) => {
  return performanceMonitor.exportMetrics();
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Test database connection using database manager
  try {
    const { healthCheck } = require('./config/database');
    const dbHealth = await healthCheck();
    health.services.database = dbHealth.status;
    if (dbHealth.status === 'unhealthy') {
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  // Test OpenAI API
  health.services.openai = process.env.OPENAI_API_KEY ? 'configured' : 'missing';
  
  // Test Deepgram API  
  health.services.deepgram = process.env.DEEPGRAM_API_KEY ? 'configured' : 'missing';

  // Test Twilio configuration
  health.services.twilio = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ? 'configured' : 'missing';

  return health;
});

// Enhanced voice pipeline health check
fastify.get('/health/enhanced-voice', async (request, reply) => {
  try {
    const pipeline = getGlobalEnhancedVoicePipeline();
    const health = pipeline.healthCheck();
    return {
      status: 'healthy',
      enhancedVoice: health,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  fastify.get('/*', async (request, reply) => {
    // Skip API and static asset routes
    if (request.url.startsWith('/api/') || 
        request.url.startsWith('/voice') || 
        request.url.startsWith('/health') || 
        request.url.startsWith('/metrics') ||
        request.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      return;
    }
    
    return reply.sendFile('index.html');
  });
}

const start = async () => {
  try {
    // Pre-warm database connection before starting server
    console.log('🔥 Pre-warming database connection...');
    const { prewarmDatabase } = require('./config/database');
    await prewarmDatabase();
    
    const port = process.env.PORT || 3000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    await fastify.listen({ port, host });
    console.log(`🚀 InfiniOffice Server running on ${host}:${port}`);
    console.log(`📱 Twilio webhook: ${process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : `http://localhost:${port}`}/voice`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();