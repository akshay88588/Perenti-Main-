import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error("Error parsing session:", e);
      try { localStorage.removeItem('currentUser'); } catch (_) {}
      return null;
    }
  });

  const login = useCallback((email, role, firstName = '', lastName = '') => {
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || email;
    const user = { email, role, firstName, lastName, displayName };
    localStorage.setItem('currentUser', JSON.stringify(user));
    setSession(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('currentUser');
    setSession(null);
  }, []);

  const isAdmin = session?.role === 'admin';
  const isUser = session?.role === 'user';

  return (
    <AuthContext.Provider value={{ session, login, logout, isAdmin, isUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
