-- Migration: 003_create_medicines

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS medicines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode     VARCHAR(64) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  mrp         NUMERIC(10, 2) NOT NULL CHECK (mrp >= 0),
  gst_rate    NUMERIC(5, 2) NOT NULL CHECK (gst_rate IN (0, 5, 12, 18)),
  category    VARCHAR(100) NOT NULL DEFAULT 'General',
  global      BOOLEAN NOT NULL DEFAULT false,
  shop_id     UUID REFERENCES shops(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT medicines_shop_scope_check
    CHECK (
      (global = true  AND shop_id IS NULL) OR
      (global = false AND shop_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_medicines_barcode   ON medicines (barcode);
CREATE INDEX IF NOT EXISTS idx_medicines_shop_id   ON medicines (shop_id);
CREATE INDEX IF NOT EXISTS idx_medicines_global    ON medicines (global) WHERE global = true;
CREATE INDEX IF NOT EXISTS idx_medicines_name_trgm ON medicines USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medicines_deleted   ON medicines (deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS medicines_updated_at ON medicines;
CREATE TRIGGER medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();