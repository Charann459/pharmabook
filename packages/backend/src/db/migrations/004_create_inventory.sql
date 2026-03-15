-- Migration: 004_create_inventory

CREATE TABLE IF NOT EXISTS inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id         UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  qty                 INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  batch_no            VARCHAR(100) NOT NULL,
  expiry_date         DATE NOT NULL,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_shop_id     ON inventory (shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine_id ON inventory (medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry      ON inventory (expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock   ON inventory (shop_id, qty, low_stock_threshold)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();