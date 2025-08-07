const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function callRoutes(fastify, options) {
  // Get call logs with pagination and filtering
  fastify.get('/', async (request, reply) => {
    const { organizationId } = request.user;
    const { 
      page = 1, 
      limit = 20, 
      status, 
      startDate, 
      endDate,
      callerPhone 
    } = request.query;
    
    try {
      const where = {
        organizationId,
        ...(status && { status }),
        ...(callerPhone && { callerPhone: { contains: callerPhone } }),
        ...(startDate && endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        })
      };

      const [calls, total] = await Promise.all([
        prisma.call.findMany({
          where,
          include: {
            turns: {
              orderBy: { turnIndex: 'asc' },
              select: {
                id: true,
                turnIndex: true,
                transcriptIn: true,
                transcriptOut: true,
                asrMs: true,
                llmMs: true,
                ttsMs: true,
                createdAt: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.call.count({ where })
      ]);

      return {
        calls,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get specific call details
  fastify.get('/:id', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;
    
    try {
      const call = await prisma.call.findFirst({
        where: {
          id,
          organizationId
        },
        include: {
          turns: {
            orderBy: { turnIndex: 'asc' }
          }
        }
      });

      if (!call) {
        return reply.code(404).send({ error: 'Call not found' });
      }

      return call;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get call analytics/summary
  fastify.get('/analytics/summary', async (request, reply) => {
    const { organizationId } = request.user;
    const { startDate, endDate } = request.query;
    
    try {
      const where = {
        organizationId,
        ...(startDate && endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        })
      };

      const [
        totalCalls,
        successfulCalls,
        avgDuration,
        totalTurns,
        avgTurnsPerCall
      ] = await Promise.all([
        prisma.call.count({ where }),
        prisma.call.count({ 
          where: { 
            ...where, 
            status: 'completed' 
          } 
        }),
        prisma.call.aggregate({
          where,
          _avg: { durationSeconds: true }
        }),
        prisma.turn.count({
          where: {
            call: where
          }
        }),
        prisma.call.aggregate({
          where,
          _avg: { totalTurns: true }
        })
      ]);

      return {
        totalCalls,
        successfulCalls,
        successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
        avgDuration: avgDuration._avg.durationSeconds || 0,
        totalTurns,
        avgTurnsPerCall: avgTurnsPerCall._avg.totalTurns || 0
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get call performance metrics
  fastify.get('/analytics/performance', async (request, reply) => {
    const { organizationId } = request.user;
    const { startDate, endDate } = request.query;
    
    try {
      const where = {
        call: {
          organizationId,
          ...(startDate && endDate && {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          })
        }
      };

      const [asrMetrics, llmMetrics, ttsMetrics] = await Promise.all([
        prisma.turn.aggregate({
          where,
          _avg: { asrMs: true },
          _min: { asrMs: true },
          _max: { asrMs: true }
        }),
        prisma.turn.aggregate({
          where,
          _avg: { llmMs: true },
          _min: { llmMs: true },
          _max: { llmMs: true }
        }),
        prisma.turn.aggregate({
          where,
          _avg: { ttsMs: true },
          _min: { ttsMs: true },
          _max: { ttsMs: true }
        })
      ]);

      return {
        asr: {
          avg: asrMetrics._avg.asrMs || 0,
          min: asrMetrics._min.asrMs || 0,
          max: asrMetrics._max.asrMs || 0
        },
        llm: {
          avg: llmMetrics._avg.llmMs || 0,
          min: llmMetrics._min.llmMs || 0,
          max: llmMetrics._max.llmMs || 0
        },
        tts: {
          avg: ttsMetrics._avg.ttsMs || 0,
          min: ttsMetrics._min.ttsMs || 0,
          max: ttsMetrics._max.ttsMs || 0
        }
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = callRoutes; 