'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { decodeJwtPayload, getDefaultRouteForRole } from './authGuard';

type GuardResult = {
    role: string | null;
    checking: boolean;
};

const TOKEN_KEY = 'pharmabook_token';

const normalizeRole = (role?: string | null) => {
    if (!role) return null;

    const cleaned = role.toLowerCase().trim();

    if (cleaned === 'inv_manager') return 'inventory_manager';
    if (cleaned === 'inventory') return 'inventory_manager';
    if (cleaned === 'inventory-manager') return 'inventory_manager';

    return cleaned;
};

const isAllowedForPath = (role: string | null, pathname: string) => {
    if (!role) return false;

    const currentPath = pathname || '/';

    // Owner can access everything
    if (role === 'owner') return true;

    // Cashier can access only billing
    if (role === 'cashier') {
        return currentPath.startsWith('/billing');
    }

    // Inventory manager can access only inventory
    if (role === 'inventory_manager') {
        return currentPath.startsWith('/inventory');
    }

    return false;
};

export function useRoleGuard(): GuardResult {
    const router = useRouter();
    const pathname = usePathname();

    const [role, setRole] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);

        if (!token) {
            router.replace('/login');
            return;
        }

        const payload = decodeJwtPayload(token);
        const normalizedRole = normalizeRole(payload?.role);

        setRole(normalizedRole);

        if (!normalizedRole) {
            localStorage.removeItem(TOKEN_KEY);
            router.replace('/login');
            return;
        }

        const allowed = isAllowedForPath(normalizedRole, pathname);

        if (!allowed) {
            router.replace(getDefaultRouteForRole(normalizedRole));
            return;
        }

        setChecking(false);
    }, [pathname, router]);

    return { role, checking };
}