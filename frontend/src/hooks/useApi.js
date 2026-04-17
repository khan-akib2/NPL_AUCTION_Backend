'use client';
import { useAuth } from '@/context/AuthContext';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useApi() {
  const { token } = useAuth();

  const request = async (path, options = {}) => {
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
    // Return null on 401 but don't force logout — the session is per-tab
    // and the token is still valid; a 401 here is likely a race condition
    if (res.status === 401) return null;
    return res.json();
  };

  return { request };
}
