-- Migration: 007_create_sync_log

CREATE TABLE IF NOT EXISTS sync_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  device_id    VARCHAR(128),
  pulled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pushed_at    TIMESTAMPTZ,
  records_sent INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user   ON sync_log (user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_shop   ON sync_log (shop_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_pulled ON sync_log (user_id, pulled_at DESC);