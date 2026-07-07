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
      return isOnline;
    };

    const verifySession = async () => {
      const savedUser = localStorage.getItem('qms_user');
      const savedToken = localStorage.getItem('qms_token');
      
      if (savedUser && savedToken) {
        try {
          const isOnline = await checkHealth();
          if (isOnline) {
            // Validate token against backend
            const meData = await api.getMe();
            const loggedUser = { username: meData.name, email: meData.email, role: meData.role };
            setUser(loggedUser);
            localStorage.setItem('qms_user', JSON.stringify(loggedUser));
            localStorage.removeItem('qms_offline_mode');
          } else {
            // Backend offline, fallback to cached localStorage user
            localStorage.setItem('qms_offline_mode', 'true');
            setUser(JSON.parse(savedUser));
          }
        } catch (err) {
          console.warn("Session invalid on startup, logging out:", err);
          setUser(null);
          localStorage.removeItem('qms_user');
          localStorage.removeItem('qms_token');
          localStorage.removeItem('qms_offline_mode');
        }
      }
      if (!savedUser || !savedToken) {
        localStorage.removeItem('qms_offline_mode');
      }
      setLoading(false);
    };

    verifySession();
    checkHealth();

    // Re-check health every 15 seconds
    const interval = setInterval(checkHealth, 15000);

    // Global unauthorized handler
    const handleUnauthorizedEvent = () => {
      setUser(null);
    };
    window.addEventListener('qms_unauthorized', handleUnauthorizedEvent);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('qms_unauthorized', handleUnauthorizedEvent);
    };
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('qms_user');
    const savedToken = localStorage.getItem('qms_token');
    const offlineMode = localStorage.getItem('qms_offline_mode') === 'true';

    if (!backendOnline || !offlineMode || !savedUser || !savedToken) {
      return;
    }

    let cancelled = false;

    const revalidateSession = async () => {
      setLoading(true);
      try {
        const meData = await api.getMe();
        if (cancelled) return;

        const loggedUser = { username: meData.name, email: meData.email, role: meData.role };
        setUser(loggedUser);
        localStorage.setItem('qms_user', JSON.stringify(loggedUser));
        localStorage.removeItem('qms_offline_mode');
      } catch (err) {
        if (cancelled) return;

        console.warn('Cached session could not be revalidated:', err);
        setUser(null);
        localStorage.removeItem('qms_user');
        localStorage.removeItem('qms_token');
        localStorage.removeItem('qms_offline_mode');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    revalidateSession();

    return () => {
      cancelled = true;
    };
  }, [backendOnline]);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const data = await api.login(username, password);
      // Backend returned data or fallback completed
      const activeUser = data.user || { username, email: `${username}@qms.com`, role: username.includes('admin') || username.includes('staff') ? 'Staff' : 'Customer' };
      setUser(activeUser);
      localStorage.removeItem('qms_offline_mode');
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
    localStorage.removeItem('qms_offline_mode');
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
