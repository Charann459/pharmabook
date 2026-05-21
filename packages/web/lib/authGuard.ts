'use client';

export type UserRole = 'owner' | 'cashier' | 'inventory_manager' | 'inv_manager';

export type AuthUser = {
    user_id?: string;
    shop_id?: string;
    role?: UserRole | string;
    exp?: number;
    iat?: number;
};

const TOKEN_KEY = 'pharmabook_token';

export function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
}

export function decodeJwtPayload(token: string): AuthUser | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;

        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64)
                .split('')
                .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
                .join('')
        );

        return JSON.parse(json);
    } catch {
        return null;
    }
}

export function getCurrentUserFromToken(): AuthUser | null {
    const token = getToken();
    if (!token) return null;

    const user = decodeJwtPayload(token);
    if (!user) return null;

    if (user.exp && Date.now() >= user.exp * 1000) {
        clearToken();
        return null;
    }

    return user;
}

export function normalizeRole(role?: string | null) {
    if (!role) return null;

    if (role === 'inv_manager') return 'inventory_manager';

    return role;
}

export const getDefaultRouteForRole = (role?: string | null) => {
    if (role === 'cashier') return '/billing';
    if (role === 'inventory_manager' || role === 'inv_manager') return '/inventory';
    return '/';
};

export function canAccessRoute(role: string | null | undefined, path: string) {
    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) return false;

    if (normalizedRole === 'owner') return true;

    if (normalizedRole === 'cashier') {
        return path.startsWith('/billing') || path.startsWith('/403');
    }

    if (normalizedRole === 'inventory_manager') {
        return path.startsWith('/inventory') || path.startsWith('/403');
    }

    return false;
}