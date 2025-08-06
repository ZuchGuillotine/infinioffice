
const { createEvent } = require('../src/services/calendar');
const { google } = require('googleapis');

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
    calendar: jest.fn(() => ({
      events: {
        insert: jest.fn().mockResolvedValue({ data: { id: 'test-event-id' } }),
      },
    })),
  },
}));

describe('Calendar Service', () => {
  it('should create a calendar event', async () => {
    const event = await createEvent({ summary: 'Test Event' });
    expect(event).toBeDefined();
    expect(event.id).toBe('test-event-id');
  });
});
