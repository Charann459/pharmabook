ALTER TABLE medicines
ADD CONSTRAINT medicines_barcode_unique UNIQUE (barcode);