import { create } from 'zustand';
import { authApi, saveToken, getToken, deleteToken, type MeResponse, type UserRole } from '../services/api';

type NormalizedRole = 'owner' | 'cashier' | 'inventory_manager';

export const normalizeRole = (role?: UserRole | string | null): NormalizedRole | null => {
  if (!role) return null;

  const cleaned = String(role).toLowerCase().trim();

  if (cleaned === 'owner') return 'owner';
  if (cleaned === 'cashier') return 'cashier';
  if (cleaned === 'inv_manager') return 'inventory_manager';
  if (cleaned === 'inventory_manager') return 'inventory_manager';
  if (cleaned === 'inventory') return 'inventory_manager';
  if (cleaned === 'inventory-manager') return 'inventory_manager';

  return null;
};

export const getMobileDefaultRouteForRole = (role?: UserRole | string | null) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'cashier') return '/(app)/billing';
  if (normalizedRole === 'inventory_manager') return '/(app)/inventory';

  return '/(app)';
};

type AuthState = {
  user: MeResponse | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  login: (email: string, password: string) => Promise<MeResponse>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const token = await getToken();

      if (!token) {
        set({ token: null, user: null, isHydrated: true });
        return;
      }

      const user = await authApi.me();

      set({
        token,
        user,
        isHydrated: true,
      });
    } catch {
      await deleteToken();

      set({
        token: null,
        user: null,
        isHydrated: true,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });

    try {
      const { token } = await authApi.login(email, password);

      await saveToken(token);

      const me = await authApi.me();

      set({
        token,
        user: me,
        isLoading: false,
        isHydrated: true,
      });

      return me;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout locally even if server logout fails.
    }

    await deleteToken();

    set({
      token: null,
      user: null,
      isHydrated: true,
    });
  },
}));

export const useUser = () => useAuthStore((s) => s.user);
export const useRole = () => useAuthStore((s) => normalizeRole(s.user?.role));
export const useIsOwner = () => useAuthStore((s) => normalizeRole(s.user?.role) === 'owner');
export const useIsHydrated = () => useAuthStore((s) => s.isHydrated);