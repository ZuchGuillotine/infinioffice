const { PrismaClient } = require('@prisma/client');
// Authentication is handled at the parent level in index.js

const prisma = new PrismaClient();

async function userRoutes(fastify, options) {
  // Authentication is handled at the parent level in index.js

  // Get current user profile
  fastify.get('/profile', async (request, reply) => {
    const { userId } = request.user;
    
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              plan: true,
              smsBranding: true
            }
          }
        }
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organization: user.organization
      };
    } catch (error) {
      fastify.log.error('Error fetching user profile:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update user profile
  fastify.put('/profile', async (request, reply) => {
    const { userId } = request.user;
    const { email, currentPassword, newPassword } = request.body;
    
    // Validate input
    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    try {
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId }
        }
      });

      if (existingUser) {
        return reply.code(400).send({ error: 'Email is already taken' });
      }

      // For now, we'll skip password validation since it's not implemented in the current auth system
      // In production, you would validate currentPassword and hash newPassword

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          email,
          // Note: Password update would go here in a full implementation
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              plan: true,
              smsBranding: true
            }
          }
        }
      });

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        organization: updatedUser.organization
      };
    } catch (error) {
      fastify.log.error('Error updating user profile:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get user preferences
  fastify.get('/preferences', async (request, reply) => {
    const { userId } = request.user;
    
    try {
      // For now, return default preferences
      // In a full implementation, you might have a UserPreferences table
      return {
        userId,
        theme: 'light',
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        timezone: 'America/New_York',
        language: 'en'
      };
    } catch (error) {
      fastify.log.error('Error fetching user preferences:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Update user preferences
  fastify.put('/preferences', async (request, reply) => {
    const { userId } = request.user;
    const { theme, notifications, timezone, language } = request.body;
    
    try {
      // For now, just return the updated preferences
      // In a full implementation, you would save to UserPreferences table
      return {
        userId,
        theme: theme || 'light',
        notifications: notifications || {
          email: true,
          sms: false,
          push: true
        },
        timezone: timezone || 'America/New_York',
        language: language || 'en'
      };
    } catch (error) {
      fastify.log.error('Error updating user preferences:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  // Get user activity/audit log
  fastify.get('/activity', async (request, reply) => {
    const { userId } = request.user;
    const { limit = 20, offset = 0 } = request.query;
    
    try {
      // For now, return activity from calls and appointments created by this user
      // In a full implementation, you might have a UserActivity table
      
      const recentCalls = await prisma.call.findMany({
        where: {
          organizationId: request.user.organizationId,
          // In a full implementation, you'd track which user initiated each call
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          callerPhone: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      // Transform to activity format
      const activities = recentCalls.map(call => ({
        id: call.id,
        type: 'call_handled',
        description: `Handled call from ${call.callerPhone || 'unknown number'}`,
        status: call.status,
        timestamp: call.createdAt
      }));

      return {
        activities,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: activities.length === parseInt(limit)
        }
      };
    } catch (error) {
      fastify.log.error('Error fetching user activity:', error);
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = userRoutes;