-- Add unique constraint for ge-sync upsert operations
-- This allows ON CONFLICT (company_id, location_id, serial) to work

-- First, check if there are any duplicate serials that would violate the constraint
-- Run this query first to see if there are duplicates:
-- SELECT company_id, location_id, serial, COUNT(*)
-- FROM inventory_items
-- GROUP BY company_id, location_id, serial
-- HAVING COUNT(*) > 1;

-- If duplicates exist, you'll need to resolve them first before adding the constraint.
-- For now, let's add the constraint (it will fail if duplicates exist):

ALTER TABLE inventory_items
ADD CONSTRAINT inventory_items_company_location_serial_key
UNIQUE (company_id, location_id, serial);

-- Verify the constraint was added:
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'inventory_items'::regclass
AND conname = 'inventory_items_company_location_serial_key';
