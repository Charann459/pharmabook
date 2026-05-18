'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../lib/api';
import Link from 'next/link';

type DailyReport = {
  date?: string;
  revenue?: number;
  total_revenue?: number;
  totalRevenue?: number;
  bills_today?: number;
  billsToday?: number;
  bills_count?: number;
  total_bills?: number;
  hourly?: Array<{
    hour?: number | string;
    revenue?: number;
    total?: number;
    amount?: number;
    sales?: number;
    bills?: number;
    count?: number;
  }>;
};

type InventoryItem = {
  id?: string;
  name?: string;
  medicine_name?: string;
  qty?: number;
  expiry_date?: string;
};

type DashboardState = {
  daily: DailyReport | null;
  lowStock: InventoryItem[];
  expiring: InventoryItem[];
};

const TOKEN_KEY = 'pharmabook_token';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const getNumber = (...values: unknown[]) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
};

const normaliseArray = (data: unknown): InventoryItem[] => {
  if (Array.isArray(data)) return data as InventoryItem[];

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    if (Array.isArray(obj.items)) return obj.items as InventoryItem[];
    if (Array.isArray(obj.data)) return obj.data as InventoryItem[];
    if (Array.isArray(obj.rows)) return obj.rows as InventoryItem[];
    if (Array.isArray(obj.inventory)) return obj.inventory as InventoryItem[];
  }

  return [];
};

const normaliseHourly = (hourly?: DailyReport['hourly']) => {
  const source = Array.isArray(hourly) ? hourly : [];

  return Array.from({ length: 24 }, (_, hour) => {
    const found = source.find((item) => Number(item.hour) === hour);
    const revenue = found
      ? getNumber(found.revenue, found.total, found.amount, found.sales)
      : 0;

    const bills = found
      ? getNumber(found.bills, found.count)
      : 0;

    return { hour, revenue, bills };
  });
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-5 h-8 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-3 w-36 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function HourlySalesChart({
  hourly,
}: {
  hourly: Array<{ hour: number; revenue: number; bills: number }>;
}) {
  const maxRevenue = Math.max(...hourly.map((item) => item.revenue), 1);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Hourly sales</h2>
          <p className="text-sm text-slate-500">Revenue distribution for today</p>
        </div>
        <p className="text-sm font-medium text-emerald-700">
          Auto-refreshes every 60s
        </p>
      </div>

      <div className="flex h-72 items-end gap-2 overflow-x-auto border-b border-slate-200 pb-3">
        {hourly.map((item) => {
          const height = Math.max(
            (item.revenue / maxRevenue) * 100,
            item.revenue > 0 ? 8 : 2
          );

          return (
            <div
              key={item.hour}
              className="flex min-w-8 flex-1 flex-col items-center justify-end gap-2"
            >
              <div className="group relative flex h-56 w-full items-end justify-center">
                <div
                  className="w-full rounded-t-xl bg-emerald-500 transition hover:bg-emerald-600"
                  style={{ height: `${height}%` }}
                />
                <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-lg bg-slate-950 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                  <div>{String(item.hour).padStart(2, '0')}:00</div>
                  <div>{formatCurrency(item.revenue)}</div>
                  <div>{item.bills} bills</div>
                </div>
              </div>
              <span className="text-[11px] text-slate-500">{item.hour}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState<DashboardState>({
    daily: null,
    lowStock: [],
    expiring: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchJson = useCallback(async (path: string, token: string) => {
    const res = await fetch(`${API_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Request failed: ${res.status}`);
    }

    return res.json();
  }, []);

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setError('Login token not found. Please login first, then open dashboard.');
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const [daily, lowStockResponse, expiringResponse] = await Promise.all([
        fetchJson('/api/reports/daily', token),
        fetchJson('/api/inventory/low-stock', token),
        fetchJson('/api/inventory/expiring', token),
      ]);

      setData({
        daily,
        lowStock: normaliseArray(lowStockResponse),
        expiring: normaliseArray(expiringResponse),
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadDashboard();

    const interval = window.setInterval(() => {
      loadDashboard();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const revenue = getNumber(
    data.daily?.revenue,
    data.daily?.total_revenue,
    data.daily?.totalRevenue
  );

  const billsToday = getNumber(
    data.daily?.bills_today,
    data.daily?.billsToday,
    data.daily?.bills_count,
    data.daily?.total_bills
  );

  const hourly = useMemo(() => normaliseHourly(data.daily?.hourly), [data.daily]);

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="bg-slate-950 px-6 py-6 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
              PharmaBook
            </p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">
              Live sales, stock alerts, and expiry overview
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/billing"
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-100"
            >
              Open Billing / POS
            </a>

            <Link
              href="/inventory"
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-100"
            >
              Open Inventory
            </Link>

            <button
              onClick={loadDashboard}
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-bold text-red-800">
              Unable to load dashboard
            </h2>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              onClick={loadDashboard}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                title="Today's revenue"
                value={formatCurrency(revenue)}
                subtitle="From daily sales report"
              />
              <StatCard
                title="Bills today"
                value={String(billsToday)}
                subtitle="Total bills generated today"
              />
              <StatCard
                title="Low stock items"
                value={String(data.lowStock.length)}
                subtitle="Items below threshold"
              />
              <StatCard
                title="Expiring within 30 days"
                value={String(data.expiring.length)}
                subtitle="Batches requiring attention"
              />
            </>
          )}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" />
          ) : (
            <HourlySalesChart hourly={hourly} />
          )}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-950">Low stock preview</h2>
            <div className="mt-4 space-y-3">
              {data.lowStock.slice(0, 5).map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <span className="font-medium text-slate-800">
                    {item.name || item.medicine_name || 'Medicine'}
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                    Qty {item.qty ?? 0}
                  </span>
                </div>
              ))}

              {!loading && data.lowStock.length === 0 ? (
                <p className="text-sm text-slate-500">No low stock items found.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-950">
              Expiring soon preview
            </h2>
            <div className="mt-4 space-y-3">
              {data.expiring.slice(0, 5).map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <span className="font-medium text-slate-800">
                    {item.name || item.medicine_name || 'Medicine'}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                    {item.expiry_date
                      ? new Date(item.expiry_date).toLocaleDateString()
                      : 'Soon'}
                  </span>
                </div>
              ))}

              {!loading && data.expiring.length === 0 ? (
                <p className="text-sm text-slate-500">No expiring items found.</p>
              ) : null}
            </div>
          </div>
        </div>

        {lastUpdated ? (
          <p className="mt-6 text-center text-sm text-slate-500">
            Last updated at {lastUpdated}
          </p>
        ) : null}
      </section>
    </main>
  );
}