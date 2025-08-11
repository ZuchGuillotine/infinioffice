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
  
  async getUserInfo(accessToken) {
    const oauth2Client = new OAuth2Client(this.clientId);
    oauth2Client.setCredentials({ access_token: accessToken });
    
    try {
      const oauth2 = require('googleapis').oauth2;
      const oauth2Client = new oauth2({ auth: oauth2Client });
      
      const { data } = await oauth2Client.userinfo.get();
      return data;
    } catch (error) {
      throw new Error('Failed to get user info');
    }
  }
}

module.exports = GoogleAuthService;
