-- Migration: 006_create_bill_items

CREATE TABLE IF NOT EXISTS bill_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id      UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  medicine_id  UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  qty          INTEGER NOT NULL CHECK (qty > 0),
  unit_price   NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  gst_rate     NUMERIC(5, 2)  NOT NULL CHECK (gst_rate IN (0, 5, 12, 18)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id     ON bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_medicine_id ON bill_items (medicine_id);