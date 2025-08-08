require('dotenv').config();

const fastify = require('fastify')({ logger: true });
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

const { handleIncomingCall } = require('./services/telephony');
const { STTService } = require('./services/stt');
const { processMessage, sessionManager, getCompletion } = require('./services/llm');
const { TTSService } = require('./services/tts');
const { bookingMachine } = require('./services/stateMachine');
const { createCall, createTurn, updateTurn, updateCall } = require('./services/db');
const { performanceMonitor } = require('./services/performance');

// Import route modules
const authRoutes = require('./routes/auth');
const organizationRoutes = require('./routes/organizations');
const callRoutes = require('./routes/calls');

// Register WebSocket support
fastify.register(require('@fastify/websocket'));

// Register API routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(organizationRoutes, { prefix: '/api/organizations' });
fastify.register(callRoutes, { prefix: '/api/calls' });

// Voice webhook endpoint
fastify.post('/voice', handleIncomingCall);

// WebSocket endpoint for Twilio Media Streams
fastify.register(async function (fastify) {
  fastify.get('/', { websocket: true }, (connection, req) => {
    const ws = connection;
    console.log('Client connected - initializing enhanced booking service');

    // Initialize services
    const bookingService = interpret(bookingMachine);
    const sttService = new STTService();
    const ttsService = new TTSService();
    
    // Connection state
    let callId = null;
    let turnIndex = 0;
    let streamSid = null;
    let isProcessingTurn = false;
    let conversationTimeout = null;
    let silenceTimeout = null;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Session initialized:', sessionId);

    // Start the booking service
    bookingService.start();

    // Log state transitions for debugging using XState v5 subscribe method
    bookingService.subscribe((state) => {
      console.log('State transition:', {
        value: state.value,
        context: {
          service: state.context.service,
          preferredTime: state.context.preferredTime,
          contact: state.context.contact
        }
      });

      // Log state transitions to database if call is active
      if (callId) {
        updateCall(callId, {
          currentState: state.value,
          context: state.context,
          lastTransition: new Date()
        }).catch(error => {
          console.error('Failed to log state transition to database:', error);
        });
      }
    });

    // STT will be started when Twilio stream begins
    let sttReady = false;
    let streamStarted = false;

    // Handle STT events
    sttService.on('ready', () => {
      console.log('STT service ready');
      sttReady = true;
      // Only send greeting if both STT is ready and stream has started
      if (streamStarted && sttReady) {
        console.log('Both STT ready and stream started - sending initial greeting');
        setTimeout(sendInitialGreeting, 500); // Small delay to ensure connection stability
      }
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
      resetConversationTimeout();
    });

    sttService.on('speechStarted', () => {
      console.log('Speech started');
      clearSilenceTimeout();
    });

    sttService.on('speechEnded', () => {
      console.log('Speech ended');
      resetSilenceTimeout();
    });

    sttService.on('silence', () => {
      console.log('Silence detected');
      // Handle prolonged silence
      if (!isProcessingTurn) {
        handleSilence();
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

    // Send initial greeting
    const sendInitialGreeting = async () => {
    try {
      const initialGreeting = "Hello! I'm here to help you schedule an appointment. How can I assist you today?";
      
      ttsService.resetBargeInDetection && ttsService.resetBargeInDetection();
      const result = await ttsService.generateAndStream(initialGreeting, ws, { streamId: streamSid });
      
      console.log('Initial greeting sent:', {
        text: initialGreeting,
        metrics: result.metrics
      });
      
      resetConversationTimeout();
    } catch (error) {
      console.error('Failed to send initial greeting:', error);
    }
  };

  // Process a complete turn (STT -> LLM -> TTS)
  const processTurn = async (transcript, confidence) => {
    console.log(`processTurn called with transcript: "${transcript}", isProcessingTurn: ${isProcessingTurn}`);
    
    if (isProcessingTurn) {
      console.log('Turn already in progress, ignoring:', transcript);
      return;
    }

    isProcessingTurn = true;
    const turnStartTime = Date.now();
    let currentTurnId = null;

    try {
      console.log(`Starting turn ${turnIndex}: "${transcript}"`);

      // Step 1: Process message with LLM and get turn ID
      const llmStartTime = Date.now();
      /* const llmResult = await processMessage(
        transcript,
        sessionId,
        { state: bookingService.state.value },
        callId,
        turnIndex
      ); */
      const llmResult = await processMessage(
        transcript,
        sessionId,
        { state: bookingService.state.value || 'idle' }
      );
      const llmMs = Date.now() - llmStartTime;
      
      console.log('LLM Result:', {
        intent: llmResult.intent,
        confidence: llmResult.confidence,
        response: llmResult.response?.substring(0, 100) + '...',
        bookingData: llmResult.bookingData
      });
      // currentTurnId = llmResult.turnId;

      // Initialize performance monitoring
      if (currentTurnId) {
        performanceMonitor.startTurn(currentTurnId, callId);
        performanceMonitor.recordPhase(currentTurnId, 'llm', llmStartTime, Date.now());
      }

      // Step 2: Update State Machine
      const currentState = bookingService.send({
        type: 'PROCESS_INTENT',
        intent: llmResult.intent,
        confidence: llmResult.confidence,
        response: llmResult.response,
        bookingData: llmResult.bookingData,
        originalSpeech: transcript
      });

      // Use state machine response if available, otherwise LLM response
      const responseText = currentState.context?.currentResponse || llmResult.response;

      // Step 3: Generate and stream TTS
      const ttsStartTime = Date.now();
      const ttsResult = await ttsService.generateAndStream(responseText, ws, { streamId: streamSid });
      const ttsMs = Date.now() - ttsStartTime;

      // Record TTS performance
      if (currentTurnId) {
        performanceMonitor.recordPhase(currentTurnId, 'tts', ttsStartTime, Date.now());
      }

      // Step 4: Log performance metrics
      const totalMs = Date.now() - turnStartTime;
      const targetMet = performanceMonitor.isTargetMet(totalMs);

      console.log(`Turn ${turnIndex} completed:`, {
        transcript,
        response: responseText,
        intent: llmResult.intent,
        confidence: llmResult.confidence,
        state: currentState.value || 'unknown',
        processingTime: {
          llm: llmMs,
          tts: ttsMs,
          total: totalMs
        },
        targetMet,
        turnId: currentTurnId
      });

      // Complete performance monitoring
      if (currentTurnId) {
        await performanceMonitor.completeTurn(currentTurnId);
      }

      turnIndex++;

      // Check for final state
      if (currentState.matches && (currentState.matches('success') || currentState.matches('fallback'))) {
        await handleConversationEnd(currentState);
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
    const status = finalState.matches('success') ? 'completed' : 'failed';
    
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

    console.log('Conversation completed:', {
      finalState: finalState.value,
      finalContext: finalState.context
    });

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
        const callSid = data.start.callSid;
        
        console.log('Twilio stream started:', { streamSid, callSid });
        
        // Initialize call tracking
        /* if (callSid && !callId) {
          try {
            const call = await createCall({
              twilioCallSid: callSid,
              status: 'in_progress',
              startedAt: new Date(),
              currentState: 'greeting',
              organizationId: process.env.DEFAULT_ORG_ID || '00000000-0000-0000-0000-000000000001'
            });
            callId = call.id;
            console.log('Call tracking initialized:', callId);
          } catch (error) {
            console.error('Failed to initialize call tracking:', error);
            // Continue without database tracking
          }
        } */

        // Start STT listening now that we have the Twilio stream
        console.log('Starting STT service for Twilio stream');
        streamStarted = true;
        sttService.startListening();

        // Send greeting once both stream is started and STT is ready
        if (sttReady && streamStarted) {
          console.log('Stream started and STT already ready - sending initial greeting');
          setTimeout(sendInitialGreeting, 500); // Small delay to ensure connection stability
        }
        
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
    bookingService.stop();
    
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
    bookingService.stop();
    
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
  return { 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      database: !!process.env.DATABASE_URL
    }
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();