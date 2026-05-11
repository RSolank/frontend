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
    try {
      const [userData, constantsData] = await Promise.all([
        apiFetch('/api/users/me'),
        apiFetch('/api/options/constants')
      ]);
      setUser(userData.user || null);
      setConstants(constantsData || null);
    } catch {
      setUser(null);
      setConstants(null);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    let isMounted = true;
    refreshUser();
    return () => {
      isMounted = false;
    };
  }, []);


  const register = async (payload) => {
    setError(null);
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setUser({
      user_id: data.user_id,
      first_name: data.first_name,
      last_name: data.last_name
    });
    navigate('/dashboard');
  };

  const login = async (payload) => {
    setError(null);
    await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email_id: payload.email_id, password: payload.password })
    });
    const me = await apiFetch('/api/users/me');
    setUser(me.user || null);
    navigate('/dashboard');
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  const value = { user, constants, loading, error, setError, register, login, logout, refreshUser };


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

