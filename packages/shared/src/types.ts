// Shared TypeScript types across backend, mobile, and web.
// Backend uses JS but these types serve as the canonical data contracts.

export type UserRole = 'owner' | 'cashier' | 'inv_manager';
export type GstRate  = 0 | 5 | 12 | 18;

export interface Shop {
  id:         string;
  name:       string;
  address:    string | null;
  phone:      string | null;
  gst_no:     string | null;
  active:     boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id:         string;
  shop_id:    string;
  name:       string;
  email:      string;
  role:       UserRole;
  active:     boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthPayload {
  token: string;
  user:  Pick<User, 'id' | 'name' | 'email' | 'role' | 'shop_id'>;
}

export interface Medicine {
  id:         string;
  barcode:    string;
  name:       string;
  mrp:        number;
  gst_rate:   GstRate;
  category:   string;
  global:     boolean;
  shop_id:    string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id:                  string;
  medicine_id:         string;
  shop_id:             string;
  qty:                 number;
  batch_no:            string;
  expiry_date:         string;   // ISO date string YYYY-MM-DD
  low_stock_threshold: number;
  updated_by:          string | null;
  deleted_at:          string | null;
  created_at:          string;
  updated_at:          string;
  // Joined fields (from API responses)
  name?:               string;
  barcode?:            string;
  category?:           string;
  mrp?:                number;
}

export interface BillItem {
  id:          string;
  bill_id:     string;
  medicine_id: string;
  qty:         number;
  unit_price:  number;
  gst_rate:    GstRate;
  created_at:  string;
  // Joined
  name?:       string;
  barcode?:    string;
}

export interface Bill {
  id:              string;
  bill_no:         number;
  shop_id:         string;
  cashier_id:      string;
  subtotal:        number;
  gst_amount:      number;
  discount:        number;
  total:           number;
  pdf_path:        string | null;
  client_local_id: string | null;
  voided_at:       string | null;
  created_at:      string;
  updated_at:      string;
  // Joined
  items?:          BillItem[];
}

// ── Report shapes ──────────────────────────────────────────────────

export interface DailyReportSummary {
  bill_count:     number;
  revenue:        number;
  gst_collected:  number;
  total_discount: number;
  avg_bill_value: number;
}

export interface HourlyBreakdown {
  hour:    number;
  bills:   number;
  revenue: number;
}

export interface DailyReport {
  date:    string;
  summary: DailyReportSummary;
  hourly:  HourlyBreakdown[];
}

export interface GstBreakupRow {
  gst_rate:      number;
  taxable_value: number;
  gst_amount:    number;
  bill_count:    number;
}

// ── WebSocket message types ────────────────────────────────────────

export type WsMessageType =
  | 'CONNECTED'
  | 'PONG'
  | 'ERROR'
  | 'BARCODE_RESULT'
  | 'BARCODE_NOT_FOUND'
  | 'STOCK_UPDATE'
  | 'LOW_STOCK'
  | 'EXPIRY_WARNING'
  | 'PDF_READY'
  | 'SYNC_DELTA';

export interface WsMessage<T = unknown> {
  type:    WsMessageType;
  payload: T;
  ts:      string;
}

export interface StockUpdatePayload {
  medicine_id:   string;
  medicine_name: string;
  qty_added:     number;
  new_total:     number;
  batch_no:      string;
  expiry_date:   string;
  updated_by:    string;
}

export interface LowStockPayload {
  medicine_id:   string;
  medicine_name: string;
  qty:           number;
  threshold:     number;
}

export interface ExpiryWarningPayload {
  count:     number;
  medicines: Array<{ name: string; qty: number; expiry_date: string; batch_no: string }>;
  warn_days: number;
}

export interface PdfReadyPayload {
  bill_id: string;
  pdf_url: string;
}

export interface BarcodeResultPayload {
  barcode:  string;
  medicine: Medicine;
}

export interface SyncDeltaPayload {
  changes:   Record<string, unknown>;
  timestamp: number;
}

// ── Sync protocol ──────────────────────────────────────────────────

export interface SyncChangeSet<T> {
  created: T[];
  updated: T[];
  deleted: string[];
}

export interface SyncPushBody {
  changes: {
    medicines:  SyncChangeSet<Partial<Medicine>>;
    inventory:  SyncChangeSet<Partial<InventoryItem>>;
    bills:      SyncChangeSet<Partial<Bill>>;
    bill_items: SyncChangeSet<Partial<BillItem>>;
  };
  last_pulled_at: number | null;
}

export interface SyncPullResponse {
  changes:   SyncPushBody['changes'];
  timestamp: number;
}
