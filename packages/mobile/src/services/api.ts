import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;
const TOKEN_KEY = 'pharmabook_token';

// ── Token storage ──────────────────────────────────────────────────

export const saveToken = (token: string) =>
  SecureStore.setItemAsync(TOKEN_KEY, token);

export const getToken = () =>
  SecureStore.getItemAsync(TOKEN_KEY);

export const deleteToken = () =>
  SecureStore.deleteItemAsync(TOKEN_KEY);

// ── Core fetch wrapper ─────────────────────────────────────────────

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  auth?: boolean; // default true — attach JWT
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Parse JSON even on error responses
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      (data as any)?.error || `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

// ── Auth ────────────────────────────────────────────────────────────

export type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'cashier' | 'inv_manager';
    shop_id: string;
  };
};

export type MeResponse = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'cashier' | 'inv_manager';
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

  logout: () => request<{ message: string }>('/api/auth/logout', { method: 'POST' }),
};

// ── Medicines ───────────────────────────────────────────────────────

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
    request<Medicine>(`/api/medicines/resolve/${barcode}`),

  search: (q: string) =>
    request<Medicine[]>(`/api/medicines/search?q=${encodeURIComponent(q)}`),

  list: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<Medicine[]>(`/api/medicines${qs ? `?${qs}` : ''}`);
  },

  create: (data: Partial<Medicine>) =>
    request<Medicine>('/api/medicines', { method: 'POST', body: data }),
};

// ── Inventory ───────────────────────────────────────────────────────

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
};

export const inventoryApi = {
  list: (params?: { low_stock?: boolean; expiring_days?: number }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<InventoryItem[]>(`/api/inventory${qs ? `?${qs}` : ''}`);
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
  }) => request<InventoryItem>('/api/inventory', { method: 'POST', body: data }),
};

// ── Bills ───────────────────────────────────────────────────────────

export type BillItem = {
  medicine_id: string;
  qty: number;
  unit_price: number;
  gst_rate: number;
};

export type Bill = {
  id: string;
  bill_no: number;
  subtotal: number;
  gst_amount: number;
  discount: number;
  total: number;
  created_at: string;
};

export const billsApi = {
  create: (data: {
    items: BillItem[];
    discount?: number;
    client_local_id?: string;
  }) => request<Bill>('/api/bills', { method: 'POST', body: data }),

  list: (date?: string) =>
    request<Bill[]>(`/api/bills${date ? `?date=${date}` : ''}`),

  getById: (id: string) =>
    request<Bill & { items: BillItem[] }>(`/api/bills/${id}`),
};

// ── Reports ─────────────────────────────────────────────────────────

export const reportsApi = {
  daily: (date?: string) =>
    request<any>(`/api/reports/daily${date ? `?date=${date}` : ''}`),

  topMedicines: (period: 'today' | 'week' | 'month' = 'today') =>
    request<any>(`/api/reports/top-medicines?period=${period}`),
};
