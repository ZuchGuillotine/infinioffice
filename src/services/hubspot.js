const axios = require('axios');

class HubSpotService {
  constructor() {
    this.clientId = process.env.HUBSPOT_CLIENT_ID;
    this.clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    this.redirectUri = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3001/api/auth/hubspot/callback';
    this.scopes = [
      'contacts',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.owners.read'
    ];
  }

  // Generate OAuth2 authorization URL
  getAuthUrl(state = '') {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: state
    });

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code) {
    try {
      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting HubSpot tokens from code:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error refreshing HubSpot token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  // Create API client with access token
  createApiClient(accessToken) {
    return axios.create({
      baseURL: 'https://api.hubapi.com',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get user account information
  async getAccountInfo(accessToken) {
    try {
      const client = this.createApiClient(accessToken);
      const response = await client.get('/oauth/v1/access-tokens/' + accessToken);
      return response.data;
    } catch (error) {
      console.error('Error getting HubSpot account info:', error);
      throw new Error('Failed to fetch account information');
    }
  }

  // Create or update contact
  async upsertContact(accessToken, contactData) {
    try {
      const client = this.createApiClient(accessToken);
      
      // Check if contact exists by email
      const searchResponse = await client.post('/crm/v3/objects/contacts/search', {
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: contactData.email
          }]
        }],
        properties: ['email', 'firstname', 'lastname', 'phone']
      });

      let contactId = null;
      if (searchResponse.data.results.length > 0) {
        contactId = searchResponse.data.results[0].id;
      }

      const contactProperties = {
        email: contactData.email,
        firstname: contactData.firstName || '',
        lastname: contactData.lastName || '',
        phone: contactData.phone || '',
        company: contactData.company || '',
        jobtitle: contactData.jobTitle || ''
      };

      if (contactId) {
        // Update existing contact
        const response = await client.patch(`/crm/v3/objects/contacts/${contactId}`, {
          properties: contactProperties
        });
        return {
          id: response.data.id,
          action: 'updated',
          properties: response.data.properties
        };
      } else {
        // Create new contact
        const response = await client.post('/crm/v3/objects/contacts', {
          properties: contactProperties
        });
        return {
          id: response.data.id,
          action: 'created',
          properties: response.data.properties
        };
      }
    } catch (error) {
      console.error('Error upserting HubSpot contact:', error);
      throw new Error('Failed to create or update contact');
    }
  }

  // Get contact by ID
  async getContact(accessToken, contactId) {
    try {
      const client = this.createApiClient(accessToken);
      const response = await client.get(`/crm/v3/objects/contacts/${contactId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting HubSpot contact:', error);
      throw new Error('Failed to fetch contact');
    }
  }

  // Search contacts
  async searchContacts(accessToken, query, limit = 10) {
    try {
      const client = this.createApiClient(accessToken);
      const response = await client.post('/crm/v3/objects/contacts/search', {
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'CONTAINS_TOKEN',
            value: query
          }]
        }],
        properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
        limit: limit
      });
      return response.data.results;
    } catch (error) {
      console.error('Error searching HubSpot contacts:', error);
      throw new Error('Failed to search contacts');
    }
  }

  // Create deal
  async createDeal(accessToken, dealData) {
    try {
      const client = this.createApiClient(accessToken);
      
      const dealProperties = {
        dealname: dealData.name || 'New Deal',
        amount: dealData.amount || '',
        dealstage: dealData.stage || 'appointmentscheduled',
        closedate: dealData.closeDate || new Date().toISOString(),
        pipeline: dealData.pipeline || 'default'
      };

      const response = await client.post('/crm/v3/objects/deals', {
        properties: dealProperties
      });

      // Associate with contact if provided
      if (dealData.contactId) {
        await client.put(`/crm/v3/objects/deals/${response.data.id}/associations/contacts/${dealData.contactId}/deal_to_contact`);
      }

      return {
        id: response.data.id,
        properties: response.data.properties
      };
    } catch (error) {
      console.error('Error creating HubSpot deal:', error);
      throw new Error('Failed to create deal');
    }
  }

  // Update deal
  async updateDeal(accessToken, dealId, dealData) {
    try {
      const client = this.createApiClient(accessToken);
      
      const dealProperties = {
        dealname: dealData.name,
        amount: dealData.amount,
        dealstage: dealData.stage,
        closedate: dealData.closeDate
      };

      const response = await client.patch(`/crm/v3/objects/deals/${dealId}`, {
        properties: dealProperties
      });

      return {
        id: response.data.id,
        properties: response.data.properties
      };
    } catch (error) {
      console.error('Error updating HubSpot deal:', error);
      throw new Error('Failed to update deal');
    }
  }

  // Get deal by ID
  async getDeal(accessToken, dealId) {
    try {
      const client = this.createApiClient(accessToken);
      const response = await client.get(`/crm/v3/objects/deals/${dealId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting HubSpot deal:', error);
      throw new Error('Failed to fetch deal');
    }
  }

  // Create company
  async createCompany(accessToken, companyData) {
    try {
      const client = this.createApiClient(accessToken);
      
      const companyProperties = {
        name: companyData.name,
        domain: companyData.domain || '',
        industry: companyData.industry || '',
        phone: companyData.phone || '',
        city: companyData.city || '',
        state: companyData.state || '',
        country: companyData.country || ''
      };

      const response = await client.post('/crm/v3/objects/companies', {
        properties: companyProperties
      });

      return {
        id: response.data.id,
        properties: response.data.properties
      };
    } catch (error) {
      console.error('Error creating HubSpot company:', error);
      throw new Error('Failed to create company');
    }
  }

  // Get company by ID
  async getCompany(accessToken, companyId) {
    try {
      const client = this.createApiClient(accessToken);
      const response = await client.get(`/crm/v3/objects/companies/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting HubSpot company:', error);
      throw new Error('Failed to fetch company');
    }
  }

  // Create engagement (note, email, call, etc.)
  async createEngagement(accessToken, engagementData) {
    try {
      const client = this.createApiClient(accessToken);
      
      const engagement = {
        engagement: {
          active: true,
          ownerId: engagementData.ownerId || 1,
          type: engagementData.type || 'NOTE',
          timestamp: engagementData.timestamp || Date.now()
        },
        associations: {
          contactIds: engagementData.contactIds || [],
          companyIds: engagementData.companyIds || [],
          dealIds: engagementData.dealIds || []
        },
        metadata: {
          body: engagementData.body || '',
          subject: engagementData.subject || ''
        }
      };

      const response = await client.post('/engagements/v1/engagements', engagement);
      return response.data;
    } catch (error) {
      console.error('Error creating HubSpot engagement:', error);
      throw new Error('Failed to create engagement');
    }
  }

  // Validate access token
  async validateToken(accessToken) {
    try {
      const client = this.createApiClient(accessToken);
      await client.get('/oauth/v1/access-tokens/' + accessToken);
      return true;
    } catch (error) {
      console.error('HubSpot token validation failed:', error);
      return false;
    }
  }
}

module.exports = new HubSpotService();
