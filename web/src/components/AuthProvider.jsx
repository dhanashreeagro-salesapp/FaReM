import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = localStorage.getItem('ffma_access_token');
      const role = localStorage.getItem('ffma_role');
      const fullName = localStorage.getItem('ffma_full_name');
      const email = localStorage.getItem('ffma_email');
      const territoryName = localStorage.getItem('ffma_territory_name');

      if (token && role) {
        setUser({ role, full_name: fullName || '', email: email || '', territory_name: territoryName || '' });
        try {
          const meData = await api.getMe();
          if (meData && meData.role) {
            setUser({
              role: meData.role,
              full_name: meData.full_name,
              email: meData.email,
              territory_name: meData.territory_name
            });
            if (meData.full_name) localStorage.setItem('ffma_full_name', meData.full_name);
            if (meData.email) localStorage.setItem('ffma_email', meData.email);
            if (meData.territory_name) localStorage.setItem('ffma_territory_name', meData.territory_name || '');
          }
        } catch (err) {
          console.error("Failed to fetch fresh user profile:", err);
          if (err?.status === 401) {
            api.clearTokens();
            localStorage.removeItem('ffma_full_name');
            localStorage.removeItem('ffma_email');
            localStorage.removeItem('ffma_territory_name');
            setUser(null);
          }
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    api.setTokens(data.access, data.refresh);
    localStorage.setItem('ffma_role', data.role);
    if (data.full_name) localStorage.setItem('ffma_full_name', data.full_name);
    if (data.email || email) localStorage.setItem('ffma_email', data.email || email);
    if (data.territory_name) localStorage.setItem('ffma_territory_name', data.territory_name || '');
    
    setUser({
      role: data.role,
      full_name: data.full_name || '',
      email: data.email || email,
      territory_name: data.territory_name || ''
    });
    return data;
  };

  const logout = async () => {
    await api.logout();
    api.clearTokens();
    localStorage.removeItem('ffma_full_name');
    localStorage.removeItem('ffma_email');
    localStorage.removeItem('ffma_territory_name');
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
