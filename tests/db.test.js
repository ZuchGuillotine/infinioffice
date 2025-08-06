
const { createAppointment, getAppointments } = require('../src/services/db');
const { PrismaClient } = require('@prisma/client');

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    appointment: {
      create: jest.fn().mockResolvedValue({ id: 1, name: 'Test Appointment' }),
      findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Test Appointment' }]),
    },
  })),
}));

describe('Database Service', () => {
  it('should create an appointment', async () => {
    const appointment = await createAppointment({ name: 'Test Appointment' });
    expect(appointment).toBeDefined();
    expect(appointment.id).toBe(1);
  });

  it('should get all appointments', async () => {
    const appointments = await getAppointments();
    expect(appointments).toBeDefined();
    expect(appointments.length).toBe(1);
  });
});
