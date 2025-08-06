
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const createAppointment = async (data) => {
  const appointment = await prisma.appointment.create({ data });
  return appointment;
};

const getAppointments = async () => {
  const appointments = await prisma.appointment.findMany();
  return appointments;
};

module.exports = {
  createAppointment,
  getAppointments,
};
