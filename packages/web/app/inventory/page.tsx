'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoleGuard } from '../../lib/useRoleGuard';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type InventoryItem = {
    id: string;
    medicine_id: string;
    name: string;
    barcode: string;
    qty: number;
    batch_no: string;
    expiry_date: string;
    mrp: string | number;
    category?: string | null;
    low_stock_threshold: number;
};

type MedicineSearchItem = {
    id: string;
    name: string;
    barcode: string;
    mrp?: string | number;
    category?: string | null;
};

type FilterType = 'all' | 'low' | 'expiring';

const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('pharmabook_token');
};

const formatCurrency = (value: string | number | undefined) => {
    const num = Number(value ?? 0);
    return `₹${num.toFixed(2)}`;
};

const formatDate = (value: string) => {
    if (!value) return '-';

    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate).getTime();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    return expiry > now && expiry <= now + thirtyDays;
};

export default function InventoryPage() {
    const { checking } = useRoleGuard();

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [filter, setFilter] = useState<FilterType>('all');
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState('');

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [medicineQuery, setMedicineQuery] = useState('');
    const [medicineResults, setMedicineResults] = useState<MedicineSearchItem[]>([]);
    const [selectedMedicine, setSelectedMedicine] =
        useState<MedicineSearchItem | null>(null);

    const [qty, setQty] = useState('1');
    const [batchNo, setBatchNo] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [threshold, setThreshold] = useState('10');

    const logout = () => {
        localStorage.removeItem('pharmabook_token');
        window.location.href = '/login';
    };

    const fetchInventory = useCallback(async () => {
        const token = getToken();

        if (!token) {
            setError('Login token not found. Please login first, then open inventory.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();

            if (filter === 'low') {
                params.set('low_stock', 'true');
            }

            if (filter === 'expiring') {
                params.set('expiring_days', '30');
            }

            if (category !== 'all') {
                params.set('category', category);
            }

            const query = params.toString();

            const res = await fetch(`${API_URL}/api/inventory${query ? `?${query}` : ''}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || `Failed to load inventory. Status ${res.status}`);
            }

            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load inventory');
        } finally {
            setLoading(false);
        }
    }, [filter, category]);

    const searchMedicines = async () => {
        const token = getToken();

        if (!token) {
            setError('Login token not found. Please login first.');
            return;
        }

        if (!medicineQuery.trim()) {
            setMedicineResults([]);
            return;
        }

        try {
            setError(null);

            const res = await fetch(
                `${API_URL}/api/medicines/search?q=${encodeURIComponent(
                    medicineQuery.trim()
                )}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Medicine search failed');
            }

            const data = await res.json();
            setMedicineResults(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Medicine search failed');
        }
    };

    const submitStock = async () => {
        const token = getToken();

        if (!token) {
            setError('Login token not found. Please login first.');
            return;
        }

        if (!selectedMedicine) {
            setError('Please select a medicine first.');
            return;
        }

        if (!batchNo.trim()) {
            setError('Please enter batch number.');
            return;
        }

        if (!expiryDate) {
            setError('Please select expiry date.');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const res = await fetch(`${API_URL}/api/inventory`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    medicine_id: selectedMedicine.id,
                    qty: Number(qty),
                    batch_no: batchNo.trim(),
                    expiry_date: expiryDate,
                    low_stock_threshold: Number(threshold),
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || `Failed to add stock. Status ${res.status}`);
            }

            setSuccess('Stock added successfully.');
            setDrawerOpen(false);
            setMedicineQuery('');
            setMedicineResults([]);
            setSelectedMedicine(null);
            setQty('1');
            setBatchNo('');
            setExpiryDate('');
            setThreshold('10');

            await fetchInventory();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add stock');
        } finally {
            setSaving(false);
        }
    };

    const adjustQty = async (item: InventoryItem, change: number) => {
        const token = getToken();

        if (!token) {
            setError('Login token not found. Please login first.');
            return;
        }

        try {
            setError(null);
            setSuccess(null);

            const res = await fetch(`${API_URL}/api/inventory/${item.id}/adjust`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    qty: change,
                    reason: change > 0 ? 'Web inventory increment' : 'Web inventory decrement',
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Quantity adjustment failed');
            }

            setSuccess('Quantity updated.');
            await fetchInventory();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Quantity adjustment failed');
        }
    };

    useEffect(() => {
        if (checking) return;
        fetchInventory();
    }, [checking, fetchInventory]);

    const categories = useMemo(() => {
        const unique = new Set<string>();

        items.forEach((item) => {
            if (item.category) unique.add(item.category);
        });

        return Array.from(unique).sort();
    }, [items]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();

        if (!q) return items;

        return items.filter((item) => {
            return (
                item.name?.toLowerCase().includes(q) ||
                item.barcode?.toLowerCase().includes(q) ||
                item.batch_no?.toLowerCase().includes(q)
            );
        });
    }, [items, search]);

    if (checking) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-100">
                <p className="text-sm font-bold text-slate-600">Checking access...</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 text-slate-950">
            <header className="bg-slate-950 text-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-400 sm:tracking-[0.4em]">
                            PharmaBook Web
                        </p>

                        <h1 className="mt-3 text-2xl font-black sm:text-3xl">Inventory</h1>

                        <p className="mt-2 max-w-xl text-sm text-slate-200">
                            Stock list, filters, low stock alerts, and batch management.
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                        <Link
                            href="/"
                            className="w-full rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-100 sm:w-auto"
                        >
                            Back to Dashboard
                        </Link>

                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 sm:w-auto"
                        >
                            Add Stock
                        </button>

                        <button
                            onClick={logout}
                            className="w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700 sm:w-auto"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
                        <h2 className="font-bold">Unable to complete action</h2>
                        <p className="mt-1 text-sm">{error}</p>

                        <button
                            onClick={fetchInventory}
                            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {success && (
                    <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
                        {success}
                    </div>
                )}

                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by medicine, barcode, or batch"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                        />

                        <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-300 bg-slate-50 p-1 lg:w-auto lg:grid-cols-none lg:auto-cols-max lg:grid-flow-col">
                            {[
                                { key: 'all', label: 'All' },
                                { key: 'low', label: 'Low Stock' },
                                { key: 'expiring', label: 'Expiring' },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    onClick={() => setFilter(option.key as FilterType)}
                                    className={`min-w-0 rounded-lg px-2 py-2 text-center text-[11px] font-bold leading-tight sm:px-4 sm:text-sm ${filter === option.key
                                        ? 'bg-slate-950 text-white'
                                        : 'text-slate-600 hover:bg-white'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500 lg:w-auto"
                        >
                            <option value="all">All categories</option>

                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="text-lg font-black">Stock list</h2>
                        <p className="text-sm text-slate-500">
                            Showing {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}
                        </p>
                    </div>

                    {loading ? (
                        <div className="space-y-3 p-5">
                            {[1, 2, 3, 4].map((row) => (
                                <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                            ))}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No inventory items found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">Medicine</th>
                                        <th className="px-5 py-4">Barcode</th>
                                        <th className="px-5 py-4">Qty</th>
                                        <th className="px-5 py-4">Batch no</th>
                                        <th className="px-5 py-4">Expiry date</th>
                                        <th className="px-5 py-4">MRP</th>
                                        <th className="px-5 py-4">Category</th>
                                        <th className="px-5 py-4">Adjust</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {filteredItems.map((item) => {
                                        const low = item.qty <= item.low_stock_threshold;
                                        const expiring = isExpiringSoon(item.expiry_date);

                                        return (
                                            <tr
                                                key={item.id}
                                                className={low ? 'bg-red-50' : expiring ? 'bg-amber-50' : 'bg-white'}
                                            >
                                                <td className="px-5 py-4 font-bold text-slate-900">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span>{item.name}</span>

                                                        {low && (
                                                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                                                                Low
                                                            </span>
                                                        )}

                                                        {expiring && (
                                                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                                                                Expiring
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-slate-600">{item.barcode}</td>
                                                <td className="px-5 py-4 font-black">{item.qty}</td>
                                                <td className="px-5 py-4 text-slate-600">{item.batch_no}</td>
                                                <td className="px-5 py-4 text-slate-600">
                                                    {formatDate(item.expiry_date)}
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">{formatCurrency(item.mrp)}</td>
                                                <td className="px-5 py-4 text-slate-600">{item.category || '-'}</td>

                                                <td className="px-5 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => adjustQty(item, -1)}
                                                            disabled={item.qty <= 0}
                                                            className="rounded-lg bg-slate-100 px-3 py-2 font-bold text-slate-900 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            -
                                                        </button>

                                                        <button
                                                            onClick={() => adjustQty(item, 1)}
                                                            className="rounded-lg bg-emerald-500 px-3 py-2 font-bold text-white hover:bg-emerald-600"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            {drawerOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/40">
                    <div className="ml-auto h-full w-full overflow-y-auto bg-white p-4 shadow-2xl sm:max-w-xl sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-2xl font-black">Add Stock</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Search medicine, select it, then enter batch details.
                                </p>
                            </div>

                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 sm:w-auto"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-8 space-y-5">
                            <div>
                                <label className="text-sm font-bold text-slate-700">Medicine search</label>

                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={medicineQuery}
                                        onChange={(e) => setMedicineQuery(e.target.value)}
                                        placeholder="Search by medicine name or barcode"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                    />

                                    <button
                                        onClick={searchMedicines}
                                        className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white sm:w-auto"
                                    >
                                        Search
                                    </button>
                                </div>
                            </div>

                            {medicineResults.length > 0 && (
                                <div className="rounded-2xl border border-slate-200">
                                    {medicineResults.map((medicine) => (
                                        <button
                                            key={medicine.id}
                                            onClick={() => setSelectedMedicine(medicine)}
                                            className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${selectedMedicine?.id === medicine.id
                                                ? 'bg-emerald-50'
                                                : 'bg-white hover:bg-slate-50'
                                                }`}
                                        >
                                            <p className="font-bold">{medicine.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {medicine.barcode} • {medicine.category || 'No category'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedMedicine && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                                    <p className="text-sm font-bold">Selected medicine</p>
                                    <p className="mt-1">{selectedMedicine.name}</p>
                                    <p className="text-xs">{selectedMedicine.barcode}</p>
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm font-bold text-slate-700">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={qty}
                                        onChange={(e) => setQty(e.target.value)}
                                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700">
                                        Low stock threshold
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={threshold}
                                        onChange={(e) => setThreshold(e.target.value)}
                                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-slate-700">Batch number</label>
                                <input
                                    value={batchNo}
                                    onChange={(e) => setBatchNo(e.target.value)}
                                    placeholder="Example: BATCH001"
                                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-slate-700">Expiry date</label>
                                <input
                                    type="date"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <button
                                onClick={submitStock}
                                disabled={saving}
                                className="w-full rounded-xl bg-emerald-600 px-5 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? 'Saving...' : 'Submit Stock'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}