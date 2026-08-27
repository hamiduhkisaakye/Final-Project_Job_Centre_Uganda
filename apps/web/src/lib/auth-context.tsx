'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, apiUpload, ApiError } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (dto: {
    email: string; password: string; fullName: string; phone?: string;
    role: 'JOB_SEEKER' | 'COMPANY'; companyName?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

// Access token lives only in memory (React state), never localStorage —
// Blueprint §3.1. A refresh happens once on mount using the httpOnly
// refresh cookie, so a page reload doesn't force a re-login.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Returns the fresh token directly (not just via state) so callers like
  // useApi's 401 handler can retry immediately without waiting on a
  // re-render — reading `accessToken` from the closure right after calling
  // this would still see the stale pre-refresh value.
  const refreshMe = useCallback(async (): Promise<string | null> => {
    try {
      const { accessToken: token, user: u } = await apiFetch<{ accessToken: string; user: User }>('/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(token);
      setUser(u);
      return token;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken: token, user: u } = await apiFetch<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setAccessToken(token);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (dto: any) => {
    const { accessToken: token, user: u } = await apiFetch<{ accessToken: string; user: User }>('/auth/register', {
      method: 'POST',
      body: dto,
    });
    setAccessToken(token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Authenticated fetch bound to the current access token, with a single
// silent-refresh-and-retry on 401 (access token expired mid-session).
export function useApi() {
  const { accessToken, refreshMe } = useAuth();
  return useCallback(
    async <T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
      try {
        return await apiFetch<T>(path, { ...opts, token: accessToken });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const freshToken = await refreshMe();
          if (!freshToken) throw err; // refresh cookie itself is gone — genuinely logged out
          return apiFetch<T>(path, { ...opts, token: freshToken });
        }
        throw err;
      }
    },
    [accessToken, refreshMe],
  );
}

// Same silent-refresh-and-retry pattern as useApi, for multipart uploads.
export function useApiUpload() {
  const { accessToken, refreshMe } = useAuth();
  return useCallback(
    async <T = any>(path: string, file: File): Promise<T> => {
      try {
        return await apiUpload<T>(path, file, accessToken);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const freshToken = await refreshMe();
          if (!freshToken) throw err;
          return apiUpload<T>(path, file, freshToken);
        }
        throw err;
      }
    },
    [accessToken, refreshMe],
  );
}
