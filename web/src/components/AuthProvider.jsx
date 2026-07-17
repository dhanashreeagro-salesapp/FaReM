import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ffma_access_token');
    const role = localStorage.getItem('ffma_role');
    if (token && role) {
      setUser({ role });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    api.setTokens(data.access, data.refresh);
    localStorage.setItem('ffma_role', data.role);
    setUser({ role: data.role });
    return data;
  };

  const logout = async () => {
    await api.logout();
    api.clearTokens();
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'TerritoryManager' || user?.role === 'ZonalManager';
  const isContentTeam = user?.role === 'ContentTeam';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated, isAdmin, isManager, isContentTeam }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
