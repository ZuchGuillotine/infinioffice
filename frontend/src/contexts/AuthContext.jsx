import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    console.log('AuthProvider: Initializing auth...');
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    console.log('AuthProvider: Starting auth initialization...');
    const token = localStorage.getItem('authToken');
    console.log('AuthProvider: Token found:', !!token);
    
    if (!token) {
      console.log('AuthProvider: No token, setting loading to false');
      setLoading(false);
      return;
    }

    try {
      console.log('AuthProvider: Setting token in API client...');
      apiClient.setToken(token);
      console.log('AuthProvider: Verifying token...');
      const response = await apiClient.auth.verify();
      console.log('AuthProvider: Verify response:', response);
      
      if (response && response.user) {
        console.log('AuthProvider: Setting authenticated user:', response.user);
        setUser(response.user);
        setOrganization(response.organization);
        setIsAuthenticated(true);
      } else {
        console.log('AuthProvider: Invalid response, clearing token');
        // Invalid token
        localStorage.removeItem('authToken');
        apiClient.setToken(null);
      }
    } catch (error) {
      console.error('AuthProvider: Auth initialization failed:', error);
      localStorage.removeItem('authToken');
      apiClient.setToken(null);
    } finally {
      console.log('AuthProvider: Setting loading to false');
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    console.log('AuthProvider: Login attempt with:', credentials.email);
    try {
      const response = await apiClient.auth.login(credentials);
      console.log('AuthProvider: Login response:', response);
      
      if (response && response.token) {
        apiClient.setToken(response.token);
        setUser(response.user);
        setOrganization(response.organization);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid response from server' };
      }
    } catch (error) {
      console.error('AuthProvider: Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const register = async (data) => {
    console.log('AuthProvider: Register attempt with:', data.email);
    try {
      const response = await apiClient.auth.register(data);
      console.log('AuthProvider: Register response:', response);
      
      if (response && response.token) {
        apiClient.setToken(response.token);
        setUser(response.user);
        setOrganization(response.organization);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid response from server' };
      }
    } catch (error) {
      console.error('AuthProvider: Register error:', error);
      return { success: false, error: error.message };
    }
  };

  const googleLogin = async (idToken) => {
    console.log('AuthProvider: Google login attempt');
    try {
      const response = await apiClient.auth.googleLogin({ idToken });
      console.log('AuthProvider: Google login response:', response);
      
      if (response && response.token) {
        apiClient.setToken(response.token);
        setUser(response.user);
        setOrganization(response.organization);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid response from server' };
      }
    } catch (error) {
      console.error('AuthProvider: Google login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    console.log('AuthProvider: Logging out...');
    apiClient.setToken(null);
    setUser(null);
    setOrganization(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedUser) => {
    console.log('AuthProvider: Updating user:', updatedUser);
    setUser(updatedUser);
  };

  const updateOrganization = (updatedOrg) => {
    console.log('AuthProvider: Updating organization:', updatedOrg);
    setOrganization(updatedOrg);
  };

  const value = {
    user,
    organization,
    isAuthenticated,
    loading,
    login,
    register,
    googleLogin,
    logout,
    updateUser,
    updateOrganization,
    initializeAuth,
  };

  console.log('AuthProvider: Current state:', {
    user: !!user,
    organization: !!organization,
    isAuthenticated,
    loading
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};