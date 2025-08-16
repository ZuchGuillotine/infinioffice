const { getDatabase } = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const TTSService = require('../services/tts');

async function voiceRoutes(fastify, options) {
  const prisma = await getDatabase();
  // Authentication is already handled at the parent level

  // Get voice settings for an organization
  fastify.get('/settings', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const businessConfig = await prisma.businessConfig.findUnique({
        where: { organizationId },
        select: {
          voiceSettings: true
        }
      });

      return businessConfig?.voiceSettings || {};
    } catch (error) {
      fastify.log.error('Error fetching voice settings:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update voice settings for an organization
  fastify.post('/settings', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { voiceModel } = request.body;
    
    // Validate required fields
    if (!voiceModel) {
      return reply.code(400).send({ error: 'Voice model is required' });
    }

    // Validate voice model is one of the allowed options
    const allowedVoices = ['saturn', 'harmonia', 'hera', 'zeus'];
    if (!allowedVoices.includes(voiceModel)) {
      return reply.code(400).send({ error: 'Invalid voice model selected' });
    }

    try {
      // Get current business config
      const currentConfig = await prisma.businessConfig.findUnique({
        where: { organizationId }
      });

      const updatedVoiceSettings = {
        voiceModel,
        updatedAt: new Date().toISOString()
      };

      // Update or create business config
      const updatedConfig = await prisma.businessConfig.upsert({
        where: { organizationId },
        update: {
          voiceSettings: updatedVoiceSettings
        },
        create: {
          organizationId,
          voiceSettings: updatedVoiceSettings
        }
      });

      // IMPORTANT: Invalidate organization cache when voice settings change
      const { OrganizationContextService } = require('../services/organizationContext');
      const contextService = new OrganizationContextService();
      await contextService.invalidateOrganizationCache(organizationId);

      fastify.log.info(`Voice settings updated for organization: ${organizationId}, voice: ${voiceModel}`);

      return updatedVoiceSettings;
    } catch (error) {
      fastify.log.error('Error updating voice settings:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Test voice with custom text
  fastify.post('/test', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { text, voiceModel } = request.body;
    
    // Validate required fields
    if (!text || !voiceModel) {
      return reply.code(400).send({ error: 'Text and voice model are required' });
    }

    // Validate voice model is one of the allowed options
    const allowedVoices = ['saturn', 'harmonia', 'hera', 'zeus'];
    if (!allowedVoices.includes(voiceModel)) {
      return reply.code(400).send({ error: 'Invalid voice model selected' });
    }

    try {
      // Create TTS service instance
      const ttsService = new TTSService();
      
      // Generate speech with the specified voice model
      const audioStream = await ttsService.getSpeech(text, {
        model: voiceModel,
        encoding: 'mulaw',
        sample_rate: 8000,
        container: 'none'
      });

      // Convert stream to buffer
      const chunks = [];
      audioStream.on('data', (chunk) => chunks.push(chunk));
      
      await new Promise((resolve, reject) => {
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });

      const audioBuffer = Buffer.concat(chunks);

      // Set response headers for audio
      reply.header('Content-Type', 'audio/wav');
      reply.header('Content-Length', audioBuffer.length);
      reply.header('Cache-Control', 'no-cache');
      
      return audioBuffer;
    } catch (error) {
      fastify.log.error('Error testing voice:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get available voices
  fastify.get('/available', async (request, reply) => {
    try {
      const voices = [
        { id: 'saturn', name: 'Saturn', description: 'Deep, authoritative male voice' },
        { id: 'harmonia', name: 'Harmonia', description: 'Warm, friendly female voice' },
        { id: 'hera', name: 'Hera', description: 'Professional, confident female voice' },
        { id: 'zeus', name: 'Zeus', description: 'Strong, commanding male voice' }
      ];

      return voices;
    } catch (error) {
      fastify.log.error('Error fetching available voices:', error);
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = voiceRoutes;