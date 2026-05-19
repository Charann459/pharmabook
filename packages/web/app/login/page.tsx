'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState('owner@example.com');
    const [password, setPassword] = useState('secret123');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (e: FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || `Login failed. Status ${res.status}`);
            }

            if (!data?.token) {
                throw new Error('Login successful but token missing from response.');
            }

            localStorage.setItem('pharmabook_token', data.token);
            router.push('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-100 text-slate-950">
            <section className="flex min-h-screen items-center justify-center px-4 py-10">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-500">
                        PharmaBook
                    </p>

                    <h1 className="mt-4 text-3xl font-black">Login</h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Sign in to access dashboard, billing, inventory, and reports.
                    </p>

                    {error && (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={login} className="mt-6 space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-700">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                placeholder="owner@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-700">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                placeholder="secret123"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <Link
                        href="/"
                        className="mt-4 block text-center text-sm font-bold text-slate-500 hover:text-slate-950"
                    >
                        Back to dashboard
                    </Link>
                </div>
            </section>
        </main>
    );
}