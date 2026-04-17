'use client';
import { useAuth } from '@/context/AuthContext';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useApi() {
  const { token, logout } = useAuth();

  const request = async (path, options = {}) => {
    // Normalize path to avoid double slashes
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${BACKEND_URL}${normalizedPath}`;

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
