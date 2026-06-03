import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    // Check backend health
    const checkHealth = async () => {
      const isOnline = await api.checkHealth();
      setBackendOnline(isOnline);
    };

    // Load active session from localStorage
    const savedUser = localStorage.getItem('qms_user');
    const savedToken = localStorage.getItem('qms_token');
    
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Clear corrupt storage
        localStorage.removeItem('qms_user');
        localStorage.removeItem('qms_token');
      }
    }
    
    checkHealth();
    // Re-check health every 15 seconds
    const interval = setInterval(checkHealth, 15000);
    
    setLoading(false);
    return () => clearInterval(interval);
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const data = await api.login(username, password);
      // Backend returned data or fallback completed
      const activeUser = data.user || { username, email: `${username}@qms.com`, role: username.includes('admin') || username.includes('staff') ? 'Staff' : 'Customer' };
      setUser(activeUser);
      return activeUser;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password) => {
    setLoading(true);
    try {
      const newUser = await api.register(username, email, password);
      return newUser;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('qms_token');
    localStorage.removeItem('qms_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, backendOnline }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
