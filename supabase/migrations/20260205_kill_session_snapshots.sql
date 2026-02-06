-- SCORCHED EARTH: Remove all session snapshot bullshit
-- This migration removes the broken JSONB snapshot system

-- 1. Drop the items JSONB column (no longer needed)
ALTER TABLE scanning_sessions
DROP COLUMN IF EXISTS items;

-- 2. owning_session_id is already NULLed, but let's remove the FK constraint
ALTER TABLE inventory_items
DROP CONSTRAINT IF EXISTS inventory_items_owning_session_fk;

ALTER TABLE inventory_items
DROP CONSTRAINT IF EXISTS inventory_items_owning_session_id_fkey;

-- 3. Drop the owning_session_id column entirely (we don't need permanent ownership)
ALTER TABLE inventory_items
DROP COLUMN IF EXISTS owning_session_id;

-- 4. Add comment to make it clear sessions query dynamically
COMMENT ON TABLE scanning_sessions IS
'Scanning sessions track scan progress for loads/buckets. Items are queried dynamically by inventory_type + sub_inventory. NO SNAPSHOTS.';

COMMENT ON COLUMN scanning_sessions.scanned_item_ids IS
'Array of inventory_item IDs that have been scanned. Query actual inventory_items dynamically - do not store snapshots.';
