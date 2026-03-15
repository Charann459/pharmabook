-- Migration: 005_create_bills

CREATE TABLE IF NOT EXISTS bills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_no         INTEGER NOT NULL,
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  cashier_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subtotal        NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  gst_amount      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  discount        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total           NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  pdf_path        TEXT,
  client_local_id VARCHAR(64),
  voided_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (shop_id, bill_no),
  UNIQUE (shop_id, client_local_id)
);

CREATE INDEX IF NOT EXISTS idx_bills_shop_id    ON bills (shop_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_cashier    ON bills (cashier_id);
CREATE INDEX IF NOT EXISTS idx_bills_voided     ON bills (voided_at) WHERE voided_at IS NULL;

DROP TRIGGER IF EXISTS bills_updated_at ON bills;
CREATE TRIGGER bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();