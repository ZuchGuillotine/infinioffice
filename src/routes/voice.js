const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { TTSService } = require('../services/tts');
const { handleIncomingCall } = require('../services/telephony');

const prisma = new PrismaClient();

async function voiceRoutes(fastify, options) {
  // Authentication is handled at the parent level in index.js

  // Generate TTS preview for text
  fastify.post('/preview', async (request, reply) => {
    const { organizationId } = request.user;
    const { text, voiceModel = 'aura-aurora-en' } = request.body;
    const voice = voiceModel;
    
    if (!text) {
      return reply.code(400).send({ error: 'Text is required for preview' });
    }

    if (text.length > 1000) {
      return reply.code(400).send({ error: 'Text too long for preview (max 1000 characters)' });
    }

    try {
      const ttsService = new TTSService();
      
      // Generate TTS with higher quality for preview
      const audioStream = await ttsService.getSpeech(text, {
        model: voice,
        encoding: 'mp3', // Better quality for preview
        sample_rate: 16000,
        container: 'none'
      });

      // Convert stream to buffer for preview
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        audioStream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        audioStream.on('end', () => {
          const audioBuffer = Buffer.concat(chunks);
          
          // Set appropriate headers for audio response
          reply.type('audio/mpeg');
          reply.header('Content-Disposition', 'attachment; filename="preview.mp3"');
          reply.header('Content-Length', audioBuffer.length);
          
          resolve(audioBuffer);
        });

        audioStream.on('error', (error) => {
          fastify.log.error('Error generating TTS preview:', error);
          reject({ error: error.message });
        });
      });

    } catch (error) {
      fastify.log.error('Error in TTS preview:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Test TTS with organization's greeting
  fastify.post('/test-greeting', async (request, reply) => {
    const { organizationId } = request.user;
    const { voice = 'aura-aurora-en' } = request.body;
    
    try {
      // Get organization's greeting
      const businessConfig = await prisma.businessConfig.findUnique({
        where: { organizationId },
        select: { greeting: true }
      });

      const greeting = businessConfig?.greeting || 
        "Hello! Thank you for calling. I'm here to help you schedule an appointment. How can I assist you today?";

      const ttsService = new TTSService();
      
      // Generate TTS preview
      const audioStream = await ttsService.getSpeech(greeting, {
        model: voice,
        encoding: 'mp3',
        sample_rate: 16000,
        container: 'none'
      });

      // Convert stream to buffer
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        audioStream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        audioStream.on('end', () => {
          const audioBuffer = Buffer.concat(chunks);
          
          reply.type('audio/mpeg');
          reply.header('Content-Disposition', 'attachment; filename="greeting-test.mp3"');
          reply.header('Content-Length', audioBuffer.length);
          
          resolve(audioBuffer);
        });

        audioStream.on('error', (error) => {
          fastify.log.error('Error testing greeting:', error);
          reject({ error: error.message });
        });
      });

    } catch (error) {
      fastify.log.error('Error testing greeting:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get available voice models
  fastify.get('/models', async (request, reply) => {
    try {
      // Return available Deepgram Aura voice models
      const voices = [
        {
          id: 'aura-aurora-en',
          name: 'Aurora',
          language: 'en-US',
          gender: 'female',
          description: 'Warm and professional female voice'
        },
        {
          id: 'aura-harmonia-en',
          name: 'Harmonia',
          language: 'en-US',
          gender: 'female',
          description: 'Elegant and articulate female voice'
        },
        {
          id: 'aura-zeus-en',
          name: 'Zeus',
          language: 'en-US',
          gender: 'male',
          description: 'Authoritative and confident male voice'
        },
        {
          id: 'aura-saturn-en',
          name: 'Saturn',
          language: 'en-US',
          gender: 'male',
          description: 'Deep and reassuring male voice'
        }
      ];

      return voices;
    } catch (error) {
      fastify.log.error('Error fetching voice models:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Trigger demo call (placeholder - would integrate with Twilio API)
  fastify.post('/demo-call', {
    preHandler: requireRole(['admin', 'operator'])
  }, async (request, reply) => {
    const { organizationId } = request.user;
    const { phoneNumber, testScript } = request.body;
    
    if (!phoneNumber) {
      return reply.code(400).send({ error: 'Phone number is required for demo call' });
    }

    try {
      // In a full implementation, this would:
      // 1. Use Twilio API to initiate an outbound call
      // 2. Connect the call to the WebSocket endpoint
      // 3. Run through a demo script
      
      // For now, simulate demo call creation
      const demoCall = {
        id: `demo-${Date.now()}`,
        phoneNumber,
        status: 'initiated',
        type: 'demo',
        organizationId,
        createdAt: new Date().toISOString(),
        testScript: testScript || 'Default demo script'
      };

      // Log the demo call attempt
      fastify.log.info('Demo call initiated:', demoCall);

      // In production, you might store this in the database
      // await prisma.call.create({ data: { ... } });

      return {
        success: true,
        demoCall,
        message: 'Demo call initiated. This is a placeholder - full implementation would use Twilio API to make the actual call.'
      };
    } catch (error) {
      fastify.log.error('Error initiating demo call:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get voice analytics/metrics
  fastify.get('/analytics', async (request, reply) => {
    const { organizationId } = request.user;
    const { period = '7d' } = request.query;
    
    try {
      let startDate = new Date();
      
      switch (period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // Get TTS/voice related metrics from turns
      const turns = await prisma.turn.findMany({
        where: {
          call: {
            organizationId
          },
          createdAt: {
            gte: startDate
          }
        },
        select: {
          ttsMs: true,
          asrMs: true,
          llmMs: true,
          createdAt: true
        }
      });

      // Calculate voice analytics
      const totalTurns = turns.length;
      const avgTtsLatency = totalTurns > 0 ? 
        Math.round(turns.reduce((sum, turn) => sum + (turn.ttsMs || 0), 0) / totalTurns) : 0;
      const avgAsrLatency = totalTurns > 0 ? 
        Math.round(turns.reduce((sum, turn) => sum + (turn.asrMs || 0), 0) / totalTurns) : 0;
      const avgLlmLatency = totalTurns > 0 ? 
        Math.round(turns.reduce((sum, turn) => sum + (turn.llmMs || 0), 0) / totalTurns) : 0;

      // Group by date for trend analysis
      const dailyMetrics = turns.reduce((acc, turn) => {
        const date = turn.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, turns: 0, totalTtsMs: 0, totalAsrMs: 0, totalLlmMs: 0 };
        }
        acc[date].turns++;
        acc[date].totalTtsMs += turn.ttsMs || 0;
        acc[date].totalAsrMs += turn.asrMs || 0;
        acc[date].totalLlmMs += turn.llmMs || 0;
        return acc;
      }, {});

      const trendData = Object.values(dailyMetrics).map(day => ({
        date: day.date,
        turns: day.turns,
        avgTtsMs: day.turns > 0 ? Math.round(day.totalTtsMs / day.turns) : 0,
        avgAsrMs: day.turns > 0 ? Math.round(day.totalAsrMs / day.turns) : 0,
        avgLlmMs: day.turns > 0 ? Math.round(day.totalLlmMs / day.turns) : 0
      }));

      return {
        period,
        summary: {
          totalTurns,
          avgTtsLatency,
          avgAsrLatency,
          avgLlmLatency,
          avgTotalLatency: avgTtsLatency + avgAsrLatency + avgLlmLatency
        },
        trends: trendData.sort((a, b) => a.date.localeCompare(b.date))
      };
    } catch (error) {
      fastify.log.error('Error fetching voice analytics:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Health check for voice services
  fastify.get('/health', async (request, reply) => {
    try {
      const health = {
        deepgram: !!process.env.DEEPGRAM_API_KEY,
        tts: true, // TTS service is available if Deepgram key exists
        timestamp: new Date().toISOString()
      };

      // Test TTS service
      try {
        const ttsService = new TTSService();
        health.ttsService = 'available';
      } catch (error) {
        health.ttsService = 'error';
        health.ttsError = error.message;
      }

      return health;
    } catch (error) {
      fastify.log.error('Error checking voice health:', error);
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = voiceRoutes;