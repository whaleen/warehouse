create table if not exists public.backhaul_orders (
  iso text not null,
  iso_id text,
  company_id uuid not null,
  location_id uuid not null,
  inv_org text,
  start_date date,
  end_date date,
  backhaul_status text,
  cancel text,
  total_units integer,
  total_points integer,
  type text,
  sub_inventory text,
  adc text,
  scac text,
  is_open boolean not null default true,
  last_seen_at timestamptz not null default now(),
  source text not null default 'ge_dms_backhaul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (iso, location_id)
);

create table if not exists public.backhaul_order_lines (
  iso text not null,
  iso_line_number text not null,
  company_id uuid not null,
  location_id uuid not null,
  model text,
  serial text,
  acc_qty integer,
  line_status text,
  cancel text,
  confirm text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (iso, iso_line_number, location_id)
);

create index if not exists backhaul_orders_location_open_idx
  on public.backhaul_orders (location_id, is_open);

create index if not exists backhaul_lines_location_iso_idx
  on public.backhaul_order_lines (location_id, iso);
