'use client';
import { useAuth } from '@/context/AuthContext';

export function useApi() {
  const { token, logout } = useAuth();

  const request = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (res.status === 401) { logout(); return null; }
    return res.json();
  };

  return { request };
}
