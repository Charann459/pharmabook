import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'pharmabook_token';

// Token storage
export const saveToken = async (token: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
};

export const deleteToken = async () => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

// Core fetch wrapper
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error?: unknown }).error)
        : `Request failed with status ${res.status}`;

    throw new ApiError(res.status, message);
  }

  return data as T;
}

// Auth
export type UserRole = 'owner' | 'cashier' | 'inv_manager' | 'inventory_manager';

export type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    shop_id: string;
  };
};

export type MeResponse = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  shop_id: string;
  shop_name: string;
  gst_no: string | null;
};

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  me: () => request<MeResponse>('/api/auth/me'),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    }),
};

// Medicines
export type Medicine = {
  id: string;
  barcode: string;
  name: string;
  mrp: number;
  gst_rate: number;
  category: string;
  global: boolean;
  shop_id: string | null;
};

export const medicinesApi = {
  resolve: (barcode: string) =>
    request<Medicine>(`/api/medicines/resolve/${encodeURIComponent(barcode)}`),

  search: (q: string) =>
    request<Medicine[]>(`/api/medicines/search?q=${encodeURIComponent(q)}`),

  list: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();

    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);

    const queryString = qs.toString();

    return request<Medicine[]>(`/api/medicines${queryString ? `?${queryString}` : ''}`);
  },

  create: (data: Partial<Medicine>) =>
    request<Medicine>('/api/medicines', {
      method: 'POST',
      body: data,
    }),
};

// Inventory
export type InventoryItem = {
  id: string;
  medicine_id: string;
  shop_id: string;
  qty: number;
  batch_no: string;
  expiry_date: string;
  low_stock_threshold: number;
  name: string;
  barcode: string;
  category: string;
  mrp: number;
  gst_rate?: number;
};

export const inventoryApi = {
  list: (params?: { low_stock?: boolean; expiring_days?: number }) => {
    const qs = new URLSearchParams();

    if (typeof params?.low_stock === 'boolean') {
      qs.set('low_stock', String(params.low_stock));
    }

    if (typeof params?.expiring_days === 'number') {
      qs.set('expiring_days', String(params.expiring_days));
    }

    const queryString = qs.toString();

    return request<InventoryItem[]>(`/api/inventory${queryString ? `?${queryString}` : ''}`);
  },

  lowStock: () => request<InventoryItem[]>('/api/inventory/low-stock'),

  expiring: (days = 30) =>
    request<InventoryItem[]>(`/api/inventory/expiring?days=${days}`),

  addStock: (data: {
    medicine_id: string;
    qty: number;
    batch_no: string;
    expiry_date: string;
    low_stock_threshold?: number;
  }) =>
    request<InventoryItem>('/api/inventory', {
      method: 'POST',
      body: data,
    }),
};

// Bills
export type BillItemInput = {
  medicine_id: string;
  qty: number;
  unit_price: number;
  gst_rate: number;
};

export type BillItem = {
  id?: string;
  bill_id?: string;
  medicine_id: string;
  qty: number;
  unit_price: number;
  gst_rate: number;
  medicine_name?: string;
  barcode?: string;
};

export type Bill = {
  id: string;
  bill_no: number;
  shop_id?: string;
  cashier_id?: string;
  subtotal: number;
  gst_amount: number;
  discount: number;
  total: number;
  pdf_path?: string | null;
  voided_at?: string | null;
  created_at: string;
};

export const billsApi = {
  create: (data: {
    items: BillItemInput[];
    discount?: number;
    client_local_id?: string;
  }) =>
    request<Bill>('/api/bills', {
      method: 'POST',
      body: data,
    }),

  list: (date?: string) =>
    request<Bill[]>(`/api/bills${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getById: (id: string) =>
    request<Bill & { items: BillItem[] }>(`/api/bills/${id}`),

  getPdf: (id: string) =>
    request<{ ready: boolean; url?: string; message?: string }>(`/api/bills/${id}/pdf`),
};

// Reports
export type DailyReport = {
  date: string;
  summary: {
    bill_count: number;
    revenue: number | string;
    gst_collected?: number | string;
    total_discount?: number | string;
    avg_bill_value?: number | string;
  };
  hourly: Array<{
    hour: number;
    bills: number;
    revenue: number | string;
  }>;
};

export type TopMedicineReport = {
  period: string;
  medicines: Array<{
    id: string;
    name: string;
    category: string;
    units_sold: number;
    revenue: number | string;
  }>;
};

export const reportsApi = {
  daily: (date?: string) =>
    request<DailyReport>(`/api/reports/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  weekly: (weekStart?: string) =>
    request<any>(
      `/api/reports/weekly${weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : ''}`
    ),

  monthly: (year?: number, month?: number) => {
    const qs = new URLSearchParams();

    if (year) qs.set('year', String(year));
    if (month) qs.set('month', String(month));

    const queryString = qs.toString();

    return request<any>(`/api/reports/monthly${queryString ? `?${queryString}` : ''}`);
  },

  topMedicines: (period: 'today' | 'week' | 'month' = 'today', limit = 10) =>
    request<TopMedicineReport>(
      `/api/reports/top-medicines?period=${period}&limit=${limit}`
    ),

  gstSummary: (year?: number, month?: number) => {
    const qs = new URLSearchParams();

    if (year) qs.set('year', String(year));
    if (month) qs.set('month', String(month));

    const queryString = qs.toString();

    return request<any>(`/api/reports/gst-summary${queryString ? `?${queryString}` : ''}`);
  },
};