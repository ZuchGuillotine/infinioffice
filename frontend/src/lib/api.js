// API client for InfiniOffice frontend
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3001'  // Backend dev server
  : window.location.origin;   // Same origin in production

class APIClient {
  constructor() {
    this.baseURL = API_BASE;
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}/api${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired or invalid
        this.setToken(null);
        window.location.href = '/auth/login';
        return null;
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // HTTP methods
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth endpoints
  auth = {
    register: (data) => this.post('/auth/register', data),
    login: (data) => this.post('/auth/login', data),
    googleLogin: (data) => this.post('/auth/google', data),
    verify: () => this.get('/auth/verify'),
  };

  // User endpoints
  user = {
    getProfile: () => this.get('/user/profile'),
    updateProfile: (data) => this.put('/user/profile', data),
    getPreferences: () => this.get('/user/preferences'),
    updatePreferences: (data) => this.put('/user/preferences', data),
    getActivity: () => this.get('/user/activity'),
  };

  // Organization endpoints
  organizations = {
    get: () => this.get('/organizations'),
    update: (data) => this.put('/organizations', data),
    getConfig: () => this.get('/organizations/config'),
    updateConfig: (data) => this.put('/organizations/config', data),
    getVoiceConfig: () => this.get('/organizations/voice-config'),
    updateVoiceConfig: (data) => this.put('/organizations/voice-config', data),
    getSchedule: () => this.get('/organizations/schedule'),
    updateSchedule: (data) => this.put('/organizations/schedule', data),
    getIntegrations: () => this.get('/organizations/integrations'),
    createIntegration: (data) => this.post('/organizations/integrations', data),
    deleteIntegration: (type) => this.delete(`/organizations/integrations/${type}`),
    updateOnboardingProgress: (data) => this.put('/organizations/onboarding-progress', data),
    getSetupStatus: () => this.get('/organizations/setup-status'),
  };

  // Dashboard endpoints
  dashboard = {
    getMetrics: () => this.get('/dashboard/metrics'),
    getRecentCalls: () => this.get('/dashboard/recent-calls'),
    getTodayBookings: () => this.get('/dashboard/today-bookings'),
    getAnalytics: (params) => this.get('/dashboard/analytics', params),
  };

  // Calls endpoints
  calls = {
    list: (params) => this.get('/calls', params),
    get: (id) => this.get(`/calls/${id}`),
    getAnalytics: (params) => this.get('/calls/analytics/summary', params),
    getPerformance: (params) => this.get('/calls/analytics/performance', params),
  };

  // Services endpoints
  services = {
    list: () => this.get('/services'),
    create: (data) => this.post('/services', data),
    update: (id, data) => this.put(`/services/${id}`, data),
    delete: (id) => this.delete(`/services/${id}`),
    getCategories: () => this.get('/services/categories'),
    bulkUpdate: (data) => this.put('/services/bulk', data),
  };

  // Onboarding endpoints
  onboarding = {
    createOrganization: (data) => this.post('/onboarding/create-organization', data),
    getBusinessTypes: () => this.get('/onboarding/business-types'),
    getTimezones: () => this.get('/onboarding/timezones'),
    updateProgress: (data) => this.put('/onboarding/progress', data),
    getSetupStatus: () => this.get('/onboarding/setup-status'),
  };

  // Voice endpoints
  voice = {
    preview: (data) => this.post('/voice/preview', data),
    testGreeting: (data) => this.post('/voice/test-greeting', data),
    getModels: () => this.get('/voice/models'),
    demoCall: (data) => this.post('/voice/demo-call', data),
    getAnalytics: () => this.get('/voice/analytics'),
    getHealth: () => this.get('/voice/health'),
  };
}

// Create singleton instance
const apiClient = new APIClient();

export default apiClient;

// Named exports for convenience
export const { auth, user, organizations, dashboard, calls, services, onboarding, voice } = apiClient;