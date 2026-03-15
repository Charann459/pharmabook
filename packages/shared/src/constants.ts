// Shared constants used across backend, mobile, and web.

export const GST_RATES = [0, 5, 12, 18] as const;

export const USER_ROLES = {
  OWNER:       'owner',
  CASHIER:     'cashier',
  INV_MANAGER: 'inv_manager',
} as const;

export const WS_MESSAGE_TYPES = {
  // Server → Device
  CONNECTED:        'CONNECTED',
  PONG:             'PONG',
  ERROR:            'ERROR',
  BARCODE_RESULT:   'BARCODE_RESULT',
  BARCODE_NOT_FOUND:'BARCODE_NOT_FOUND',
  STOCK_UPDATE:     'STOCK_UPDATE',
  LOW_STOCK:        'LOW_STOCK',
  EXPIRY_WARNING:   'EXPIRY_WARNING',
  PDF_READY:        'PDF_READY',
  SYNC_DELTA:       'SYNC_DELTA',
  // Device → Server
  PING:             'PING',
  NOTIF_ACK:        'NOTIF_ACK',
} as const;

export const MEDICINE_CATEGORIES = [
  'Analgesic',
  'Antibiotic',
  'Antacid',
  'Antidiabetic',
  'Antihistamine',
  'Antihypertensive',
  'Antifungal',
  'Antiseptic',
  'Ayurvedic',
  'Cardiac',
  'Dermatology',
  'ENT',
  'Eye / Ear Drops',
  'Gastrointestinal',
  'Hormonal',
  'Neurological',
  'Nutritional / Vitamin',
  'Ophthalmic',
  'Orthopedic',
  'Paediatric',
  'Respiratory',
  'Surgical',
  'Vaccine',
  'General',
] as const;

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
export const DEFAULT_EXPIRY_WARN_DAYS    = 30;

// WatermelonDB table names — must match migration column names
export const DB_TABLES = {
  MEDICINES:  'medicines',
  INVENTORY:  'inventory',
  BILLS:      'bills',
  BILL_ITEMS: 'bill_items',
  USERS:      'users',
  SHOPS:      'shops',
} as const;

// Role permission map — what each role can access
export const ROLE_PERMISSIONS = {
  owner: {
    billing:   true,
    inventory: true,
    reports:   true,
    settings:  true,
    users:     true,
  },
  cashier: {
    billing:   true,
    inventory: false,
    reports:   false,
    settings:  false,
    users:     false,
  },
  inv_manager: {
    billing:   false,
    inventory: true,
    reports:   false,
    settings:  false,
    users:     false,
  },
} as const;
