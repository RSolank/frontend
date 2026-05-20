import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [constants, setConstants] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const refreshUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const [userData, constantsData] = await Promise.all([
        apiFetch('/api/users/me'),
        apiFetch('/api/options/constants')
      ]);
      setUser(userData.user || null);
      setConstants(constantsData || null);
    } catch (err) {
      console.error("Refresh user failed:", err);
      // If unauthorized, token might be expired and refresh handled by apiClient
      // but if it still fails, clear user.
      if (err.status === 401) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    refreshUser();
  }, []);


  const register = async (payload) => {
    setError(null);
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      setUser({
        user_id: data.user_id,
        email_id: data.email_id,
        first_name: data.first_name,
        last_name: data.last_name
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.detail || 'Registration failed');
      throw err;
    }
  };

  const login = async (payload) => {
    setError(null);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email_id: payload.email_id, password: payload.password })
      });
      
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      const me = await apiFetch('/api/users/me');
      setUser(me.user || null);
      navigate('/dashboard');
    } catch (err) {
      setError(err.detail || 'Login failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      navigate('/login');
    }
  };

  const value = { user, constants, loading, error, setError, register, login, logout, refreshUser };


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
