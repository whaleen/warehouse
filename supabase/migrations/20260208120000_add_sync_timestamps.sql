-- Add last sync timestamp columns to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS last_sync_asis_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_fg_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_sta_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_inbound_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_backhaul_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_inventory_at timestamp with time zone;

COMMENT ON COLUMN public.settings.last_sync_asis_at IS 'Last successful ASIS inventory sync timestamp';
COMMENT ON COLUMN public.settings.last_sync_fg_at IS 'Last successful FG inventory sync timestamp';
COMMENT ON COLUMN public.settings.last_sync_sta_at IS 'Last successful STA inventory sync timestamp';
COMMENT ON COLUMN public.settings.last_sync_inbound_at IS 'Last successful inbound receipts sync timestamp';
COMMENT ON COLUMN public.settings.last_sync_backhaul_at IS 'Last successful backhaul orders sync timestamp';
COMMENT ON COLUMN public.settings.last_sync_inventory_at IS 'Last successful unified inventory sync timestamp';
