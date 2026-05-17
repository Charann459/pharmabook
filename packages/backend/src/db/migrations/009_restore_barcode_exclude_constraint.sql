CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE medicines
DROP CONSTRAINT IF EXISTS medicines_barcode_unique;

ALTER TABLE medicines
ADD CONSTRAINT medicines_barcode_exclude_active
EXCLUDE USING gist (barcode WITH =)
WHERE (deleted_at IS NULL);