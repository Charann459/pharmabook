'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '../../lib/api';

const TOKEN_KEY = 'pharmabook_token';

type Shop = {
    id?: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    gst_no?: string | null;
    active?: boolean;
};

type StaffUser = {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'cashier' | 'inv_manager' | string;
    active: boolean;
    created_at?: string;
};

type AuthPayload = {
    user_id?: string;
    shop_id?: string;
    role?: string;
    exp?: number;
};

const emptyShop: Shop = {
    name: '',
    address: '',
    phone: '',
    gst_no: '',
};

const emptyStaffForm = {
    name: '',
    email: '',
    password: '',
    role: 'cashier',
};

function decodeJwtPayload(token: string): AuthPayload | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(normalized)
                .split('')
                .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
                .join('')
        );

        return JSON.parse(json);
    } catch {
        return null;
    }
}

function roleLabel(role: string) {
    if (role === 'inv_manager') return 'Inventory Manager';
    if (role === 'cashier') return 'Cashier';
    if (role === 'owner') return 'Owner';
    return role;
}

function StatusMessage({
    type,
    message,
}: {
    type: 'success' | 'error';
    message: string;
}) {
    return (
        <div
            className={`rounded-2xl border p-4 text-sm ${type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
        >
            {message}
        </div>
    );
}

export default function SettingsPage() {
    const router = useRouter();

    const [shop, setShop] = useState<Shop>(emptyShop);
    const [users, setUsers] = useState<StaffUser[]>([]);
    const [staffForm, setStaffForm] = useState(emptyStaffForm);
    const [passwordForm, setPasswordForm] = useState({
        password: '',
        confirmPassword: '',
    });

    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentRole, setCurrentRole] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [savingShop, setSavingShop] = useState(false);
    const [addingStaff, setAddingStaff] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [actionUserId, setActionUserId] = useState<string | null>(null);

    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const token = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(TOKEN_KEY);
    }, []);

    const authHeaders = useCallback(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);

        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${savedToken}`,
        };
    }, []);

    const handleAuthFailure = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        router.push('/login');
    }, [router]);

    const requestJson = useCallback(
        async (path: string, options: RequestInit = {}) => {
            const savedToken = localStorage.getItem(TOKEN_KEY);

            if (!savedToken) {
                handleAuthFailure();
                throw new Error('Login token not found.');
            }

            const res = await fetch(`${API_URL}${path}`, {
                ...options,
                headers: {
                    ...authHeaders(),
                    ...(options.headers || {}),
                },
                cache: 'no-store',
            });

            const data = await res.json().catch(() => null);

            if (res.status === 401 || res.status === 403) {
                handleAuthFailure();
                throw new Error('Session expired. Please login again.');
            }

            if (!res.ok) {
                throw new Error(data?.error || `Request failed with status ${res.status}`);
            }

            return data;
        },
        [authHeaders, handleAuthFailure]
    );

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const savedToken = localStorage.getItem(TOKEN_KEY);

            if (!savedToken) {
                handleAuthFailure();
                return;
            }

            const payload = decodeJwtPayload(savedToken);
            setCurrentUserId(payload?.user_id || '');
            setCurrentRole(payload?.role || '');

            if (payload?.role !== 'owner') {
                setError('Only owner can access settings.');
                return;
            }

            const [shopResponse, usersResponse] = await Promise.all([
                requestJson('/api/shops/me'),
                requestJson('/api/users'),
            ]);

            setShop({
                name: shopResponse?.shop?.name || '',
                address: shopResponse?.shop?.address || '',
                phone: shopResponse?.shop?.phone || '',
                gst_no: shopResponse?.shop?.gst_no || '',
                active: shopResponse?.shop?.active,
                id: shopResponse?.shop?.id,
            });

            setUsers(Array.isArray(usersResponse) ? usersResponse : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    }, [handleAuthFailure, requestJson]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const saveShopDetails = async (event: FormEvent) => {
        event.preventDefault();

        try {
            setSavingShop(true);
            setError(null);
            setSuccess(null);

            const response = await requestJson('/api/shops/me', {
                method: 'PUT',
                body: JSON.stringify({
                    name: shop.name,
                    address: shop.address || '',
                    phone: shop.phone || '',
                    gst_no: shop.gst_no || '',
                }),
            });

            setShop({
                name: response?.shop?.name || '',
                address: response?.shop?.address || '',
                phone: response?.shop?.phone || '',
                gst_no: response?.shop?.gst_no || '',
                active: response?.shop?.active,
                id: response?.shop?.id,
            });

            setSuccess('Shop details updated.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update shop');
        } finally {
            setSavingShop(false);
        }
    };

    const addStaff = async (event: FormEvent) => {
        event.preventDefault();

        try {
            setAddingStaff(true);
            setError(null);
            setSuccess(null);

            await requestJson('/api/users', {
                method: 'POST',
                body: JSON.stringify(staffForm),
            });

            setStaffForm(emptyStaffForm);
            setSuccess('Staff user added.');
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add staff');
        } finally {
            setAddingStaff(false);
        }
    };

    const deactivateUser = async (user: StaffUser) => {
        if (user.id === currentUserId) {
            setError('You cannot deactivate your own account.');
            return;
        }

        const confirmed = window.confirm(`Deactivate ${user.name}?`);
        if (!confirmed) return;

        try {
            setActionUserId(user.id);
            setError(null);
            setSuccess(null);

            await requestJson(`/api/users/${user.id}`, {
                method: 'DELETE',
            });

            setSuccess('User deactivated.');
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to deactivate user');
        } finally {
            setActionUserId(null);
        }
    };

    const reactivateUser = async (user: StaffUser) => {
        try {
            setActionUserId(user.id);
            setError(null);
            setSuccess(null);

            await requestJson(`/api/users/${user.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ active: true }),
            });

            setSuccess('User reactivated.');
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reactivate user');
        } finally {
            setActionUserId(null);
        }
    };

    const changePassword = async (event: FormEvent) => {
        event.preventDefault();

        if (!currentUserId) {
            setError('Current user not found.');
            return;
        }

        if (passwordForm.password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        if (passwordForm.password !== passwordForm.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        try {
            setChangingPassword(true);
            setError(null);
            setSuccess(null);

            await requestJson(`/api/users/${currentUserId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    password: passwordForm.password,
                }),
            });

            setPasswordForm({
                password: '',
                confirmPassword: '',
            });

            setSuccess('Password changed successfully.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to change password');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-100 text-slate-950">
            <section className="bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-6">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-400 sm:text-sm">
                            PharmaBook Web
                        </p>
                        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Settings</h1>
                        <p className="mt-1 text-sm text-slate-300">
                            Manage shop details, staff users, and account security.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <Link
                            href="/"
                            className="rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-100"
                        >
                            Back to Dashboard
                        </Link>

                        <button
                            onClick={() => {
                                localStorage.removeItem(TOKEN_KEY);
                                router.push('/login');
                            }}
                            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
                {success ? <StatusMessage type="success" message={success} /> : null}
                {error ? <StatusMessage type="error" message={error} /> : null}

                {loading ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="h-96 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" />
                        <div className="h-96 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" />
                    </div>
                ) : currentRole !== 'owner' ? (
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <h2 className="text-xl font-black">Owner access required</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Settings page is available only for shop owner accounts.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                            <form
                                onSubmit={saveShopDetails}
                                className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
                            >
                                <div className="mb-5">
                                    <h2 className="text-xl font-black">Shop Details</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Update shop name, address, phone, and GST number.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">Shop name</span>
                                        <input
                                            value={shop.name}
                                            onChange={(event) =>
                                                setShop((prev) => ({ ...prev, name: event.target.value }))
                                            }
                                            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                            required
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">Address</span>
                                        <textarea
                                            value={shop.address || ''}
                                            onChange={(event) =>
                                                setShop((prev) => ({ ...prev, address: event.target.value }))
                                            }
                                            rows={4}
                                            className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                        />
                                    </label>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="text-sm font-bold text-slate-700">Phone</span>
                                            <input
                                                value={shop.phone || ''}
                                                onChange={(event) =>
                                                    setShop((prev) => ({ ...prev, phone: event.target.value }))
                                                }
                                                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="text-sm font-bold text-slate-700">GST number</span>
                                            <input
                                                value={shop.gst_no || ''}
                                                onChange={(event) =>
                                                    setShop((prev) => ({ ...prev, gst_no: event.target.value }))
                                                }
                                                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                            />
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={savingShop}
                                        className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {savingShop ? 'Saving...' : 'Save Shop Details'}
                                    </button>
                                </div>
                            </form>

                            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
                                <div className="mb-5">
                                    <h2 className="text-xl font-black">Staff Management</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Add staff and manage active status.
                                    </p>
                                </div>

                                <form onSubmit={addStaff} className="grid gap-4 rounded-2xl bg-slate-50 p-4 lg:grid-cols-2">
                                    <input
                                        value={staffForm.name}
                                        onChange={(event) =>
                                            setStaffForm((prev) => ({ ...prev, name: event.target.value }))
                                        }
                                        className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                        placeholder="Name"
                                        required
                                    />

                                    <input
                                        type="email"
                                        value={staffForm.email}
                                        onChange={(event) =>
                                            setStaffForm((prev) => ({ ...prev, email: event.target.value }))
                                        }
                                        className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                        placeholder="Email"
                                        required
                                    />

                                    <input
                                        type="password"
                                        value={staffForm.password}
                                        onChange={(event) =>
                                            setStaffForm((prev) => ({ ...prev, password: event.target.value }))
                                        }
                                        className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                        placeholder="Password minimum 8 chars"
                                        required
                                    />

                                    <select
                                        value={staffForm.role}
                                        onChange={(event) =>
                                            setStaffForm((prev) => ({ ...prev, role: event.target.value }))
                                        }
                                        className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                    >
                                        <option value="cashier">Cashier</option>
                                        <option value="inv_manager">Inventory Manager</option>
                                    </select>

                                    <button
                                        type="submit"
                                        disabled={addingStaff}
                                        className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 lg:col-span-2"
                                    >
                                        {addingStaff ? 'Adding...' : 'Add Staff'}
                                    </button>
                                </form>

                                <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                                    <table className="min-w-[720px] w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3">Name</th>
                                                <th className="px-4 py-3">Email</th>
                                                <th className="px-4 py-3">Role</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {users.map((user) => (
                                                <tr key={user.id}>
                                                    <td className="px-4 py-4 font-bold text-slate-900">
                                                        {user.name}
                                                        {user.id === currentUserId ? (
                                                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                                                                You
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-4 py-4 text-slate-600">{user.email}</td>
                                                    <td className="px-4 py-4 text-slate-600">{roleLabel(user.role)}</td>
                                                    <td className="px-4 py-4">
                                                        <span
                                                            className={`rounded-full px-3 py-1 text-xs font-bold ${user.active
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : 'bg-red-100 text-red-700'
                                                                }`}
                                                        >
                                                            {user.active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        {user.id === currentUserId ? (
                                                            <span className="text-xs font-bold text-slate-400">
                                                                Protected
                                                            </span>
                                                        ) : user.active ? (
                                                            <button
                                                                onClick={() => deactivateUser(user)}
                                                                disabled={actionUserId === user.id}
                                                                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                                                            >
                                                                {actionUserId === user.id ? 'Working...' : 'Deactivate'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => reactivateUser(user)}
                                                                disabled={actionUserId === user.id}
                                                                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                                                            >
                                                                {actionUserId === user.id ? 'Working...' : 'Reactivate'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}

                                            {users.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                                        No users found.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <form
                            onSubmit={changePassword}
                            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
                        >
                            <div className="mb-5">
                                <h2 className="text-xl font-black">Account</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Change your account password.
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">New password</span>
                                    <input
                                        type="password"
                                        value={passwordForm.password}
                                        onChange={(event) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                password: event.target.value,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                        placeholder="Minimum 8 characters"
                                        required
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Confirm password</span>
                                    <input
                                        type="password"
                                        value={passwordForm.confirmPassword}
                                        onChange={(event) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                confirmPassword: event.target.value,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                        placeholder="Confirm password"
                                        required
                                    />
                                </label>

                                <button
                                    type="submit"
                                    disabled={changingPassword}
                                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {changingPassword ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </section>
        </main>
    );
}