const fastify = require('fastify')({ logger: true });
const WebSocket = require('ws');
const { interpret } = require('xstate');
const { handleIncomingCall } = require('./services/telephony');
const { getTranscription } = require('./services/stt');
const { processMessage, sessionManager, getCompletion } = require('./services/llm');
const { getSpeech } = require('./services/tts');
const { bookingMachine } = require('./services/stateMachine');
const { createCall, createTurn, updateTurn, updateCall } = require('./services/db');

fastify.post('/voice', handleIncomingCall);

const wss = new WebSocket.Server({ server: fastify.server });

wss.on('connection', (ws) => {
  console.log('Client connected - initializing enhanced booking service');

  const bookingService = interpret(bookingMachine).start();
  let callId = null;
  let turnIndex = 0;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Send initial greeting
  const initialGreeting = "Hello! I'm here to help you schedule an appointment. How can I assist you today?";
  getSpeech(initialGreeting).then(speechStream => {
    console.log('Sending initial greeting:', initialGreeting);
    speechStream.pipe(ws, { end: false });
  }).catch(error => {
    console.error('Failed to send initial greeting:', error);
  });

  // Log state transitions for debugging
  bookingService.onTransition((state) => {
    console.log('State transition:', {
      value: state.value,
      context: {
        service: state.context.service,
        timeWindow: state.context.timeWindow,
        contact: state.context.contact,
        retryCount: state.context.retryCount
      },
      changed: state.changed
    });

    // Log state transitions to database if call is active
    if (callId && state.changed) {
      updateCall(callId, {
        currentState: state.value,
        context: state.context,
        lastTransition: new Date()
      }).catch(error => {
        console.error('Failed to log state transition to database:', error);
      });
    }
  });

  ws.on('message', async (message) => {
    try {
      const { event, stream, callSid } = JSON.parse(message);

      // Initialize call tracking
      if (callSid && !callId) {
        try {
          const call = await createCall({
            twilioCallSid: callSid,
            status: 'in_progress',
            startedAt: new Date(),
            currentState: 'greet'
          });
          callId = call.id;
          console.log('Call tracking initialized:', callId);
        } catch (error) {
          console.error('Failed to initialize call tracking:', error);
        }
      }

      if (event === 'media' && stream) {
        const startTime = Date.now();
        
        // Step 1: Speech-to-Text
        const transcription = await getTranscription(stream);
        const asrMs = Date.now() - startTime;
        
        if (!transcription || transcription.trim().length === 0) {
          console.log('Empty transcription received');
          return;
        }

        console.log(`Transcription (Turn ${turnIndex}): ${transcription}`);
        
        // Step 2: LLM Processing with intent detection and response generation
        const llmStartTime = Date.now();
        const llmResult = await processMessage(
          transcription, 
          sessionId, 
          { state: bookingService.state.value },
          callId,
          turnIndex
        );
        const llmMs = Date.now() - llmStartTime;

        // Step 3: Update State Machine with LLM results
        const currentState = bookingService.send({
          type: 'PROCESS_INTENT',
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          response: llmResult.response,
          bookingData: llmResult.bookingData,
          originalSpeech: transcription
        });

        // Use the response from state machine if available, otherwise LLM response
        const responseText = currentState.context.currentResponse || llmResult.response;
        
        // Step 4: Text-to-Speech
        const ttsStartTime = Date.now();
        const speechStream = await getSpeech(responseText);
        const ttsMs = Date.now() - ttsStartTime;

        console.log('Generated response:', responseText);

        // Step 5: Send audio response
        speechStream.pipe(ws, { end: false });

        // Step 6: Log performance metrics (already handled in processMessage)
        console.log(`Turn ${turnIndex} completed:`, {
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          currentState: currentState.value,
          bookingData: currentState.context,
          processingTime: {
            asr: asrMs,
            llm: llmMs,
            tts: ttsMs,
            total: Date.now() - startTime
          }
        });

        turnIndex++;

        // Check if we've reached a final state
        if (currentState.matches('success') || currentState.matches('fallback')) {
          const finalStatus = currentState.matches('success') ? 'completed' : 'failed';
          
          if (callId) {
            try {
              await updateCall(callId, {
                status: finalStatus,
                endedAt: new Date(),
                finalContext: currentState.context,
                totalTurns: turnIndex
              });
            } catch (error) {
              console.error('Failed to update final call status:', error);
            }
          }

          console.log('Booking conversation completed:', {
            finalState: currentState.value,
            finalContext: currentState.context
          });
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error response
      try {
        const errorResponse = "I'm sorry, I'm experiencing technical difficulties. Please try again.";
        const speechStream = await getSpeech(errorResponse);
        speechStream.pipe(ws, { end: false });
        
        // Log error if we have call tracking
        if (callId) {
          updateCall(callId, {
            status: 'error',
            error: error.message,
            endedAt: new Date()
          }).catch(dbError => {
            console.error('Failed to log call error:', dbError);
          });
        }
      } catch (speechError) {
        console.error('Failed to send error response:', speechError);
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    bookingService.stop();
    
    // Clean up session
    sessionManager.clearSession(sessionId);
    
    // Update call status to disconnected
    if (callId) {
      updateCall(callId, {
        status: 'disconnected',
        endedAt: new Date()
      }).catch(error => {
        console.error('Failed to update call disconnect status:', error);
      });
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    bookingService.stop();
    
    // Log websocket error
    if (callId) {
      updateCall(callId, {
        status: 'error',
        error: error.message,
        endedAt: new Date()
      }).catch(dbError => {
        console.error('Failed to log websocket error:', dbError);
      });
    }
  });
});

fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
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