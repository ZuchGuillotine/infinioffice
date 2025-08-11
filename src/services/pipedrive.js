/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 10/08/2025 - 15:01:08
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 10/08/2025
    * - Author          : 
    * - Modification    : 
**/
const axios = require('axios');

class PipedriveService {
  constructor() {
    this.clientId = process.env.PIPEDRIVE_CLIENT_ID;
    this.clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;
    this.redirectUri = process.env.PIPEDRIVE_REDIRECT_URI || 'http://localhost:3001/api/auth/pipedrive/callback';
    this.scopes = [
      'contacts:read',
      'contacts:write',
      'deals:read',
      'deals:write',
      'persons:read',
      'persons:write',
      'organizations:read',
      'organizations:write'
    ];
  }

  getAuthUrl(state = '') {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: state
    });
    return `https://oauth.pipedrive.com/oauth/authorize?${params.toString()}`;
  }

  async getTokensFromCode(code) {
    try {
      const response = await axios.post('https://oauth.pipedrive.com/oauth/token', {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code
      }, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting Pipedrive tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  createApiClient(accessToken) {
    return axios.create({
      baseURL: 'https://api.pipedrive.com/v1',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async upsertPerson(accessToken, personData) {
    try {
      const client = this.createApiClient(accessToken);
      const personFields = {
        name: `${personData.firstName || ''} ${personData.lastName || ''}`.trim(),
        email: personData.email,
        phone: personData.phone || '',
        org_name: personData.company || ''
      };
      const response = await client.post('/persons', personFields);
      return { id: response.data.data.id, action: 'created' };
    } catch (error) {
      console.error('Error creating Pipedrive person:', error);
      throw new Error('Failed to create person');
    }
  }

  async createDeal(accessToken, dealData) {
    try {
      const client = this.createApiClient(accessToken);
      const dealFields = {
        title: dealData.name || 'New Deal',
        value: dealData.amount || '',
        person_id: dealData.personId || '',
        stage_id: dealData.stageId || 1
      };
      const response = await client.post('/deals', dealFields);
      return { id: response.data.data.id, data: response.data.data };
    } catch (error) {
      console.error('Error creating Pipedrive deal:', error);
      throw new Error('Failed to create deal');
    }
  }

  async validateToken(accessToken) {
    try {
      const client = this.createApiClient(accessToken);
      await client.get('/users/me');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAccountInfo(accessToken) {
    try {
      const client = this.createApiClient(accessToken);
      const response = await client.get('/users/me');
      return response.data.data;
    } catch (error) {
      console.error('Error getting Pipedrive account info:', error);
      throw new Error('Failed to get account information');
    }
  }
}

module.exports = new PipedriveService();
