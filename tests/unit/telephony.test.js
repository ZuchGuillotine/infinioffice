
const supertest = require('supertest');
const fastify = require('fastify')({ logger: true });
const { handleIncomingCall } = require('../src/services/telephony');

fastify.post('/voice', handleIncomingCall);

describe('Telephony Service', () => {
  beforeAll(async () => {
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return a TwiML response for incoming calls', async () => {
    const response = await supertest(fastify.server)
      .post('/voice')
      .send();

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/xml');
    expect(response.text).toContain('<Response>');
    expect(response.text).toContain('<Connect>');
    expect(response.text).toContain('<Stream');
  });
});
