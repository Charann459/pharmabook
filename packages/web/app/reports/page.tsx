'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ReportTab = 'today' | 'week' | 'month' | 'gst';

type DailySummary = {
    bill_count: number;
    revenue: string | number;
    gst_collected?: string | number;
    total_discount?: string | number;
    avg_bill_value: string | number;
};

type ChartPoint = {
    label: string;
    revenue: number;
    bills: number;
};

type TopMedicine = {
    id: string;
    name: string;
    category?: string | null;
    units_sold: number;
    revenue: string | number;
};

type GstRow = {
    gst_rate: string | number;
    taxable_value: string | number;
    gst_amount: string | number;
    bill_count: number;
};

const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('pharmabook_token');
};

const formatCurrency = (value: string | number | undefined) => {
    const num = Number(value ?? 0);
    return `₹${num.toFixed(2)}`;
};

const formatNumber = (value: string | number | undefined) => {
    return Number(value ?? 0).toLocaleString('en-IN');
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const getWeekStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
};

const getCurrentYearMonth = () => {
    const d = new Date();

    return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
    };
};

const monthName = (month: number) => {
    return new Date(2026, month - 1, 1).toLocaleString('en-IN', {
        month: 'long',
    });
};

const toDateLabel = (value: string) => {
    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
    });
};

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<ReportTab>('today');

    const [loading, setLoading] = useState(true);
    const [topLoading, setTopLoading] = useState(true);
    const [gstLoading, setGstLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const [summary, setSummary] = useState<DailySummary>({
        bill_count: 0,
        revenue: 0,
        gst_collected: 0,
        total_discount: 0,
        avg_bill_value: 0,
    });

    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [topMedicines, setTopMedicines] = useState<TopMedicine[]>([]);
    const [gstRows, setGstRows] = useState<GstRow[]>([]);

    const [date, setDate] = useState(todayDate());
    const [weekStart, setWeekStart] = useState(getWeekStart());
    const [{ year, month }, setYearMonth] = useState(getCurrentYearMonth());

    const periodForTopMedicines = activeTab === 'week' ? 'week' : activeTab === 'month' ? 'month' : 'today';

    const maxRevenue = useMemo(() => {
        return Math.max(...chartData.map((point) => point.revenue), 1);
    }, [chartData]);

    const totals = useMemo(() => {
        if (activeTab === 'today') {
            return {
                revenue: Number(summary.revenue ?? 0),
                bills: Number(summary.bill_count ?? 0),
                avg: Number(summary.avg_bill_value ?? 0),
            };
        }

        const revenue = chartData.reduce((sum, point) => sum + Number(point.revenue ?? 0), 0);
        const bills = chartData.reduce((sum, point) => sum + Number(point.bills ?? 0), 0);

        return {
            revenue,
            bills,
            avg: bills > 0 ? revenue / bills : 0,
        };
    }, [activeTab, chartData, summary]);

    const fetchMainReport = async () => {
        const token = getToken();

        if (!token) {
            setError('Login token not found. Please login first, then open reports.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            if (activeTab === 'today') {
                const res = await fetch(`${API_URL}/api/reports/daily?date=${date}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || `Failed to load daily report. Status ${res.status}`);
                }

                const data = await res.json();

                setSummary(data.summary || {
                    bill_count: 0,
                    revenue: 0,
                    gst_collected: 0,
                    total_discount: 0,
                    avg_bill_value: 0,
                });

                const hourly = Array.isArray(data.hourly) ? data.hourly : [];

                setChartData(
                    Array.from({ length: 24 }, (_, hour) => {
                        const found = hourly.find((row: any) => Number(row.hour) === hour);

                        return {
                            label: `${hour}:00`,
                            revenue: Number(found?.revenue ?? 0),
                            bills: Number(found?.bills ?? 0),
                        };
                    })
                );
            }

            if (activeTab === 'week') {
                const res = await fetch(`${API_URL}/api/reports/weekly?week_start=${weekStart}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || `Failed to load weekly report. Status ${res.status}`);
                }

                const data = await res.json();
                const days = Array.isArray(data.days) ? data.days : [];

                setChartData(
                    days.map((row: any) => ({
                        label: toDateLabel(row.date),
                        revenue: Number(row.revenue ?? 0),
                        bills: Number(row.bill_count ?? 0),
                    }))
                );

                setSummary({
                    bill_count: 0,
                    revenue: 0,
                    avg_bill_value: 0,
                    gst_collected: 0,
                    total_discount: 0,
                });
            }

            if (activeTab === 'month') {
                const res = await fetch(`${API_URL}/api/reports/monthly?year=${year}&month=${month}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || `Failed to load monthly report. Status ${res.status}`);
                }

                const data = await res.json();
                const days = Array.isArray(data.days) ? data.days : [];

                setChartData(
                    days.map((row: any) => ({
                        label: toDateLabel(row.date),
                        revenue: Number(row.revenue ?? 0),
                        bills: Number(row.bill_count ?? 0),
                    }))
                );

                setSummary({
                    bill_count: 0,
                    revenue: 0,
                    avg_bill_value: 0,
                    gst_collected: 0,
                    total_discount: 0,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    const fetchTopMedicines = async () => {
        const token = getToken();

        if (!token) {
            setTopLoading(false);
            return;
        }

        try {
            setTopLoading(true);

            const res = await fetch(
                `${API_URL}/api/reports/top-medicines?period=${periodForTopMedicines}&limit=10`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to load top medicines');
            }

            const data = await res.json();
            setTopMedicines(Array.isArray(data.medicines) ? data.medicines : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load top medicines');
        } finally {
            setTopLoading(false);
        }
    };

    const fetchGstSummary = async () => {
        const token = getToken();

        if (!token) {
            setGstLoading(false);
            return;
        }

        try {
            setGstLoading(true);

            const res = await fetch(`${API_URL}/api/reports/gst-summary?year=${year}&month=${month}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to load GST summary');
            }

            const data = await res.json();
            setGstRows(Array.isArray(data.gst_breakup) ? data.gst_breakup : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load GST summary');
        } finally {
            setGstLoading(false);
        }
    };

    const refreshReports = async () => {
        if (activeTab === 'gst') {
            await fetchGstSummary();
            return;
        }

        await Promise.all([fetchMainReport(), fetchTopMedicines()]);
    };

    const exportGstCsv = () => {
        const headers = ['GST Rate', 'Taxable Value', 'GST Amount', 'Bill Count'];

        const rows = gstRows.map((row) => [
            `${row.gst_rate}%`,
            Number(row.taxable_value ?? 0).toFixed(2),
            Number(row.gst_amount ?? 0).toFixed(2),
            String(row.bill_count ?? 0),
        ]);

        const csv = [headers, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `gst-summary-${year}-${String(month).padStart(2, '0')}.csv`;
        a.click();

        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        refreshReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, date, weekStart, year, month]);

    return (
        <main className="min-h-screen bg-slate-100 text-slate-950">
            <header className="bg-slate-950 text-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-400 sm:tracking-[0.4em]">
                            PharmaBook Web
                        </p>

                        <h1 className="mt-3 text-2xl font-black sm:text-3xl">Reports</h1>

                        <p className="mt-2 max-w-xl text-sm text-slate-200">
                            Daily, weekly, monthly sales reports, top medicines, and GST summary.
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
                            onClick={refreshReports}
                            className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 sm:w-auto"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
                        <h2 className="font-bold">Unable to load reports</h2>
                        <p className="mt-1 text-sm">{error}</p>

                        <button
                            onClick={refreshReports}
                            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white"
                        >
                            Retry
                        </button>
                    </div>
                )}

                <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto]">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                            { key: 'today', label: 'Today' },
                            { key: 'week', label: 'This Week' },
                            { key: 'month', label: 'This Month' },
                            { key: 'gst', label: 'GST Summary' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as ReportTab)}
                                className={`rounded-xl px-3 py-3 text-xs font-black sm:text-sm ${activeTab === tab.key
                                        ? 'bg-slate-950 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                        {activeTab === 'today' && (
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 sm:col-span-1"
                            />
                        )}

                        {activeTab === 'week' && (
                            <input
                                type="date"
                                value={weekStart}
                                onChange={(e) => setWeekStart(e.target.value)}
                                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 sm:col-span-1"
                            />
                        )}

                        {(activeTab === 'month' || activeTab === 'gst') && (
                            <>
                                <select
                                    value={month}
                                    onChange={(e) =>
                                        setYearMonth((current) => ({
                                            ...current,
                                            month: Number(e.target.value),
                                        }))
                                    }
                                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                                >
                                    {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => (
                                        <option key={m} value={m}>
                                            {monthName(m)}
                                        </option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    value={year}
                                    onChange={(e) =>
                                        setYearMonth((current) => ({
                                            ...current,
                                            year: Number(e.target.value),
                                        }))
                                    }
                                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                                />
                            </>
                        )}
                    </div>
                </div>

                {activeTab !== 'gst' ? (
                    <>
                        <div className="mb-6 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-sm font-bold text-slate-500">Revenue</p>
                                <p className="mt-3 text-3xl font-black">{formatCurrency(totals.revenue)}</p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-sm font-bold text-slate-500">Bill Count</p>
                                <p className="mt-3 text-3xl font-black">{formatNumber(totals.bills)}</p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-sm font-bold text-slate-500">Avg Bill Value</p>
                                <p className="mt-3 text-3xl font-black">{formatCurrency(totals.avg)}</p>
                            </div>
                        </div>

                        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-black">Sales over time</h2>
                                    <p className="text-sm text-slate-500">
                                        {activeTab === 'today'
                                            ? 'Hourly revenue'
                                            : activeTab === 'week'
                                                ? 'Daily revenue for selected week'
                                                : 'Daily revenue for selected month'}
                                    </p>
                                </div>
                            </div>

                            {loading ? (
                                <div className="mt-6 h-72 animate-pulse rounded-2xl bg-slate-100" />
                            ) : chartData.length === 0 ? (
                                <div className="mt-6 rounded-2xl bg-slate-50 p-8 text-center text-slate-500">
                                    No sales data found for this period.
                                </div>
                            ) : (
                                <div className="mt-6 overflow-x-auto">
                                    <div className="flex h-72 min-w-[720px] items-end gap-3 border-b border-slate-200 px-2">
                                        {chartData.map((point) => {
                                            const height = Math.max((point.revenue / maxRevenue) * 220, point.revenue > 0 ? 10 : 2);

                                            return (
                                                <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                                                    <div className="flex h-[220px] w-full items-end justify-center">
                                                        <div
                                                            className="w-full rounded-t-xl bg-emerald-500"
                                                            style={{ height }}
                                                            title={`${point.label}: ${formatCurrency(point.revenue)}`}
                                                        />
                                                    </div>

                                                    <span className="text-[10px] font-bold text-slate-500">{point.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 px-5 py-4">
                                <h2 className="text-lg font-black">Top 10 selling medicines</h2>
                                <p className="text-sm text-slate-500">Units sold and revenue for selected period.</p>
                            </div>

                            {topLoading ? (
                                <div className="space-y-3 p-5">
                                    {[1, 2, 3].map((row) => (
                                        <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                                    ))}
                                </div>
                            ) : topMedicines.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">No medicine sales found.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-left text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                            <tr>
                                                <th className="px-5 py-4">Medicine</th>
                                                <th className="px-5 py-4">Category</th>
                                                <th className="px-5 py-4">Units Sold</th>
                                                <th className="px-5 py-4">Revenue</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {topMedicines.map((medicine) => (
                                                <tr key={medicine.id}>
                                                    <td className="px-5 py-4 font-bold">{medicine.name}</td>
                                                    <td className="px-5 py-4 text-slate-600">{medicine.category || '-'}</td>
                                                    <td className="px-5 py-4 font-black">{medicine.units_sold}</td>
                                                    <td className="px-5 py-4 text-slate-600">
                                                        {formatCurrency(medicine.revenue)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-black">GST Summary</h2>
                                <p className="text-sm text-slate-500">
                                    This data feeds GSTR-1 filing preparation.
                                </p>
                            </div>

                            <button
                                onClick={exportGstCsv}
                                disabled={gstRows.length === 0}
                                className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                            >
                                Export CSV
                            </button>
                        </div>

                        {gstLoading ? (
                            <div className="space-y-3 p-5">
                                {[1, 2, 3].map((row) => (
                                    <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                                ))}
                            </div>
                        ) : gstRows.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">No GST data found.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-5 py-4">GST Rate</th>
                                            <th className="px-5 py-4">Taxable Value</th>
                                            <th className="px-5 py-4">GST Amount</th>
                                            <th className="px-5 py-4">Bill Count</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                        {gstRows.map((row) => (
                                            <tr key={String(row.gst_rate)}>
                                                <td className="px-5 py-4 font-black">{row.gst_rate}%</td>
                                                <td className="px-5 py-4 text-slate-600">
                                                    {formatCurrency(row.taxable_value)}
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">
                                                    {formatCurrency(row.gst_amount)}
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">{row.bill_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}