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
    
    // Set additional metadata to help Google identify our application
    oauth2Client.setCredentials({
      ...tokens,
      // Ensure all required token fields are present
      token_type: tokens.token_type || 'Bearer'
    });
    
    return oauth2Client;
  }

  createCalendarService(oauth2Client) {
    // Create calendar service with OAuth authentication only
    // DO NOT mix OAuth with API key - this causes 403 "unregistered callers" errors
    const calendar = google.calendar({ 
      version: 'v3', 
      auth: oauth2Client
    });
    
    return calendar;
  }

  // Get user's calendars
  async getCalendars(tokens) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = this.createCalendarService(oauth2Client);
      
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
      const calendar = this.createCalendarService(oauth2Client);
      
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
      const calendar = this.createCalendarService(oauth2Client);
      
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
      const calendar = this.createCalendarService(oauth2Client);
      
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
      const calendar = this.createCalendarService(oauth2Client);
      
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
      console.log('🔍 Debug getEvents:');
      console.log('  - Tokens received:', {
        access_token: tokens.access_token ? `${tokens.access_token.substring(0, 20)}...` : 'NOT SET',
        refresh_token: tokens.refresh_token ? 'Set' : 'NOT SET',
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        expiry_date: tokens.expiry_date
      });
      
      const oauth2Client = this.createOAuth2Client(tokens);
      console.log('  - OAuth2Client created successfully');
      
      // Check if token needs refresh
      if (tokens.expiry_date && new Date(tokens.expiry_date) <= new Date()) {
        console.log('  - Token expired, attempting refresh...');
        try {
          const refreshedTokens = await oauth2Client.refreshAccessToken();
          console.log('  - Token refresh successful');
          oauth2Client.setCredentials(refreshedTokens.credentials);
        } catch (refreshError) {
          console.error('  - Token refresh failed:', refreshError.message);
          throw new Error('Failed to refresh expired tokens');
        }
      }
      
      const calendar = this.createCalendarService(oauth2Client);
      console.log('  - Calendar service created, making API call...');
      console.log('  - Calendar service auth type:', typeof oauth2Client);
      
      const now = new Date();
      const endDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
      
      console.log('  - Requesting events from:', calendarId);
      console.log('  - Time range:', now.toISOString(), 'to', endDate.toISOString());
      
      const response = await calendar.events.list({
        calendarId: calendarId,
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500 // Google Calendar API limit
      });
      
      console.log('  - Calendar API call successful, events received:', response.data.items?.length || 0);

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
      console.error('❌ Error getting calendar events:', error);
      console.error('  - Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        response: error.response?.data
      });
      throw new Error('Failed to fetch calendar events');
    }
  }

  // Get busy times for availability checking
  async getBusyTimes(tokens, calendarId, startDate, endDate) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = this.createCalendarService(oauth2Client);
      
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
      console.log('🔍 Debug getAccountInfo:');
      console.log('  - Client ID:', this.clientId ? 'Set' : 'NOT SET');
      console.log('  - Client Secret:', this.clientSecret ? 'Set' : 'NOT SET');
      console.log('  - Redirect URI:', this.redirectUri);
      console.log('  - Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT SET');
      
      // Create OAuth2 client with proper credentials
      const oauth2Client = new OAuth2Client(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      oauth2Client.setCredentials({ access_token: accessToken });
      
      console.log('  - OAuth2Client created successfully');
      
      // Try to get user info from calendar API first (more reliable with calendar scopes)
      try {
        console.log('  - Trying Calendar API for user info...');
        const calendar = this.createCalendarService(oauth2Client);
        
        // Get the primary calendar to extract user info
        const calendarList = await calendar.calendarList.list({ maxResults: 1 });
        const primaryCalendar = calendarList.data.items[0];
        
        if (primaryCalendar) {
          console.log('  - Calendar API request successful');
          return {
            id: primaryCalendar.id, // Use calendar ID as user ID
            email: primaryCalendar.id, // Calendar ID is usually the user's email
            name: primaryCalendar.summary || 'Google Calendar User',
            picture: null
          };
        }
      } catch (calendarError) {
        console.log('  - Calendar API failed, trying OAuth2 API...');
      }
      
      // Fallback to OAuth2 API
      try {
        console.log('  - Trying OAuth2 API...');
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const response = await oauth2.userinfo.get();
        console.log('  - OAuth2 API request successful');
        
        return {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
          picture: response.data.picture
        };
      } catch (oauth2Error) {
        console.log('  - OAuth2 API also failed, using fallback...');
        
        // Final fallback: create a basic user object from the token
        // We can extract some info from the JWT token if needed
        return {
          id: 'google-calendar-user',
          email: 'calendar-user@google.com',
          name: 'Google Calendar User',
          picture: null
        };
      }
      
    } catch (error) {
      console.error('❌ Error getting account info:', error);
      console.error('  - Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        response: error.response?.data
      });
      throw new Error('Failed to get account information');
    }
  }

  // Validate tokens
  async validateTokens(tokens) {
    try {
      const oauth2Client = this.createOAuth2Client(tokens);
      const calendar = this.createCalendarService(oauth2Client);
      
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
