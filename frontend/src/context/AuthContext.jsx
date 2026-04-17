'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Use sessionStorage so each browser tab has its own independent session.
// Admin can be logged in on one tab while captains are logged in on other tabs
// without interfering with each other.
const storage = typeof window !== 'undefined' ? window.sessionStorage : null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = storage?.getItem('token');
    const u = storage?.getItem('user');
    if (t && u) {
      setToken(t);
      setUser(JSON.parse(u));
    }
    setLoading(false);
  }, []);

  const login = (tokenVal, userData) => {
    setToken(tokenVal);
    setUser(userData);
    storage?.setItem('token', tokenVal);
    storage?.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    storage?.removeItem('token');
    storage?.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
