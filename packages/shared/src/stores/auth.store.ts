import { create } from 'zustand';
import { authApi } from '../api/auth.api';
import { configureClient, ApiError } from '../api/client';
import type { User } from '../types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status:   AuthStatus;
  token:    string | null;
  user:     (User & { shop_name?: string; gst_no?: string }) | null;
  error:    string | null;

  login:    (email: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
  hydrate:  (getStoredToken: () => string | null) => Promise<void>;
  clear:    () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  token:  null,
  user:   null,
  error:  null,

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const data = await authApi.login(email, password);
      // Configure the API client to attach token on future requests
      configureClient('', () => data.token);
      set({ status: 'authenticated', token: data.token, user: data.user as User, error: null });
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
    } catch {
      // Ignore logout API errors — clear local state regardless
    }
    set({ status: 'unauthenticated', token: null, user: null, error: null });
  },

  hydrate: async (getStoredToken) => {
    const token = getStoredToken();
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    set({ status: 'loading' });
    try {
      configureClient('', () => token);
      const user = await authApi.me(token);
      set({ status: 'authenticated', token, user, error: null });
    } catch {
      set({ status: 'unauthenticated', token: null, user: null });
    }
  },

  clear: () => set({ status: 'unauthenticated', token: null, user: null, error: null }),
}));
