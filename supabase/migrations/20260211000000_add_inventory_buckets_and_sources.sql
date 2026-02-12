-- Add source inventory table and canonical bucket/state fields

CREATE TABLE IF NOT EXISTS public.ge_inventory_source_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  source_type text NOT NULL,
  inventory_bucket text,
  inventory_state text,
  serial text NOT NULL,
  model text,
  qty integer,
  cso text,
  sub_inventory text,
  ge_ordc text,
  ge_availability_status text,
  ge_availability_message text,
  ge_inv_qty integer,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ge_inventory_source_items_pkey PRIMARY KEY (id),
  CONSTRAINT ge_inventory_source_items_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT ge_inventory_source_items_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ge_inventory_source_items_unique
  ON public.ge_inventory_source_items (company_id, location_id, source_type, serial);

CREATE INDEX IF NOT EXISTS ge_inventory_source_items_bucket_idx
  ON public.ge_inventory_source_items (company_id, location_id, inventory_bucket);

CREATE INDEX IF NOT EXISTS ge_inventory_source_items_state_idx
  ON public.ge_inventory_source_items (company_id, location_id, inventory_state);

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS inventory_bucket text,
  ADD COLUMN IF NOT EXISTS inventory_state text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_source_id_fkey
  FOREIGN KEY (source_id) REFERENCES public.ge_inventory_source_items(id);

CREATE INDEX IF NOT EXISTS inventory_items_bucket_idx
  ON public.inventory_items (company_id, location_id, inventory_bucket);

CREATE INDEX IF NOT EXISTS inventory_items_state_idx
  ON public.inventory_items (company_id, location_id, inventory_state);

ALTER TABLE public.ge_changes
  ADD COLUMN IF NOT EXISTS inventory_bucket text,
  ADD COLUMN IF NOT EXISTS inventory_state text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;
