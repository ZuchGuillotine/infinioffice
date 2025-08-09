const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true
      }
    });

    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    // Add user context to request
    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    };

  } catch (error) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
}

// Role-based access control middleware
function requireRole(allowedRoles) {
  return async function(request, reply) {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }
    
    // If checks pass, continue to the route handler
    // In Fastify, returning void means to continue
    return;
  };
}

module.exports = {
  authMiddleware,
  requireRole
}; 