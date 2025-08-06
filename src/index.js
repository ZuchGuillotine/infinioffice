
const fastify = require('fastify')({ logger: true });
const { handleIncomingCall } = require('./services/telephony');

fastify.post('/voice', handleIncomingCall);

fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
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
