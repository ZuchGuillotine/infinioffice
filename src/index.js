
const fastify = require('fastify')({ logger: true });
const WebSocket = require('ws');
const { interpret } = require('xstate');
const { handleIncomingCall } = require('./services/telephony');
const { getTranscription } = require('./services/stt');
const { getCompletion } = require('./services/llm');
const { getSpeech } = require('./services/tts');
const { bookingMachine } = require('./services/stateMachine');

fastify.post('/voice', handleIncomingCall);

const wss = new WebSocket.Server({ server: fastify.server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  const bookingService = interpret(bookingMachine).start();

  ws.on('message', async (message) => {
    const { event, stream } = JSON.parse(message);

    if (event === 'media') {
      const transcription = await getTranscription(stream);
      const currentState = bookingService.send({ type: 'HEAR_SPEECH', speech: transcription });
      const completion = await getCompletion(currentState.value);
      const speech = await getSpeech(completion);
      ws.send(JSON.stringify({ event: 'media', stream: speech }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
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
