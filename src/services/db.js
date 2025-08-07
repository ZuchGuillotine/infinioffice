const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Appointment functions
const createAppointment = async (data) => {
  const appointment = await prisma.appointment.create({ data });
  return appointment;
};

const getAppointments = async () => {
  const appointments = await prisma.appointment.findMany();
  return appointments;
};

// Call tracking functions
const createCall = async (data) => {
  try {
    const call = await prisma.call.create({ data });
    return call;
  } catch (error) {
    console.error('Database error creating call:', error);
    throw error;
  }
};

const updateCall = async (callId, updates) => {
  try {
    const call = await prisma.call.update({
      where: { id: callId },
      data: updates
    });
    return call;
  } catch (error) {
    console.error('Database error updating call:', error);
    return null;
  }
};

const getCall = async (callId) => {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { turns: true }
    });
    return call;
  } catch (error) {
    console.error('Database error getting call:', error);
    return null;
  }
};

// Turn tracking functions
const createTurn = async (data) => {
  try {
    const turn = await prisma.turn.create({ data });
    return turn;
  } catch (error) {
    console.error('Database error creating turn:', error);
    throw error;
  }
};

const updateTurn = async (turnId, updates) => {
  try {
    const turn = await prisma.turn.update({
      where: { id: turnId },
      data: updates
    });
    return turn;
  } catch (error) {
    console.error('Database error updating turn:', error);
    return null;
  }
};

const getTurnsByCall = async (callId) => {
  try {
    const turns = await prisma.turn.findMany({
      where: { callId },
      orderBy: { timestamp: 'asc' }
    });
    return turns;
  } catch (error) {
    console.error('Database error getting turns:', error);
    return [];
  }
};

// Analytics functions
const getCallStats = async (dateRange = {}) => {
  try {
    const where = {};
    if (dateRange.start) where.startedAt = { gte: dateRange.start };
    if (dateRange.end) where.startedAt = { ...where.startedAt, lte: dateRange.end };

    const stats = await prisma.call.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    });
    return stats;
  } catch (error) {
    console.error('Database error getting call stats:', error);
    return [];
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  createCall,
  updateCall,
  getCall,
  createTurn,
  updateTurn,
  getTurnsByCall,
  getCallStats,
};