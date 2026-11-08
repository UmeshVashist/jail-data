/**
 * client/src/context/AuthContext.jsx - Authentication & Session State Management
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { translateToHindi } from '../utils/hindiTranslator';

const AuthContext = createContext();

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const lastActivityRef = useRef(Date.now());

  const showToast = useCallback((rawMessage, type = 'info') => {
    const message = translateToHindi(rawMessage);
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/session');
      const userData = res ? (res.user || res.data) : null;
      if (res && res.success && userData) {
        setUser(userData);
        return userData;
      } else {
        setUser(null);
        return null;
      }
    } catch (err) {
      setUser(null);
      return null;
    }
  }, []);

  // Initial session check
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  // Periodic user permission sync (every 15 seconds)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshUser();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  // Inactivity tracking
  useEffect(() => {
    if (!user) return;

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('click', recordActivity);
    window.addEventListener('scroll', recordActivity);

    const checkInterval = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT_MS) {
        showToast('15 मिनट तक कोई गतिविधि न होने के कारण आप स्वतः लॉग आउट हो गए हैं।', 'warning');
        try {
          await api.post('/api/auth/logout');
        } catch (e) {}
        setUser(null);
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('click', recordActivity);
      window.removeEventListener('scroll', recordActivity);
      clearInterval(checkInterval);
    };
  }, [user, showToast]);

  const login = async (username, password, rememberMe) => {
    const res = await api.post('/api/auth/login', { username, password, rememberMe });
    const userData = res ? (res.user || res.data) : null;
    if (res && (res.success || userData)) {
      setUser(userData);
      lastActivityRef.current = Date.now();
      showToast(res.message || `वापसी पर स्वागत है, ${userData?.username || username}!`, 'success');
      return userData;
    }
    throw new Error((res && res.message) || 'अमान्य यूज़रनेम या पासवर्ड।');
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {}
    setUser(null);
    showToast('सफलतापूर्वक साइन आउट हो गए।', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        showToast,
        toasts,
        removeToast,
        isAdmin: user?.role?.toLowerCase() === 'admin',
        canImport: !!(user?.importPermission || user?.role?.toLowerCase() === 'admin'),
        hasFullAccess: !!(user?.fullAccess || user?.role?.toLowerCase() === 'admin'),
        canAccessPS: !!(user?.psListPermission || user?.role?.toLowerCase() === 'admin'),
        canSendDeleteRequest: !!(user?.deleteRequestPermission || user?.role?.toLowerCase() === 'admin')
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

