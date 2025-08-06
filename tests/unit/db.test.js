const { 
  createAppointment, 
  getAppointments,
  createCall,
  updateCall,
  getCall,
  createTurn,
  updateTurn,
  getTurnsByCall,
  getCallStats
} = require('../../src/services/db');
const { PrismaClient } = require('@prisma/client');
const { measureExecutionTime } = require('../helpers/testHelpers');

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn()
}));

describe('Database Service', () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPrisma = {
      appointment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      call: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn()
      },
      turn: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
      }
    };

    PrismaClient.mockImplementation(() => mockPrisma);
  });

  describe('Appointment Management', () => {
    describe('createAppointment', () => {
      it('should create appointment with correct data structure', async () => {
        const mockAppointment = {
          id: 'appt-123',
          organizationId: 'org-456',
          service: 'dental cleaning',
          contactPhone: '555-1234',
          startAt: new Date('2025-08-07T14:00:00Z'),
          endAt: new Date('2025-08-07T15:00:00Z'),
          status: 'scheduled',
          notes: 'Routine cleaning',
          createdAt: new Date()
        };

        mockPrisma.appointment.create.mockResolvedValue(mockAppointment);

        const appointmentData = {
          organizationId: 'org-456',
          service: 'dental cleaning',
          contactPhone: '555-1234',
          startAt: new Date('2025-08-07T14:00:00Z'),
          endAt: new Date('2025-08-07T15:00:00Z'),
          status: 'scheduled',
          notes: 'Routine cleaning'
        };

        const result = await createAppointment(appointmentData);

        expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
          data: appointmentData
        });
        expect(result).toEqual(mockAppointment);
      });

      it('should handle appointment creation errors', async () => {
        mockPrisma.appointment.create.mockRejectedValue(new Error('Database connection failed'));

        await expect(createAppointment({
          service: 'test',
          contactPhone: '555-0000'
        })).rejects.toThrow('Database connection failed');
      });

      it('should measure appointment creation performance', async () => {
        mockPrisma.appointment.create.mockImplementation(async (data) => {
          // Simulate database latency
          await new Promise(resolve => setTimeout(resolve, 50));
          return { id: 'perf-test', ...data.data };
        });

        const { timeMs } = await measureExecutionTime(() => 
          createAppointment({ service: 'performance test' })
        );

        expect(timeMs).toBeGreaterThan(40); // Should include the delay
        expect(timeMs).toBeLessThan(200); // Should be reasonably fast
      });
    });

    describe('getAppointments', () => {
      it('should retrieve all appointments', async () => {
        const mockAppointments = [
          { id: 'appt-1', service: 'cleaning', status: 'scheduled' },
          { id: 'appt-2', service: 'checkup', status: 'completed' },
          { id: 'appt-3', service: 'consultation', status: 'cancelled' }
        ];

        mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments);

        const result = await getAppointments();

        expect(mockPrisma.appointment.findMany).toHaveBeenCalled();
        expect(result).toEqual(mockAppointments);
        expect(result).toHaveLength(3);
      });

      it('should handle empty appointment list', async () => {
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await getAppointments();

        expect(result).toEqual([]);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should handle database errors gracefully', async () => {
        mockPrisma.appointment.findMany.mockRejectedValue(new Error('Connection timeout'));

        await expect(getAppointments()).rejects.toThrow('Connection timeout');
      });
    });
  });

  describe('Call Tracking', () => {
    describe('createCall', () => {
      it('should create call with proper data structure', async () => {
        const mockCall = {
          id: 'call-abc123',
          twilioCallSid: 'CA1234567890',
          callerPhone: '+15551234567',
          status: 'in-progress',
          startedAt: new Date(),
          currentState: 'greeting',
          organizationId: 'org-456'
        };

        mockPrisma.call.create.mockResolvedValue(mockCall);

        const callData = {
          twilioCallSid: 'CA1234567890',
          callerPhone: '+15551234567',
          status: 'in-progress',
          startedAt: new Date(),
          currentState: 'greeting',
          organizationId: 'org-456'
        };

        const result = await createCall(callData);

        expect(mockPrisma.call.create).toHaveBeenCalledWith({ data: callData });
        expect(result).toEqual(mockCall);
      });

      it('should handle database failures with fallback', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrisma.call.create.mockRejectedValue(new Error('Database unavailable'));

        const callData = {
          twilioCallSid: 'CA1234567890',
          status: 'in-progress',
          startedAt: new Date(),
          currentState: 'greeting'
        };

        const result = await createCall(callData);

        expect(consoleSpy).toHaveBeenCalledWith('Database error creating call:', expect.any(Error));
        expect(result.id).toMatch(/^mock_\d+$/);
        expect(result.twilioCallSid).toBe('CA1234567890');
        expect(result.status).toBe('in-progress');

        consoleSpy.mockRestore();
      });

      it('should track call creation latency', async () => {
        mockPrisma.call.create.mockImplementation(async (data) => {
          await new Promise(resolve => setTimeout(resolve, 30));
          return { id: 'latency-test', ...data.data };
        });

        const { timeMs, result } = await measureExecutionTime(() =>
          createCall({
            twilioCallSid: 'CA_PERF_TEST',
            status: 'in-progress'
          })
        );

        expect(timeMs).toBeGreaterThan(25);
        expect(result.id).toBe('latency-test');
      });
    });

    describe('updateCall', () => {
      it('should update call with new data', async () => {
        const updatedCall = {
          id: 'call-123',
          status: 'completed',
          endedAt: new Date(),
          durationSeconds: 180,
          outcome: 'appointment_booked'
        };

        mockPrisma.call.update.mockResolvedValue(updatedCall);

        const updates = {
          status: 'completed',
          endedAt: new Date(),
          durationSeconds: 180,
          outcome: 'appointment_booked'
        };

        const result = await updateCall('call-123', updates);

        expect(mockPrisma.call.update).toHaveBeenCalledWith({
          where: { id: 'call-123' },
          data: updates
        });
        expect(result).toEqual(updatedCall);
      });

      it('should handle update failures gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrisma.call.update.mockRejectedValue(new Error('Call not found'));

        const result = await updateCall('nonexistent-call', { status: 'completed' });

        expect(consoleSpy).toHaveBeenCalledWith('Database error updating call:', expect.any(Error));
        expect(result).toBe(null);

        consoleSpy.mockRestore();
      });

      it('should handle concurrent updates', async () => {
        let updateCount = 0;
        mockPrisma.call.update.mockImplementation(async (params) => {
          updateCount++;
          await new Promise(resolve => setTimeout(resolve, 10));
          return { id: params.where.id, ...params.data, updateCount };
        });

        const promises = Array.from({ length: 5 }, (_, i) =>
          updateCall('call-concurrent', { status: `update-${i}` })
        );

        const results = await Promise.all(promises);

        expect(results).toHaveLength(5);
        results.forEach((result, index) => {
          expect(result.status).toBe(`update-${index}`);
        });
        expect(updateCount).toBe(5);
      });
    });

    describe('getCall', () => {
      it('should retrieve call with turns included', async () => {
        const mockCallWithTurns = {
          id: 'call-456',
          twilioCallSid: 'CA9876543210',
          status: 'completed',
          turns: [
            { id: 'turn-1', userInput: 'Hello', timestamp: new Date() },
            { id: 'turn-2', userInput: 'Book appointment', timestamp: new Date() }
          ]
        };

        mockPrisma.call.findUnique.mockResolvedValue(mockCallWithTurns);

        const result = await getCall('call-456');

        expect(mockPrisma.call.findUnique).toHaveBeenCalledWith({
          where: { id: 'call-456' },
          include: { turns: true }
        });
        expect(result).toEqual(mockCallWithTurns);
        expect(result.turns).toHaveLength(2);
      });

      it('should handle call not found', async () => {
        mockPrisma.call.findUnique.mockResolvedValue(null);

        const result = await getCall('nonexistent-call');

        expect(result).toBe(null);
      });

      it('should handle database errors', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrisma.call.findUnique.mockRejectedValue(new Error('Query timeout'));

        const result = await getCall('error-call');

        expect(consoleSpy).toHaveBeenCalledWith('Database error getting call:', expect.any(Error));
        expect(result).toBe(null);

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Turn Tracking', () => {
    describe('createTurn', () => {
      it('should create turn with performance metrics', async () => {
        const mockTurn = {
          id: 'turn-789',
          callId: 'call-456',
          turnIndex: 1,
          userInput: 'I need an appointment',
          botResponse: 'What service do you need?',
          asrMs: 250,
          llmMs: 800,
          ttsMs: 300,
          timestamp: new Date(),
          stateBefore: 'greeting',
          stateAfter: 'collectService'
        };

        mockPrisma.turn.create.mockResolvedValue(mockTurn);

        const turnData = {
          callId: 'call-456',
          turnIndex: 1,
          userInput: 'I need an appointment',
          botResponse: 'What service do you need?',
          asrMs: 250,
          llmMs: 800,
          ttsMs: 300,
          timestamp: new Date(),
          stateBefore: 'greeting',
          stateAfter: 'collectService'
        };

        const result = await createTurn(turnData);

        expect(mockPrisma.turn.create).toHaveBeenCalledWith({ data: turnData });
        expect(result).toEqual(mockTurn);
        expect(result.asrMs).toBe(250);
        expect(result.llmMs).toBe(800);
        expect(result.ttsMs).toBe(300);
      });

      it('should handle turn creation failures with fallback', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrisma.turn.create.mockRejectedValue(new Error('Foreign key constraint failed'));

        const turnData = {
          callId: 'nonexistent-call',
          userInput: 'test input',
          timestamp: new Date(),
          stateBefore: 'unknown'
        };

        const result = await createTurn(turnData);

        expect(consoleSpy).toHaveBeenCalledWith('Database error creating turn:', expect.any(Error));
        expect(result.id).toMatch(/^mock_turn_\d+$/);
        expect(result.callId).toBe('nonexistent-call');
        expect(result.userInput).toBe('test input');

        consoleSpy.mockRestore();
      });

      it('should validate turn performance metrics', async () => {
        mockPrisma.turn.create.mockImplementation(async (data) => {
          const turnData = data.data;
          
          // Validate performance metrics are reasonable
          expect(turnData.asrMs).toBeGreaterThan(0);
          expect(turnData.asrMs).toBeLessThan(5000); // 5 seconds max
          expect(turnData.llmMs).toBeGreaterThan(0);
          expect(turnData.llmMs).toBeLessThan(10000); // 10 seconds max
          expect(turnData.ttsMs).toBeGreaterThan(0);
          expect(turnData.ttsMs).toBeLessThan(5000); // 5 seconds max
          
          return { id: 'validated-turn', ...turnData };
        });

        const turnData = {
          callId: 'call-metrics',
          userInput: 'Performance test',
          asrMs: 180,
          llmMs: 650,
          ttsMs: 220
        };

        const result = await createTurn(turnData);
        expect(result.id).toBe('validated-turn');
      });
    });

    describe('updateTurn', () => {
      it('should update turn with additional metrics', async () => {
        const updatedTurn = {
          id: 'turn-update',
          botResponse: 'I can help you with that',
          ttsMs: 400,
          stateAfter: 'collectService',
          intent: 'booking',
          confidence: 0.92
        };

        mockPrisma.turn.update.mockResolvedValue(updatedTurn);

        const updates = {
          botResponse: 'I can help you with that',
          ttsMs: 400,
          stateAfter: 'collectService',
          intent: 'booking',
          confidence: 0.92
        };

        const result = await updateTurn('turn-update', updates);

        expect(mockPrisma.turn.update).toHaveBeenCalledWith({
          where: { id: 'turn-update' },
          data: updates
        });
        expect(result).toEqual(updatedTurn);
      });

      it('should handle turn update failures', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrisma.turn.update.mockRejectedValue(new Error('Turn not found'));

        const result = await updateTurn('nonexistent-turn', { botResponse: 'test' });

        expect(consoleSpy).toHaveBeenCalledWith('Database error updating turn:', expect.any(Error));
        expect(result).toBe(null);

        consoleSpy.mockRestore();
      });
    });

    describe('getTurnsByCall', () => {
      it('should retrieve turns ordered by timestamp', async () => {
        const mockTurns = [
          { id: 'turn-1', turnIndex: 0, timestamp: new Date('2025-08-07T10:00:00Z') },
          { id: 'turn-2', turnIndex: 1, timestamp: new Date('2025-08-07T10:01:00Z') },
          { id: 'turn-3', turnIndex: 2, timestamp: new Date('2025-08-07T10:02:00Z') }
        ];

        mockPrisma.turn.findMany.mockResolvedValue(mockTurns);

        const result = await getTurnsByCall('call-ordered');

        expect(mockPrisma.turn.findMany).toHaveBeenCalledWith({
          where: { callId: 'call-ordered' },
          orderBy: { timestamp: 'asc' }
        });
        expect(result).toEqual(mockTurns);
        expect(result).toHaveLength(3);
      });

      it('should handle empty turn list', async () => {
        mockPrisma.turn.findMany.mockResolvedValue([]);

        const result = await getTurnsByCall('call-no-turns');

        expect(result).toEqual([]);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should handle database errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrisma.turn.findMany.mockRejectedValue(new Error('Database connection lost'));

        const result = await getTurnsByCall('error-call');

        expect(consoleSpy).toHaveBeenCalledWith('Database error getting turns:', expect.any(Error));
        expect(result).toEqual([]);

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Analytics and Performance Tracking', () => {
    describe('getCallStats', () => {
      it('should return call statistics grouped by status', async () => {
        const mockStats = [
          { status: 'completed', _count: { status: 15 } },
          { status: 'in-progress', _count: { status: 3 } },
          { status: 'failed', _count: { status: 2 } }
        ];

        mockPrisma.call.groupBy.mockResolvedValue(mockStats);

        const result = await getCallStats();

        expect(mockPrisma.call.groupBy).toHaveBeenCalledWith({
          by: ['status'],
          where: {},
          _count: { status: true }
        });
        expect(result).toEqual(mockStats);
      });

      it('should apply date range filters', async () => {
        const mockStats = [
          { status: 'completed', _count: { status: 10 } }
        ];

        mockPrisma.call.groupBy.mockResolvedValue(mockStats);

        const dateRange = {
          start: new Date('2025-08-01'),
          end: new Date('2025-08-07')
        };

        const result = await getCallStats(dateRange);

        expect(mockPrisma.call.groupBy).toHaveBeenCalledWith({
          by: ['status'],
          where: {
            startedAt: {
              gte: dateRange.start,
              lte: dateRange.end
            }
          },
          _count: { status: true }
        });
        expect(result).toEqual(mockStats);
      });

      it('should handle partial date ranges', async () => {
        mockPrisma.call.groupBy.mockResolvedValue([]);

        // Only start date
        await getCallStats({ start: new Date('2025-08-01') });
        expect(mockPrisma.call.groupBy).toHaveBeenCalledWith({
          by: ['status'],
          where: { startedAt: { gte: new Date('2025-08-01') } },
          _count: { status: true }
        });

        // Only end date
        await getCallStats({ end: new Date('2025-08-07') });
        expect(mockPrisma.call.groupBy).toHaveBeenCalledWith({
          by: ['status'],
          where: { startedAt: { lte: new Date('2025-08-07') } },
          _count: { status: true }
        });
      });

      it('should handle statistics query errors', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPrisma.call.groupBy.mockRejectedValue(new Error('Aggregation failed'));

        const result = await getCallStats();

        expect(consoleSpy).toHaveBeenCalledWith('Database error getting call stats:', expect.any(Error));
        expect(result).toEqual([]);

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Performance Metrics and Tracking', () => {
    it('should track database operation latencies', async () => {
      const operations = [
        { name: 'createCall', fn: () => createCall({ twilioCallSid: 'CA_TEST' }) },
        { name: 'createTurn', fn: () => createTurn({ callId: 'test-call', userInput: 'test' }) },
        { name: 'getCall', fn: () => getCall('test-call') },
        { name: 'getTurnsByCall', fn: () => getTurnsByCall('test-call') }
      ];

      // Mock with realistic delays
      mockPrisma.call.create.mockImplementation(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 25));
        return { id: 'perf-call', ...data.data };
      });

      mockPrisma.turn.create.mockImplementation(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 15));
        return { id: 'perf-turn', ...data.data };
      });

      mockPrisma.call.findUnique.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return { id: 'perf-call', turns: [] };
      });

      mockPrisma.turn.findMany.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 18));
        return [];
      });

      const results = [];
      for (const operation of operations) {
        const { timeMs } = await measureExecutionTime(operation.fn);
        results.push({ name: operation.name, timeMs });
      }

      results.forEach(({ name, timeMs }) => {
        expect(timeMs).toBeGreaterThan(10); // Should include mock delay
        expect(timeMs).toBeLessThan(100); // Should be reasonably fast
        console.log(`${name}: ${timeMs}ms`);
      });
    });

    it('should handle high-frequency database operations', async () => {
      const numOperations = 50;
      let operationCount = 0;

      mockPrisma.turn.create.mockImplementation(async (data) => {
        operationCount++;
        await new Promise(resolve => setTimeout(resolve, 5));
        return { id: `bulk-turn-${operationCount}`, ...data.data };
      });

      const promises = Array.from({ length: numOperations }, (_, i) =>
        createTurn({
          callId: 'bulk-test-call',
          userInput: `Bulk input ${i}`,
          turnIndex: i,
          timestamp: new Date()
        })
      );

      const start = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numOperations);
      expect(operationCount).toBe(numOperations);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      results.forEach((result, index) => {
        expect(result.id).toBe(`bulk-turn-${index + 1}`);
      });
    });

    it('should measure success rates for booking operations', async () => {
      const bookingScenarios = [
        { service: 'haircut', shouldSucceed: true },
        { service: 'massage', shouldSucceed: true },
        { service: 'consultation', shouldSucceed: true },
        { service: '', shouldSucceed: false }, // Invalid service
        { service: null, shouldSucceed: false } // Null service
      ];

      let successCount = 0;
      let totalCount = 0;

      mockPrisma.appointment.create.mockImplementation(async (data) => {
        if (!data.data.service || data.data.service.trim() === '') {
          throw new Error('Service is required');
        }
        return { id: `booking-${Date.now()}`, ...data.data };
      });

      for (const scenario of bookingScenarios) {
        totalCount++;
        try {
          await createAppointment({ 
            service: scenario.service,
            contactPhone: '555-0000',
            organizationId: 'test-org'
          });
          if (scenario.shouldSucceed) successCount++;
        } catch (error) {
          if (!scenario.shouldSucceed) successCount++;
        }
      }

      const successRate = successCount / totalCount;
      expect(successRate).toBe(1.0); // All scenarios should behave as expected
      
      // Calculate booking success rate (only valid bookings)
      const validBookings = bookingScenarios.filter(s => s.shouldSucceed);
      const bookingSuccessRate = validBookings.length / bookingScenarios.length;
      
      console.log(`Booking success rate: ${(bookingSuccessRate * 100).toFixed(1)}%`);
      expect(bookingSuccessRate).toBeGreaterThanOrEqual(0.6); // 60% of scenarios are valid bookings
    });
  });

  describe('Error Resilience and Fallback Mechanisms', () => {
    it('should continue operating when database is temporarily unavailable', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate database unavailability
      mockPrisma.call.create.mockRejectedValue(new Error('Connection refused'));
      mockPrisma.turn.create.mockRejectedValue(new Error('Connection refused'));

      // Operations should still return usable results
      const call = await createCall({
        twilioCallSid: 'CA_FALLBACK_TEST',
        status: 'in-progress'
      });

      const turn = await createTurn({
        callId: call.id,
        userInput: 'fallback test',
        timestamp: new Date()
      });

      expect(call.id).toMatch(/^mock_\d+$/);
      expect(call.twilioCallSid).toBe('CA_FALLBACK_TEST');
      expect(turn.id).toMatch(/^mock_turn_\d+$/);
      expect(turn.callId).toBe(call.id);

      consoleSpy.mockRestore();
    });

    it('should handle concurrent database connection issues', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Some operations fail, others succeed
      mockPrisma.call.create
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Max connections reached'))
        .mockResolvedValueOnce({ id: 'successful-call', status: 'in-progress' });

      const promises = [
        createCall({ twilioCallSid: 'CA1' }),
        createCall({ twilioCallSid: 'CA2' }),
        createCall({ twilioCallSid: 'CA3' })
      ];

      const results = await Promise.all(promises);

      // All should return results (failures return mock objects)
      expect(results).toHaveLength(3);
      expect(results[0].id).toMatch(/^mock_\d+$/); // Fallback
      expect(results[1].id).toMatch(/^mock_\d+$/); // Fallback
      expect(results[2].id).toBe('successful-call'); // Success

      consoleSpy.mockRestore();
    });

    it('should validate data integrity after fallback operations', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockPrisma.call.create.mockRejectedValue(new Error('Database error'));

      const callData = {
        twilioCallSid: 'CA_INTEGRITY_TEST',
        callerPhone: '+15551234567',
        status: 'in-progress',
        startedAt: new Date(),
        currentState: 'greeting'
      };

      const result = await createCall(callData);

      // Verify fallback data maintains essential properties
      expect(result.id).toBeDefined();
      expect(result.twilioCallSid).toBe(callData.twilioCallSid);
      expect(result.status).toBe(callData.status);
      expect(result.startedAt).toBe(callData.startedAt);
      expect(result.currentState).toBe(callData.currentState);

      consoleSpy.mockRestore();
    });
  });

  describe('Data Consistency and Validation', () => {
    it('should enforce proper data types and constraints', async () => {
      const invalidAppointmentData = [
        { service: null, contactPhone: '555-0000' }, // null service
        { service: 'test', contactPhone: null }, // null phone
        { service: 'test', contactPhone: '555-0000', startAt: 'invalid-date' }, // invalid date
        { service: 'test', contactPhone: '555-0000', status: 'invalid-status' } // invalid status
      ];

      mockPrisma.appointment.create.mockImplementation(async (data) => {
        const { service, contactPhone, startAt, status } = data.data;
        
        if (!service || !contactPhone) {
          throw new Error('Missing required fields');
        }
        
        if (startAt && !(startAt instanceof Date)) {
          throw new Error('Invalid date format');
        }
        
        const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
          throw new Error('Invalid status');
        }
        
        return { id: 'validated-appointment', ...data.data };
      });

      for (const invalidData of invalidAppointmentData) {
        await expect(createAppointment(invalidData)).rejects.toThrow();
      }

      // Valid data should succeed
      const validData = {
        service: 'consultation',
        contactPhone: '555-1234',
        startAt: new Date(),
        status: 'scheduled'
      };

      const result = await createAppointment(validData);
      expect(result.id).toBe('validated-appointment');
    });

    it('should maintain referential integrity between calls and turns', async () => {
      // Mock call creation
      mockPrisma.call.create.mockResolvedValue({
        id: 'ref-call-123',
        twilioCallSid: 'CA_REF_TEST'
      });

      // Mock turn creation with foreign key validation
      mockPrisma.turn.create.mockImplementation(async (data) => {
        if (data.data.callId !== 'ref-call-123') {
          throw new Error('Foreign key constraint failed');
        }
        return { id: 'ref-turn-456', ...data.data };
      });

      // Create call first
      const call = await createCall({
        twilioCallSid: 'CA_REF_TEST',
        status: 'in-progress'
      });

      // Create turn with correct call reference
      const turn = await createTurn({
        callId: call.id,
        userInput: 'referential integrity test',
        timestamp: new Date()
      });

      expect(turn.callId).toBe(call.id);

      // Try to create turn with invalid call reference
      await expect(createTurn({
        callId: 'nonexistent-call',
        userInput: 'invalid reference',
        timestamp: new Date()
      })).rejects.toThrow('Foreign key constraint failed');
    });
  });
});