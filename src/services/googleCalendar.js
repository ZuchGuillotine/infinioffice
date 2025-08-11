/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 10/08/2025 - 18:20:48
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 10/08/2025
    * - Author          : 
    * - Modification    : 
**/
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

class GoogleCalendarService {
  constructor() {
    // Use calendar-specific client credentials
    this.clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    
    // Choose redirect URI based on environment
    this.redirectUri = this.getRedirectUri();
    
    this.scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
  }

  getRedirectUri() {
    // Check if we're in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Use production redirect URI if specified, otherwise construct from domain
      if (process.env.GOOGLE_CALENDAR_REDIRECT_URL_PROD) {
        return process.env.GOOGLE_CALENDAR_REDIRECT_URL_PROD;
      }
      
      // Fallback: construct from FRONTEND_URL or other domain env vars
      if (process.env.FRONTEND_URL) {
        return `${process.env.FRONTEND_URL}/api/auth/google-calendar/callback`;
      }
      
      // Last resort: use the main redirect URL (should be production)
      return process.env.GOOGLE_CALENDAR_REDIRECT_URL || process.env.GOOGLE_REDIRECT_URL;
    }
    
    // Development: use localhost
    return process.env.GOOGLE_CALENDAR_REDIRECT_URL || process.env.GOOGLE_REDIRECT_URL || 'http://localhost:3001/api/auth/google-calendar/callback';
  }

  // Generate OAuth2 authorization URL
  getAuthUrl(state = '') {
    const oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      state: state,
      prompt: 'consent'
    });

    return authUrl;
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code) {
    const oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    try {
      const { tokens } = await oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens from code:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  // Create OAuth2 client with tokens
  createOAuth2Client(tokens) {
    const oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
    
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }

  // Get user's calendars
  async getCalendars(tokens) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const response = await calendar.calendarList.list();
      return response.data.items.map(cal => ({
        id: cal.id,
        name: cal.summary,
        primary: cal.primary || false,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor
      }));
    } catch (error) {
      console.error('Error getting calendars:', error);
      throw new Error('Failed to fetch calendars');
    }
  }

  // Create calendar event (appointment)
  async createEvent(tokens, calendarId, eventData) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const event = {
        summary: eventData.summary || 'Appointment',
        description: eventData.description || '',
        start: {
          dateTime: eventData.startTime,
          timeZone: eventData.timezone || 'UTC'
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: eventData.timezone || 'UTC'
        },
        attendees: eventData.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 } // 30 minutes before
          ]
        }
      };

      const response = await calendar.events.insert({
        calendarId: calendarId,
        resource: event,
        sendUpdates: 'all'
      });

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        start: response.data.start.dateTime,
        end: response.data.end.dateTime,
        status: response.data.status
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  // Update calendar event
  async updateEvent(tokens, calendarId, eventId, eventData) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const event = {
        summary: eventData.summary,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime,
          timeZone: eventData.timezone || 'UTC'
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: eventData.timezone || 'UTC'
        },
        attendees: eventData.attendees || []
      };

      const response = await calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        resource: event,
        sendUpdates: 'all'
      });

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        start: response.data.start.dateTime,
        end: response.data.end.dateTime,
        status: response.data.status
      };
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  // Delete calendar event
  async deleteEvent(tokens, calendarId, eventId) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      await calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
        sendUpdates: 'all'
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  // Get available time slots
  async getAvailableSlots(tokens, calendarId, startDate, endDate, duration = 60) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      // Get busy times
      const response = await calendar.freebusy.query({
        resource: {
          timeMin: startDate,
          timeMax: endDate,
          items: [{ id: calendarId }]
        }
      });

      const busyTimes = response.data.calendars[calendarId].busy || [];
      
      // Generate available slots (simplified - in production you'd want more sophisticated logic)
      const availableSlots = [];
      let currentTime = new Date(startDate);
      
      while (currentTime < new Date(endDate)) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);
        
        // Check if slot conflicts with busy times
        const hasConflict = busyTimes.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (currentTime < busyEnd && slotEnd > busyStart);
        });

        if (!hasConflict) {
          availableSlots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString(),
            duration: duration
          });
        }

        // Move to next slot
        currentTime = new Date(currentTime.getTime() + duration * 60000);
      }

      return availableSlots;
    } catch (error) {
      console.error('Error getting available slots:', error);
      throw new Error('Failed to get available time slots');
    }
  }

  // Get calendar events for the next 90 days
  async getEvents(tokens, calendarId, daysAhead = 90) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const now = new Date();
      const endDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
      
      const response = await calendar.events.list({
        calendarId: calendarId,
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500 // Google Calendar API limit
      });

      return response.data.items.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location,
        attendees: event.attendees || [],
        status: event.status,
        htmlLink: event.htmlLink,
        isAllDay: !event.start.dateTime
      }));
    } catch (error) {
      console.error('Error getting calendar events:', error);
      throw new Error('Failed to fetch calendar events');
    }
  }

  // Get busy times for availability checking
  async getBusyTimes(tokens, calendarId, startDate, endDate) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const response = await calendar.freebusy.query({
        resource: {
          timeMin: startDate,
          timeMax: endDate,
          items: [{ id: calendarId }]
        }
      });

      return response.data.calendars[calendarId].busy || [];
    } catch (error) {
      console.error('Error getting busy times:', error);
      throw new Error('Failed to fetch busy times');
    }
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      const oauth2Client = new OAuth2Client(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  // Get account info
  async getAccountInfo(accessToken) {
    try {
      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const response = await oauth2.userinfo.get();
      
      return {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        picture: response.data.picture
      };
    } catch (error) {
      console.error('Error getting account info:', error);
      throw new Error('Failed to get account information');
    }
  }

  // Validate tokens
  async validateTokens(tokens) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      // Try to access calendar list to validate tokens
      await calendar.calendarList.list({ maxResults: 1 });
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
}

module.exports = new GoogleCalendarService();
