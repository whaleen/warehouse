-- Session architecture refactor: session sources, ownership, marker indexing

ALTER TABLE public.scanning_sessions
ADD COLUMN IF NOT EXISTS session_source text NOT NULL DEFAULT 'manual'
CHECK (session_source IN ('manual', 'ge_sync', 'system'));

ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS owning_session_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_owning_session_fk'
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_owning_session_fk
      FOREIGN KEY (owning_session_id)
      REFERENCES public.scanning_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_location_recent_markers
ON public.product_location_history(inventory_item_id, scanning_session_id, created_at DESC);

UPDATE public.scanning_sessions
SET session_source = 'system'
WHERE created_by = 'system' AND session_source = 'manual';
