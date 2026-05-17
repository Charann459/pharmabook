DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'medicines_barcode_unique'
      AND conrelid = 'medicines'::regclass
  ) THEN
    ALTER TABLE medicines
    ADD CONSTRAINT medicines_barcode_unique UNIQUE (barcode);
  END IF;
END $$;