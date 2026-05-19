'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../lib/api';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { useRouter } from 'next/navigation';

type JwtPayload = {
    user_id: string;
    shop_id: string;
    role: string;
    iat?: number;
    exp?: number;
};

type Medicine = {
    id: string;
    barcode?: string;
    name: string;
    mrp: number | string;
    gst_rate: number | string;
    category?: string;
};

type CartItem = {
    medicine_id: string;
    name: string;
    qty: number;
    unit_price: number;
    gst_rate: number;
};

type BillResponse = {
    id?: string;
    bill?: {
        id: string;
        bill_no?: string;
        total?: number;
    };
    bill_no?: string;
    total?: number;
};

const TOKEN_KEY = 'pharmabook_token';

function decodeJwt(token: string): JwtPayload | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;

        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function money(value: number) {
    return `₹${value.toFixed(2)}`;
}

export default function BillingPage() {
    const { checking } = useRoleGuard();

    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);

    const [query, setQuery] = useState('');
    const [barcode, setBarcode] = useState('');
    const [results, setResults] = useState<Medicine[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState(0);

    const [manualOpen, setManualOpen] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualPrice, setManualPrice] = useState('');
    const [manualGst, setManualGst] = useState('12');

    const [loadingSearch, setLoadingSearch] = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);
    const [message, setMessage] = useState('');
    const [billId, setBillId] = useState<string | null>(null);
    const [billNo, setBillNo] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfStatus, setPdfStatus] = useState<'idle' | 'waiting' | 'ready' | 'error'>('idle');
    const [pdfError, setPdfError] = useState<string | null>(null);

    const router = useRouter();

    const logout = () => {
        localStorage.removeItem('pharmabook_token');
        router.replace('/login');
    };

    useEffect(() => {
        const stored = localStorage.getItem(TOKEN_KEY);
        setToken(stored);

        if (stored) {
            const decoded = decodeJwt(stored);
            setRole(decoded?.role ?? null);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
            }
        };
    }, [pdfUrl]);

    const isAllowed = role === 'owner' || role === 'cashier';

    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
    }, [cart]);

    const gstTotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const taxable = item.unit_price * item.qty;
            return sum + taxable * (item.gst_rate / 100);
        }, 0);
    }, [cart]);

    const cgst = gstTotal / 2;
    const sgst = gstTotal / 2;
    const total = Math.max(0, subtotal + gstTotal - discount);

    async function apiFetch(path: string, options: RequestInit = {}) {
        if (!token) throw new Error('Login token not found');

        const res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : null;

        if (!res.ok) {
            throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
        }

        return data;
    }

    async function searchMedicines() {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        try {
            setLoadingSearch(true);
            setMessage('');

            const data = await apiFetch(
                `/api/medicines/search?q=${encodeURIComponent(query.trim())}`
            );

            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.medicines)
                        ? data.medicines
                        : Array.isArray(data?.rows)
                            ? data.rows
                            : [];

            setResults(list);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setLoadingSearch(false);
        }
    }

    async function resolveBarcode() {
        if (!barcode.trim()) return;

        try {
            setMessage('');

            const data = await apiFetch(
                `/api/medicines/resolve/${encodeURIComponent(barcode.trim())}`
            );

            const medicine = data?.medicine ?? data;

            if (!medicine?.id) {
                setManualOpen(true);
                setMessage('Barcode not found. Add item manually.');
                return;
            }

            addMedicineToCart(medicine);
            setBarcode('');
        } catch {
            setManualOpen(true);
            setMessage('Barcode not found. Add item manually.');
        }
    }

    function addMedicineToCart(medicine: Medicine) {
        const price = Number(medicine.mrp ?? 0);
        const gst = Number(medicine.gst_rate ?? 0);

        if (!medicine.id || !medicine.name || price <= 0) {
            setMessage('Invalid medicine data. Cannot add to cart.');
            return;
        }

        setCart((current) => {
            const existing = current.find((item) => item.medicine_id === medicine.id);

            if (existing) {
                return current.map((item) =>
                    item.medicine_id === medicine.id
                        ? { ...item, qty: item.qty + 1 }
                        : item
                );
            }

            return [
                ...current,
                {
                    medicine_id: medicine.id,
                    name: medicine.name,
                    qty: 1,
                    unit_price: price,
                    gst_rate: gst,
                },
            ];
        });

        setResults([]);
        setQuery('');
    }

    function addManualItem() {
        const price = Number(manualPrice);
        const gst = Number(manualGst);

        if (!manualName.trim() || price <= 0) {
            setMessage('Enter manual item name and valid price.');
            return;
        }

        setCart((current) => [
            ...current,
            {
                medicine_id: `manual-${Date.now()}`,
                name: manualName.trim(),
                qty: 1,
                unit_price: price,
                gst_rate: gst,
            },
        ]);

        setManualName('');
        setManualPrice('');
        setManualGst('12');
        setManualOpen(false);
        setMessage('Manual item added to cart. Note: checkout requires real medicine IDs.');
    }

    function updateQty(medicineId: string, delta: number) {
        setCart((current) =>
            current.map((item) =>
                item.medicine_id === medicineId
                    ? { ...item, qty: Math.max(1, item.qty + delta) }
                    : item
            )
        );
    }

    function removeItem(medicineId: string) {
        setCart((current) => current.filter((item) => item.medicine_id !== medicineId));
    }
    async function waitForPdf(createdBillId: string) {
        if (!token) return;

        setPdfStatus('waiting');
        setPdfError(null);

        setPdfUrl((oldUrl) => {
            if (oldUrl) {
                URL.revokeObjectURL(oldUrl);
            }

            return null;
        });

        const startedAt = Date.now();
        const timeoutMs = 30_000;
        const intervalMs = 2_000;

        const checkPdf = async () => {
            try {
                const res = await fetch(`${API_URL}/api/bills/${createdBillId}/pdf`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/pdf',
                    },
                });

                const contentType = res.headers.get('content-type') || '';

                if (res.ok && contentType.includes('application/pdf')) {
                    const blob = await res.blob();

                    if (blob.size > 0) {
                        const objectUrl = URL.createObjectURL(blob);

                        setPdfUrl((oldUrl) => {
                            if (oldUrl) {
                                URL.revokeObjectURL(oldUrl);
                            }

                            return objectUrl;
                        });

                        setPdfStatus('ready');
                        return;
                    }
                }

                if (Date.now() - startedAt >= timeoutMs) {
                    setPdfStatus('error');
                    setPdfError('PDF was not ready within 30 seconds. Please try again.');
                    return;
                }

                window.setTimeout(checkPdf, intervalMs);
            } catch {
                if (Date.now() - startedAt >= timeoutMs) {
                    setPdfStatus('error');
                    setPdfError('PDF generation timed out. Please try again.');
                    return;
                }

                window.setTimeout(checkPdf, intervalMs);
            }
        };

        checkPdf();
    }
    async function checkout() {
        if (cart.length === 0) {
            setMessage('Cart is empty.');
            return;
        }

        const hasManualItems = cart.some((item) =>
            item.medicine_id.startsWith('manual-')
        );

        if (hasManualItems) {
            setMessage('Manual items need to be saved as medicines before checkout.');
            return;
        }

        try {
            setCheckingOut(true);
            setMessage('');

            const clientLocalId =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `web-${Date.now()}`;

            const data: BillResponse = await apiFetch('/api/bills', {
                method: 'POST',
                body: JSON.stringify({
                    client_local_id: clientLocalId,
                    discount,
                    items: cart.map((item) => ({
                        medicine_id: item.medicine_id,
                        qty: item.qty,
                        unit_price: item.unit_price,
                        gst_rate: item.gst_rate,
                    })),
                }),
            });

            const createdBill = data?.bill ?? data;
            const createdBillId = createdBill?.id ?? null;

            setBillId(createdBillId);
            setBillNo(createdBill?.bill_no ?? null);
            setCart([]);
            setDiscount(0);
            setMessage('Checkout successful.');
            if (createdBillId) {
                waitForPdf(createdBillId);
            }
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Checkout failed');
        } finally {
            setCheckingOut(false);
        }
    }

    if (checking) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-100">
                <p className="text-sm font-bold text-slate-600">Checking access...</p>
            </main>
        );
    }

    if (!token) {
        return (
            <main className="min-h-screen bg-slate-100 p-6">
                <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
                    <h1 className="text-2xl font-bold text-slate-900">Billing / POS</h1>
                    <p className="mt-3 rounded-xl bg-red-50 p-4 text-red-700">
                        Login token not found. Please login first, then open billing.
                    </p>
                </div>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 p-6">
                <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
                    <h1 className="text-2xl font-bold text-slate-900">Billing / POS</h1>
                    <p className="mt-3 rounded-xl bg-red-50 p-4 text-red-700">
                        Access denied. Only owner and cashier can use billing.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100">
            <section className="bg-slate-950 px-6 py-6 text-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-medium text-emerald-300">PharmaBook Web</p>
                        <h1 className="text-3xl font-bold">Billing / POS</h1>
                        <p className="text-sm text-slate-300">
                            Search medicines, scan barcode, manage cart, and checkout.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <a
                            href="/"
                            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-100"
                        >
                            Back to Dashboard
                        </a>

                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-6">
                    <div className="rounded-2xl bg-white p-5 shadow">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Search medicine
                        </h2>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <input
                                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                placeholder="Search by medicine name"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') searchMedicines();
                                }}
                            />
                            <button
                                onClick={searchMedicines}
                                disabled={loadingSearch}
                                className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {loadingSearch ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        {results.length > 0 && (
                            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                                {results.map((medicine) => (
                                    <button
                                        key={medicine.id}
                                        onClick={() => addMedicineToCart(medicine)}
                                        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-900">{medicine.name}</p>
                                            <p className="text-sm text-slate-500">
                                                GST {Number(medicine.gst_rate)}%
                                                {medicine.barcode ? ` • ${medicine.barcode}` : ''}
                                            </p>
                                        </div>
                                        <p className="font-bold text-slate-900">
                                            {money(Number(medicine.mrp ?? 0))}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow">
                        <h2 className="text-xl font-semibold text-slate-900">Barcode input</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Scan barcode or type barcode and press Enter.
                        </p>

                        <input
                            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                            placeholder="Barcode"
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') resolveBarcode();
                            }}
                        />

                        <button
                            onClick={resolveBarcode}
                            className="mt-3 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
                        >
                            Resolve barcode
                        </button>
                    </div>

                    {manualOpen && (
                        <div className="rounded-2xl bg-white p-5 shadow">
                            <h2 className="text-xl font-semibold text-slate-900">Manual entry</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Use this when barcode is not found. Checkout requires saved medicine IDs.
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <input
                                    className="rounded-xl border border-slate-300 px-4 py-3"
                                    placeholder="Medicine name"
                                    value={manualName}
                                    onChange={(e) => setManualName(e.target.value)}
                                />
                                <input
                                    className="rounded-xl border border-slate-300 px-4 py-3"
                                    placeholder="MRP"
                                    type="number"
                                    value={manualPrice}
                                    onChange={(e) => setManualPrice(e.target.value)}
                                />
                                <select
                                    className="rounded-xl border border-slate-300 px-4 py-3"
                                    value={manualGst}
                                    onChange={(e) => setManualGst(e.target.value)}
                                >
                                    <option value="0">GST 0%</option>
                                    <option value="5">GST 5%</option>
                                    <option value="12">GST 12%</option>
                                    <option value="18">GST 18%</option>
                                </select>
                            </div>

                            <button
                                onClick={addManualItem}
                                className="mt-3 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
                            >
                                Add manual item
                            </button>
                        </div>
                    )}

                    {message && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                            {message}
                        </div>
                    )}

                    {billId && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="font-semibold">Bill created successfully.</p>
                                    <p className="mt-1 text-sm">Bill number: {billNo ?? billId}</p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    {pdfUrl && (
                                        <a
                                            href={pdfUrl}
                                            download={`bill-${billNo ?? billId}.pdf`}
                                            className="rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-emerald-700"
                                        >
                                            Download PDF
                                        </a>
                                    )}

                                    {pdfUrl && (
                                        <button
                                            type="button"
                                            onClick={() => window.print()}
                                            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                                        >
                                            Print
                                        </button>
                                    )}
                                </div>
                            </div>

                            {pdfStatus === 'waiting' && (
                                <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 text-sm text-emerald-800">
                                    Generating PDF preview... checking every 2 seconds.
                                </div>
                            )}

                            {pdfStatus === 'error' && (
                                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                    {pdfError || 'PDF preview failed.'}
                                </div>
                            )}

                            {pdfUrl && (
                                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                                        <p className="text-sm font-bold text-slate-900">PDF Preview</p>

                                        <a
                                            href={pdfUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-bold text-emerald-700 hover:text-emerald-800"
                                        >
                                            Open in new tab
                                        </a>
                                    </div>
                                    <iframe
                                        src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                                        title="Bill PDF Preview"
                                        className="h-[520px] w-full bg-white"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <aside className="rounded-2xl bg-white p-5 shadow">
                    <h2 className="text-xl font-semibold text-slate-900">Cart</h2>

                    {cart.length === 0 ? (
                        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-500">
                            Cart is empty.
                        </p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {cart.map((item) => (
                                <div
                                    key={item.medicine_id}
                                    className="rounded-xl border border-slate-200 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900">{item.name}</p>
                                            <p className="text-sm text-slate-500">
                                                {money(item.unit_price)} • GST {item.gst_rate}%
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeItem(item.medicine_id)}
                                            className="text-sm font-semibold text-red-600"
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQty(item.medicine_id, -1)}
                                                className="h-9 w-9 rounded-lg bg-slate-100 font-bold"
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-semibold">
                                                {item.qty}
                                            </span>
                                            <button
                                                onClick={() => updateQty(item.medicine_id, 1)}
                                                className="h-9 w-9 rounded-lg bg-slate-100 font-bold"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <p className="font-bold">
                                            {money(item.unit_price * item.qty)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
                        <div className="flex justify-between text-slate-600">
                            <span>Subtotal</span>
                            <span>{money(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>CGST</span>
                            <span>{money(cgst)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>SGST</span>
                            <span>{money(sgst)}</span>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-600">
                                Discount
                            </label>
                            <input
                                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                                type="number"
                                min="0"
                                value={discount}
                                onChange={(e) => setDiscount(Number(e.target.value))}
                            />
                        </div>

                        <div className="flex justify-between text-xl font-bold text-slate-900">
                            <span>Total</span>
                            <span>{money(total)}</span>
                        </div>

                        <button
                            onClick={checkout}
                            disabled={checkingOut || cart.length === 0}
                            className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {checkingOut ? 'Checking out...' : 'Checkout'}
                        </button>
                    </div>
                </aside>
            </section>

        </main>
    );
}