const { PrismaClient } = require('@prisma/client');
// Authentication is handled at the parent level in index.js

const prisma = new PrismaClient();

async function dashboardRoutes(fastify, options) {
  // Authentication is handled at the parent level in index.js

  // Get real-time dashboard metrics
  fastify.get('/metrics', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's calls count
      const todayCallsCount = await prisma.call.count({
        where: {
          organizationId,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      // Get today's successful bookings count
      const todayBookings = await prisma.appointment.count({
        where: {
          organizationId,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      // Calculate booking rate
      const bookingRate = todayCallsCount > 0 ? 
        Math.round((todayBookings / todayCallsCount) * 100) : 0;

      // Get average latency from recent turns
      const recentTurns = await prisma.turn.findMany({
        where: {
          call: {
            organizationId
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          asrMs: true,
          llmMs: true,
          ttsMs: true
        },
        take: 100
      });

      const avgLatency = recentTurns.length > 0 ? 
        Math.round(recentTurns.reduce((sum, turn) => {
          const totalMs = (turn.asrMs || 0) + (turn.llmMs || 0) + (turn.ttsMs || 0);
          return sum + totalMs;
        }, 0) / recentTurns.length) : 0;

      // Calculate estimated revenue (placeholder - would need pricing config)
      const revenue = todayBookings * 50; // Assume $50 per booking

      return {
        todayCalls: todayCallsCount,
        todayBookings,
        bookingRate,
        avgLatency,
        revenue
      };
    } catch (error) {
      fastify.log.error('Error fetching dashboard metrics:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get recent call activity
  fastify.get('/recent-calls', async (request, reply) => {
    const { organizationId } = request.user;
    const { limit = 10, offset = 0 } = request.query;
    
    try {
      const calls = await prisma.call.findMany({
        where: { organizationId },
        select: {
          id: true,
          callerPhone: true,
          status: true,
          currentState: true,
          durationSeconds: true,
          createdAt: true,
          finalContext: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      // Transform the data to match frontend expectations
      const transformedCalls = calls.map(call => {
        const finalContext = call.finalContext || {};
        return {
          id: call.id,
          callerPhone: call.callerPhone || 'Unknown',
          status: call.status || 'unknown',
          service: finalContext.service || 'Unknown',
          duration: call.durationSeconds || 0,
          timestamp: call.createdAt,
          currentState: call.currentState
        };
      });

      return transformedCalls;
    } catch (error) {
      fastify.log.error('Error fetching recent calls:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get today's scheduled appointments
  fastify.get('/today-bookings', async (request, reply) => {
    const { organizationId } = request.user;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const appointments = await prisma.appointment.findMany({
        where: {
          organizationId,
          startAt: {
            gte: today,
            lt: tomorrow
          }
        },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          service: true,
          provider: true,
          contactPhone: true,
          status: true,
          notes: true
        },
        orderBy: { startAt: 'asc' }
      });

      // Transform to match frontend expectations
      const transformedBookings = appointments.map(apt => ({
        id: apt.id,
        time: apt.startAt,
        endTime: apt.endAt,
        service: apt.service || 'General',
        provider: apt.provider || 'Staff',
        client: apt.contactPhone || 'Unknown',
        status: apt.status || 'scheduled',
        notes: apt.notes
      }));

      return transformedBookings;
    } catch (error) {
      fastify.log.error('Error fetching today bookings:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get call analytics data for charts
  fastify.get('/analytics', async (request, reply) => {
    const { organizationId } = request.user;
    const { period = '7d' } = request.query;
    
    try {
      let startDate = new Date();
      
      // Determine date range based on period
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

      // Get calls grouped by date
      const callsData = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as calls,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls
        FROM "Call" 
        WHERE organization_id = ${organizationId}::uuid
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      // Get appointments grouped by date
      const appointmentsData = await prisma.$queryRaw`
        SELECT 
          DATE(start_at) as date,
          COUNT(*) as bookings
        FROM "Appointment" 
        WHERE organization_id = ${organizationId}::uuid
          AND start_at >= ${startDate}
        GROUP BY DATE(start_at)
        ORDER BY date ASC
      `;

      return {
        calls: callsData,
        appointments: appointmentsData
      };
    } catch (error) {
      fastify.log.error('Error fetching analytics data:', error);
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = dashboardRoutes;