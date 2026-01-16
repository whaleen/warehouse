-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true,
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_company_slug_key UNIQUE (company_id, slug),
  CONSTRAINT locations_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.settings (
  location_id uuid NOT NULL,
  company_id uuid NOT NULL,
  sso_username text,
  sso_password text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (location_id),
  CONSTRAINT settings_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT settings_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  customer_name text NOT NULL,
  address text,
  phone text,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT customers_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  date date NOT NULL,
  truck_id text NOT NULL,
  stop integer NOT NULL,
  cso text NOT NULL,
  consumer_customer_name text NOT NULL,
  model text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  serial text,
  product_type text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  scanned boolean DEFAULT false,
  truck_fk uuid,
  customer_fk uuid,
  product_fk uuid,
  marked_for_truck boolean DEFAULT false,
  staged boolean DEFAULT false,
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT fk_deliveries_truck FOREIGN KEY (truck_fk) REFERENCES public.trucks(id),
  CONSTRAINT fk_deliveries_customer FOREIGN KEY (customer_fk) REFERENCES public.customers(id),
  CONSTRAINT fk_deliveries_product FOREIGN KEY (product_fk) REFERENCES public.products(id),
  CONSTRAINT deliveries_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT deliveries_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.inventory_conversions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  from_inventory_type text NOT NULL,
  to_inventory_type text NOT NULL,
  from_sub_inventory text,
  to_sub_inventory text,
  converted_by text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_conversions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_conversion_item FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id),
  CONSTRAINT inventory_conversions_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT inventory_conversions_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.inventory_counts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  product_id uuid NOT NULL,
  tracked_part_id uuid,
  qty integer NOT NULL,
  previous_qty integer,
  delta integer DEFAULT (qty - COALESCE(previous_qty, 0)),
  counted_by text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  count_reason text,
  CONSTRAINT inventory_counts_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_counts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT inventory_counts_tracked_part_id_fkey FOREIGN KEY (tracked_part_id) REFERENCES public.tracked_parts(id),
  CONSTRAINT inventory_counts_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT inventory_counts_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  date date,
  route_id text,
  stop integer,
  cso text NOT NULL,
  consumer_customer_name text,
  model text NOT NULL,
  qty integer DEFAULT 1,
  serial text,
  product_type text NOT NULL,
  status text,
  inventory_type text NOT NULL,
  sub_inventory text,
  is_scanned boolean DEFAULT false,
  scanned_at timestamp with time zone,
  scanned_by text,
  notes text,
  product_fk uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_fk) REFERENCES public.products(id),
  CONSTRAINT inventory_items_serial_key UNIQUE (serial),
  CONSTRAINT inventory_items_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT inventory_items_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.load_metadata (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  inventory_type text NOT NULL,
  sub_inventory_name text NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'staged'::text, 'in_transit'::text, 'delivered'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text,
  notes text,
  category text,
  CONSTRAINT load_metadata_pkey PRIMARY KEY (id),
  CONSTRAINT load_metadata_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT load_metadata_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.load_conflicts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  inventory_type text NOT NULL,
  load_number text NOT NULL,
  serial text NOT NULL,
  conflicting_load text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text])),
  notes text,
  detected_at timestamp with time zone DEFAULT now(),
  CONSTRAINT load_conflicts_pkey PRIMARY KEY (id),
  CONSTRAINT load_conflicts_unique UNIQUE (location_id, load_number, serial),
  CONSTRAINT load_conflicts_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT load_conflicts_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  model text NOT NULL UNIQUE,
  product_type text NOT NULL,
  brand text,
  description text,
  dimensions jsonb,
  created_at timestamp with time zone DEFAULT now(),
  image_url text,
  product_url text,
  price numeric,
  msrp numeric,
  color text,
  capacity text,
  availability text,
  commercial_category text,
  specs jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  product_category text CHECK (product_category = ANY (ARRAY['appliance'::text, 'part'::text, 'accessory'::text])),
  is_part boolean DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.scanning_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  name text NOT NULL,
  inventory_type text NOT NULL,
  sub_inventory text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text])),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  scanned_item_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  closed_at timestamp with time zone,
  created_by text,
  updated_by text,
  closed_by text,
  CONSTRAINT scanning_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT scanning_sessions_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT scanning_sessions_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id)
);

CREATE TABLE public.tracked_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  product_id uuid NOT NULL,
  reorder_threshold integer NOT NULL DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text,
  reordered_at timestamp with time zone,
  CONSTRAINT tracked_parts_pkey PRIMARY KEY (id),
  CONSTRAINT tracked_parts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT tracked_parts_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT tracked_parts_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT tracked_parts_location_product_unique UNIQUE (location_id, product_id)
);

CREATE TABLE public.trucks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  location_id uuid NOT NULL,
  truck_id text NOT NULL,
  driver_name text,
  capacity integer DEFAULT 50,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  abbreviated_name text,
  color text DEFAULT '#3B82F6'::text,
  CONSTRAINT trucks_pkey PRIMARY KEY (id),
  CONSTRAINT trucks_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT trucks_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT trucks_location_truck_id_unique UNIQUE (location_id, truck_id),
  CONSTRAINT trucks_location_abbrev_unique UNIQUE (location_id, abbreviated_name)
);

CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  username character varying UNIQUE,
  password character varying,
  image character varying,
  role text,
  company_ids uuid[] DEFAULT '{}'::uuid[],
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
