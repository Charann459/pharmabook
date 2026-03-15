import { create } from 'zustand';
import { authApi, saveToken, getToken, deleteToken, type MeResponse } from '../services/api';

type AuthState = {
  // State
  user: MeResponse | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean; // true once we've checked SecureStore on startup

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>; // called once on app start
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,

  // Called on app startup — restores session from SecureStore
  hydrate: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ isHydrated: true });
        return;
      }

      // Validate token by hitting /me
      const user = await authApi.me();
      set({ token, user, isHydrated: true });
    } catch {
      // Token expired or invalid — clear it
      await deleteToken();
      set({ token: null, user: null, isHydrated: true });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { token, user } = await authApi.login(email, password);
      await saveToken(token);
      // Fetch full user profile including shop details
      const me = await authApi.me();
      set({ token, user: me, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err; // re-throw so the UI can show the error
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore — logout locally regardless
    }
    await deleteToken();
    set({ token: null, user: null });
  },
}));

// Selector helpers — use these in components for clean access
export const useUser = () => useAuthStore((s) => s.user);
export const useRole = () => useAuthStore((s) => s.user?.role);
export const useIsOwner = () => useAuthStore((s) => s.user?.role === 'owner');
export const useIsHydrated = () => useAuthStore((s) => s.isHydrated);
