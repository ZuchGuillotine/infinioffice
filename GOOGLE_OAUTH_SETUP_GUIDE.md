# 🔐 Google OAuth Setup Guide: Separate Clients for Auth & Calendar

## **Overview**

This guide explains how to set up **two separate Google OAuth clients**:
1. **User Authentication Client** - for login/registration
2. **Calendar Integration Client** - for calendar access

## **Why Separate Clients?**

### **Benefits:**
- ✅ **Clearer consent screens** for users
- ✅ **Different permission scopes** for each use case
- ✅ **Better security** and audit trails
- ✅ **Easier compliance** with OAuth 2.0 standards
- ✅ **Independent management** of each integration

### **Use Cases:**
- **Auth Client**: "Sign in with Google" button
- **Calendar Client**: "Connect Google Calendar" button

## **Google Cloud Console Setup**

### **Step 1: Create User Authentication Client**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click **+ CREATE CREDENTIALS** → **OAuth 2.0 Client IDs**
4. Choose **Web application**
5. **Name**: `InfiniOffice User Authentication`
6. **Authorized redirect URIs**:
   ```
   http://localhost:3001/api/auth/google/callback
   http://127.0.0.1:3001/api/auth/google/callback
   https://yourdomain.com/api/auth/google/callback
   https://www.yourdomain.com/api/auth/google/callback
   ```
7. **Scopes**: `openid`, `email`, `profile`
8. **Save** and note the Client ID and Client Secret

### **Step 2: Create Calendar Integration Client**

1. Click **+ CREATE CREDENTIALS** → **OAuth 2.0 Client IDs**
2. Choose **Web application**
3. **Name**: `InfiniOffice Calendar Integration`
4. **Authorized redirect URIs**:
   ```
   http://localhost:3001/api/auth/google-calendar/callback
   http://127.0.0.1:3001/api/auth/google-calendar/callback
   https://yourdomain.com/api/auth/google-calendar/callback
   https://www.yourdomain.com/api/auth/google-calendar/callback
   ```
5. **Scopes**: `https://www.googleapis.com/auth/calendar`, `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/userinfo.email`
6. **Save** and note the Client ID and Client Secret

## **Environment Variables Configuration**

### **Development (.env)**
```bash
# Google OAuth - User Authentication (Login/Register)
GOOGLE_AUTH_CLIENT_ID=your_auth_client_id_here
GOOGLE_AUTH_CLIENT_SECRET=your_auth_client_secret_here
GOOGLE_AUTH_REDIRECT_URL=http://localhost:3001/api/auth/google/callback

# Google OAuth - Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your_calendar_client_id_here
GOOGLE_CALENDAR_CLIENT_SECRET=your_calendar_client_secret_here
GOOGLE_CALENDAR_REDIRECT_URL=http://localhost:3001/api/auth/google-calendar/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Server Configuration
NODE_ENV=development
PORT=3001
```

### **Production (Environment Variables)**
```bash
# Google OAuth - User Authentication
GOOGLE_AUTH_CLIENT_ID=your_production_auth_client_id
GOOGLE_AUTH_CLIENT_SECRET=your_production_auth_client_secret
GOOGLE_AUTH_REDIRECT_URL_PROD=https://yourdomain.com/api/auth/google/callback

# Google OAuth - Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your_production_calendar_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_production_calendar_client_secret
GOOGLE_CALENDAR_REDIRECT_URL_PROD=https://yourdomain.com/api/auth/google-calendar/callback

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Server Configuration
NODE_ENV=production
```

## **Code Implementation**

### **1. Update GoogleCalendarService**

```javascript
// src/services/googleCalendar.js
class GoogleCalendarService {
  constructor() {
    // Use calendar-specific client credentials
    this.clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    this.redirectUri = this.getRedirectUri();
    
    this.scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
  }
  
  getRedirectUri() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      return process.env.GOOGLE_CALENDAR_REDIRECT_URL_PROD || 
             `${process.env.FRONTEND_URL}/api/auth/google-calendar/callback`;
    }
    
    return process.env.GOOGLE_CALENDAR_REDIRECT_URL || 
           'http://localhost:3001/api/auth/google-calendar/callback';
  }
}
```

### **2. Create GoogleAuthService**

```javascript
// src/services/googleAuth.js
const { OAuth2Client } = require('google-auth-library');

class GoogleAuthService {
  constructor() {
    // Use auth-specific client credentials
    this.clientId = process.env.GOOGLE_AUTH_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET;
    this.redirectUri = this.getRedirectUri();
    
    this.scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
  }
  
  getRedirectUri() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      return process.env.GOOGLE_AUTH_REDIRECT_URL_PROD || 
             `${process.env.FRONTEND_URL}/api/auth/google/callback`;
    }
    
    return process.env.GOOGLE_AUTH_REDIRECT_URL || 
           'http://localhost:3001/api/auth/google/callback';
  }
  
  getAuthUrl(state) {
    const oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
    
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      state: state
    });
  }
  
  async getTokensFromCode(code) {
    const oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }
  
  async verifyToken(idToken) {
    const client = new OAuth2Client(this.clientId);
    
    try {
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: this.clientId
    });
      
      return ticket.getPayload();
    } catch (error) {
      throw new Error('Invalid ID token');
    }
  }
}

module.exports = GoogleAuthService;
```

### **3. Update Auth Routes**

```javascript
// src/routes/auth.js
const GoogleAuthService = require('../services/googleAuth');
const GoogleCalendarService = require('../services/googleCalendar');

// User authentication routes
fastify.get('/google', async (request, reply) => {
  const { state } = request.query;
  const authUrl = GoogleAuthService.getAuthUrl(state);
  reply.redirect(authUrl);
});

fastify.get('/google/callback', async (request, reply) => {
  const { code, state } = request.query;
  
  try {
    const tokens = await GoogleAuthService.getTokensFromCode(code);
    const userInfo = await GoogleAuthService.verifyToken(tokens.id_token);
    
    // Handle user login/registration
    // Store user session, create account, etc.
    
    reply.redirect(`${process.env.FRONTEND_URL}/app/dashboard?success=login`);
  } catch (error) {
    reply.redirect(`${process.env.FRONTEND_URL}/auth/login?error=google`);
  }
});

// Calendar integration routes (existing)
fastify.get('/google-calendar', async (request, reply) => {
  // ... existing calendar OAuth code
});
```

### **4. Update Frontend**

```javascript
// frontend/src/pages/auth/LoginPage.jsx
function handleGoogleLogin() {
  // Use auth-specific OAuth endpoint
  window.location.href = '/api/auth/google';
}

// frontend/src/pages/Dashboard/IntegrationsPage.jsx
function handleConnect(integrationType) {
  if (integrationType === 'google-calendar') {
    // Use calendar-specific OAuth endpoint
    window.location.href = `/api/auth/google-calendar?organizationId=${user.organizationId}`;
  }
  // ... other integrations
}
```

## **OAuth Consent Screen Configuration**

### **User Authentication App**
- **App name**: `InfiniOffice User Login`
- **User support email**: Your support email
- **App logo**: Your app logo
- **Scopes**: `openid`, `email`, `profile`
- **Test users**: Add your test users

### **Calendar Integration App**
- **App name**: `InfiniOffice Calendar Sync`
- **User support email**: Your support email
- **App logo**: Your app logo
- **Scopes**: `calendar`, `calendar.events`, `userinfo.email`
- **Test users**: Add your test users

## **Testing the Setup**

### **1. Test User Authentication**
```bash
# Visit: http://localhost:5173/auth/login
# Click "Sign in with Google"
# Should redirect to Google OAuth consent screen
# Should show minimal permissions (email, profile)
```

### **2. Test Calendar Integration**
```bash
# Visit: http://localhost:5173/app/integrations
# Click "Connect" on Google Calendar
# Should redirect to Google OAuth consent screen
# Should show calendar permissions
```

## **Migration from Single Client**

### **If you currently have one client:**
1. **Keep the existing client** temporarily
2. **Create the new separate clients** as described above
3. **Update your code** to use the new clients
4. **Test thoroughly** with the new setup
5. **Remove the old client** once everything works

### **Environment variable migration:**
```bash
# Old (single client)
GOOGLE_CLIENT_ID=old_client_id
GOOGLE_CLIENT_SECRET=old_client_secret
GOOGLE_REDIRECT_URL=old_redirect_url

# New (separate clients)
GOOGLE_AUTH_CLIENT_ID=new_auth_client_id
GOOGLE_AUTH_CLIENT_SECRET=new_auth_client_secret
GOOGLE_AUTH_REDIRECT_URL=new_auth_redirect_url
GOOGLE_CALENDAR_CLIENT_ID=new_calendar_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=new_calendar_client_secret
GOOGLE_CALENDAR_REDIRECT_URL=new_calendar_redirect_url
```

## **Benefits of This Approach**

1. **Clearer User Experience**: Users see exactly what permissions each integration needs
2. **Better Security**: Minimal permissions for login, specific permissions for calendar
3. **Easier Management**: Independent control over each OAuth flow
4. **Compliance**: Follows OAuth 2.0 best practices
5. **Scalability**: Easy to add more integrations with their own clients

## **Next Steps**

1. **Create the two separate OAuth clients** in Google Cloud Console
2. **Update your environment variables** with the new client credentials
3. **Implement the GoogleAuthService** for user authentication
4. **Update your existing GoogleCalendarService** to use calendar-specific credentials
5. **Test both flows** independently
6. **Update your frontend** to use the appropriate OAuth endpoints

This setup will give you a much cleaner, more secure, and more maintainable OAuth implementation!
