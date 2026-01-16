CREATE TABLE public.load_conflicts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  inventory_type text NOT NULL,
  load_number text NOT NULL,
  serial text NOT NULL,
  conflicting_load text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  notes text,
  detected_at timestamp with time zone DEFAULT now(),
  CONSTRAINT load_conflicts_pkey PRIMARY KEY (id),
  CONSTRAINT load_conflicts_unique UNIQUE (location_id, load_number, serial),
  CONSTRAINT load_conflicts_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT load_conflicts_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
