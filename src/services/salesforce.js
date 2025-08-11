const axios = require('axios');

class SalesforceService {
  constructor() {
    this.clientId = process.env.SALESFORCE_CLIENT_ID;
    this.clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    this.redirectUri = process.env.SALESFORCE_REDIRECT_URI || 'http://localhost:3001/api/auth/salesforce/callback';
    this.scopes = [
      'api',
      'refresh_token',
      'offline_access'
    ];
  }

  // Generate OAuth2 authorization URL
  getAuthUrl(state = '') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: state
    });

    return `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code) {
    try {
      const response = await axios.post('https://login.salesforce.com/services/oauth2/token', {
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
      console.error('Error getting Salesforce tokens from code:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  // Refresh access token
  async refreshToken(refreshToken, instanceUrl) {
    try {
      const response = await axios.post(`${instanceUrl}/services/oauth2/token`, {
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
      console.error('Error refreshing Salesforce token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  // Create API client with access token and instance URL
  createApiClient(accessToken, instanceUrl) {
    return axios.create({
      baseURL: `${instanceUrl}/services/data/v58.0`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get user account information
  async getAccountInfo(accessToken, instanceUrl) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      const response = await client.get('/sobjects/User/me');
      return response.data;
    } catch (error) {
      console.error('Error getting Salesforce account info:', error);
      throw new Error('Failed to fetch account information');
    }
  }

  // Create or update contact
  async upsertContact(accessToken, instanceUrl, contactData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      // Check if contact exists by email
      const searchResponse = await client.get(`/sobjects/Contact/email/${encodeURIComponent(contactData.email)}`);
      
      let contactId = null;
      if (searchResponse.data && searchResponse.data.Id) {
        contactId = searchResponse.data.Id;
      }

      const contactFields = {
        Email: contactData.email,
        FirstName: contactData.firstName || '',
        LastName: contactData.lastName || '',
        Phone: contactData.phone || '',
        Company__c: contactData.company || '',
        Title: contactData.jobTitle || ''
      };

      if (contactId) {
        // Update existing contact
        const response = await client.patch(`/sobjects/Contact/${contactId}`, contactFields);
        return {
          id: contactId,
          action: 'updated',
          success: response.data.success
        };
      } else {
        // Create new contact
        const response = await client.post('/sobjects/Contact', contactFields);
        return {
          id: response.data.id,
          action: 'created',
          success: response.data.success
        };
      }
    } catch (error) {
      console.error('Error upserting Salesforce contact:', error);
      throw new Error('Failed to create or update contact');
    }
  }

  // Get contact by ID
  async getContact(accessToken, instanceUrl, contactId) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      const response = await client.get(`/sobjects/Contact/${contactId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting Salesforce contact:', error);
      throw new Error('Failed to fetch contact');
    }
  }

  // Search contacts
  async searchContacts(accessToken, instanceUrl, query, limit = 10) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      const soql = `SELECT Id, FirstName, LastName, Email, Phone, Company__c, Title FROM Contact WHERE Email LIKE '%${query}%' OR FirstName LIKE '%${query}%' OR LastName LIKE '%${query}%' LIMIT ${limit}`;
      
      const response = await client.get(`/query?q=${encodeURIComponent(soql)}`);
      return response.data.records;
    } catch (error) {
      console.error('Error searching Salesforce contacts:', error);
      throw new Error('Failed to search contacts');
    }
  }

  // Create lead
  async createLead(accessToken, instanceUrl, leadData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      const leadFields = {
        FirstName: leadData.firstName || '',
        LastName: leadData.lastName || '',
        Email: leadData.email || '',
        Phone: leadData.phone || '',
        Company: leadData.company || '',
        Title: leadData.jobTitle || '',
        LeadSource: leadData.source || 'Phone Call',
        Status: leadData.status || 'New',
        Description: leadData.description || ''
      };

      const response = await client.post('/sobjects/Lead', leadFields);
      return {
        id: response.data.id,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error creating Salesforce lead:', error);
      throw new Error('Failed to create lead');
    }
  }

  // Update lead
  async updateLead(accessToken, instanceUrl, leadId, leadData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      const leadFields = {
        FirstName: leadData.firstName,
        LastName: leadData.lastName,
        Email: leadData.email,
        Phone: leadData.phone,
        Company: leadData.company,
        Title: leadData.jobTitle,
        Status: leadData.status,
        Description: leadData.description
      };

      const response = await client.patch(`/sobjects/Lead/${leadId}`, leadFields);
      return {
        id: leadId,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error updating Salesforce lead:', error);
      throw new Error('Failed to update lead');
    }
  }

  // Convert lead to contact/opportunity
  async convertLead(accessToken, instanceUrl, leadId, conversionData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      const conversionFields = {
        leadId: leadId,
        convertedStatus: conversionData.status || 'Qualified',
        doNotCreateOpportunity: conversionData.createOpportunity !== true,
        opportunityName: conversionData.opportunityName || '',
        opportunityAmount: conversionData.amount || '',
        closeDate: conversionData.closeDate || new Date().toISOString().split('T')[0]
      };

      const response = await client.post('/sobjects/Lead/convert', conversionFields);
      return response.data;
    } catch (error) {
      console.error('Error converting Salesforce lead:', error);
      throw new Error('Failed to convert lead');
    }
  }

  // Create opportunity
  async createOpportunity(accessToken, instanceUrl, opportunityData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      const opportunityFields = {
        Name: opportunityData.name || 'New Opportunity',
        Amount: opportunityData.amount || '',
        StageName: opportunityData.stage || 'Prospecting',
        CloseDate: opportunityData.closeDate || new Date().toISOString().split('T')[0],
        Description: opportunityData.description || '',
        Type: opportunityData.type || 'New Customer',
        LeadSource: opportunityData.source || 'Phone Call'
      };

      const response = await client.post('/sobjects/Opportunity', opportunityFields);
      return {
        id: response.data.id,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error creating Salesforce opportunity:', error);
      throw new Error('Failed to create opportunity');
    }
  }

  // Update opportunity
  async updateOpportunity(accessToken, instanceUrl, opportunityId, opportunityData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      const opportunityFields = {
        Name: opportunityData.name,
        Amount: opportunityData.amount,
        StageName: opportunityData.stage,
        CloseDate: opportunityData.closeDate,
        Description: opportunityData.description
      };

      const response = await client.patch(`/sobjects/Opportunity/${opportunityId}`, opportunityFields);
      return {
        id: opportunityId,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error updating Salesforce opportunity:', error);
      throw new Error('Failed to update opportunity');
    }
  }

  // Get opportunity by ID
  async getOpportunity(accessToken, instanceUrl, opportunityId) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      const response = await client.get(`/sobjects/Opportunity/${opportunityId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting Salesforce opportunity:', error);
      throw new Error('Failed to fetch opportunity');
    }
  }

  // Create account
  async createAccount(accessToken, instanceUrl, accountData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      const accountFields = {
        Name: accountData.name,
        Phone: accountData.phone || '',
        Industry: accountData.industry || '',
        BillingCity: accountData.city || '',
        BillingState: accountData.state || '',
        BillingCountry: accountData.country || '',
        Description: accountData.description || ''
      };

      const response = await client.post('/sobjects/Account', accountFields);
      return {
        id: response.data.id,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error creating Salesforce account:', error);
      throw new Error('Failed to create account');
    }
  }

  // Get account by ID
  async getAccount(accessToken, instanceUrl, accountId) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      const response = await client.get(`/sobjects/Account/${accountId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting Salesforce account:', error);
      throw new Error('Failed to fetch account');
    }
  }

  // Create task (call log, follow-up, etc.)
  async createTask(accessToken, instanceUrl, taskData) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      
      const taskFields = {
        Subject: taskData.subject || 'Call Follow-up',
        Description: taskData.description || '',
        ActivityDate: taskData.dueDate || new Date().toISOString().split('T')[0],
        Status: taskData.status || 'Not Started',
        Priority: taskData.priority || 'Normal',
        Type: taskData.type || 'Call',
        WhoId: taskData.contactId || '',
        WhatId: taskData.opportunityId || taskData.accountId || ''
      };

      const response = await client.post('/sobjects/Task', taskFields);
      return {
        id: response.data.id,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error creating Salesforce task:', error);
      throw new Error('Failed to create task');
    }
  }

  // Validate access token
  async validateToken(accessToken, instanceUrl) {
    try {
      const client = this.createApiClient(accessToken, instanceUrl);
      await client.get('/sobjects/User/me');
      return true;
    } catch (error) {
      console.error('Salesforce token validation failed:', error);
      return false;
    }
  }
}

module.exports = new SalesforceService();
