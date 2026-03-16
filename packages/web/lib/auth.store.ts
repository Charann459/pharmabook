'use client';

import { create } from 'zustand';
import { authApi } from '../../../shared/src/api/auth.api';
import { configureClient, ApiError } from '../../../shared/src/api/client';
import { API_URL } from './api';
import type { User } from '../../../shared/src/types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  token:  string | null;
  user:   (User & { shop_name?: string; gst_no?: string }) | null;
  error:  string | null;

  login:   (email: string, password: string) => Promise<void>;
  logout:  () => Promise<void>;
  hydrate: () => Promise<void>;
}

const TOKEN_KEY = 'pharmabook_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  token:  null,
  user:   null,
  error:  null,

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      configureClient(API_URL);
      const data = await authApi.login(email, password);
      localStorage.setItem(TOKEN_KEY, data.token);
      configureClient(API_URL, () => data.token);
      set({ status: 'authenticated', token: data.token, user: data.user as User });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      set({ status: 'unauthenticated', error: message });
      throw err;
    }
  },

  logout: async () => {
    const { token } = get();
    try {
      if (token) await authApi.logout(token);
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
    set({ status: 'unauthenticated', token: null, user: null, error: null });
  },

  hydrate: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { set({ status: 'unauthenticated' }); return; }
    set({ status: 'loading' });
    try {
      configureClient(API_URL, () => token);
      const user = await authApi.me(token);
      set({ status: 'authenticated', token, user });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ status: 'unauthenticated', token: null, user: null });
    }
  },
}));
