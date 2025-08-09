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
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      apiClient.setToken(token);
      const response = await apiClient.auth.verify();
      
      if (response && response.user) {
        setUser(response.user);
        setOrganization(response.organization);
        setIsAuthenticated(true);
      } else {
        // Invalid token
        localStorage.removeItem('authToken');
        apiClient.setToken(null);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      localStorage.removeItem('authToken');
      apiClient.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await apiClient.auth.login(credentials);
      
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
      return { success: false, error: error.message };
    }
  };

  const register = async (data) => {
    try {
      const response = await apiClient.auth.register(data);
      
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
      return { success: false, error: error.message };
    }
  };

  const googleLogin = async (idToken) => {
    try {
      const response = await apiClient.auth.googleLogin({ idToken });
      
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
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    apiClient.setToken(null);
    setUser(null);
    setOrganization(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const updateOrganization = (updatedOrg) => {
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};