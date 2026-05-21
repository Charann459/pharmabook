'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
    getCurrentUserFromToken,
    getDefaultRouteForRole,
    normalizeRole,
} from '../../lib/authGuard';

export default function ForbiddenPage() {
    const [homeRoute, setHomeRoute] = useState('/login');
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        const user = getCurrentUserFromToken();

        if (!user) {
            setHomeRoute('/login');
            return;
        }

        const currentRole = normalizeRole(user.role || null);
        setRole(currentRole);
        setHomeRoute(getDefaultRouteForRole(currentRole));
    }, []);

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <section className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-500">
                    PharmaBook
                </p>

                <h1 className="mt-4 text-3xl font-bold text-slate-950">
                    403 - Access denied
                </h1>

                <p className="mt-3 text-sm text-slate-600">
                    Your current role {role ? `(${role})` : ''} does not have permission to
                    open this page.
                </p>

                <Link
                    href={homeRoute}
                    className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                    Go to allowed page
                </Link>
            </section>
        </main>
    );
}