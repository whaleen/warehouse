# Warehouse Inventory Scanner - Planning Document v2

## Project Overview

A mobile-first PWA for warehouse inventory management, barcode scanning, and load tracking. The system provides digital inventory verification, load management, and product tracking to replace manual paper-based processes.

**Current Status:** MVP Complete - Core scanning and inventory management functional

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript
- **UI Library**: shadcn/ui (Radix primitives) + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Barcode Scanning**: html5-qrcode
- **Charts**: recharts
- **CSV Parsing**: papaparse
- **PWA**: vite-plugin-pwa

## Current Architecture

### Application Views

1. **Dashboard** - Metrics overview, load statistics, recent activity
2. **Inventory** - Full inventory management with search, filters, and bulk operations
3. **Products** - Product database search and enrichment
4. **Settings** - User profile, preferences

### Navigation

- Bottom navigation bar (mobile-optimized)
- Header with user avatar, theme toggle, settings access

## Database Schema (Current)

### inventory_items
Primary table for tracking all inventory.

```sql
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  date date,
  route_id text,
  stop integer,
  cso text,                    -- Customer Service Order number
  consumer_customer_name text,
  model text,
  qty integer default 1,
  serial text,
  product_type text,           -- WASHER, REFRIGERATOR, etc.
  product_fk uuid references products(id),
  status text,                 -- PICKED, DELIVERED, PENDING, SHIPPED
  inventory_type text,         -- ASIS, FG, LocalStock, Parts, etc.
  sub_inventory text,          -- Specific location/load name
  is_scanned boolean default false,
  scanned_at timestamp,
  scanned_by text,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_inventory_serial on inventory_items(serial);
create index idx_inventory_cso on inventory_items(cso);
create index idx_inventory_model on inventory_items(model);
create index idx_inventory_type on inventory_items(inventory_type);
create index idx_inventory_sub on inventory_items(sub_inventory);
create index idx_inventory_scanned on inventory_items(is_scanned);
```

### products
Product catalog with specifications.

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  model text unique,
  product_type text,
  product_category text,       -- appliance, part, accessory
  brand text,
  description text,
  image_url text,
  product_url text,
  price numeric,
  msrp numeric,
  color text,
  capacity text,
  availability text,
  commercial_category text,
  is_part boolean default false,
  dimensions jsonb,            -- {width, height, depth}
  specs jsonb,                 -- All product specifications
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

### load_metadata
Tracks loads/batches for inventory grouping.

```sql
create table load_metadata (
  id uuid primary key default gen_random_uuid(),
  inventory_type text not null,
  sub_inventory_name text not null,
  status text default 'active', -- active, staged, in_transit, delivered
  category text,
  notes text,
  created_by text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

### inventory_conversions
Audit trail for inventory type changes.

```sql
create table inventory_conversions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references inventory_items(id),
  from_inventory_type text,
  to_inventory_type text,
  from_sub_inventory text,
  to_sub_inventory text,
  converted_by text,
  notes text,
  created_at timestamp default now()
);
```

### users
Simple user authentication (development only - plaintext passwords).

```sql
create table users (
  id text primary key,
  username text unique,
  password text,               -- Plaintext for development
  image text,                  -- Avatar URL in Supabase Storage
  created_at timestamp default now()
);
```

## Inventory Types

The system supports these inventory classifications:

| Type | Description |
|------|-------------|
| ASIS | As-is/open-box items |
| FG | Finished goods |
| LocalStock | Local warehouse stock |
| Parts | Replacement parts |
| BackHaul | Items being returned |
| Staged | Items staged for delivery |
| Inbound | Incoming shipments |
| WillCall | Customer pickup items |

## Implemented Features

### Core Functionality

- [x] **Barcode Scanning**
  - Camera-based scanner using html5-qrcode
  - Adjustable scan area size (Small, Medium, Large, XL)
  - Manual entry fallback for damaged barcodes
  - Multi-field matching (serial → CSO → model)

- [x] **Inventory Management**
  - CSV upload and parsing (papaparse)
  - Search by serial, CSO, model, customer name
  - Filter by inventory type, product type, status
  - Sort capabilities
  - Bulk operations

- [x] **Load Management**
  - Create loads with metadata
  - Rename loads
  - Merge multiple loads
  - Update load status (active → staged → in_transit → delivered)
  - Move items between loads
  - Add items to existing loads

- [x] **Inventory Type Conversion**
  - Convert items between inventory types
  - Full audit trail of conversions
  - Conversion history viewing

- [x] **Scanning Sessions**
  - Create scanning sessions
  - Track scanned vs unscanned items
  - Session persistence (localStorage)
  - Progress tracking

- [x] **Product Database**
  - Product search and lookup
  - Product enrichment UI
  - View product details, images, specs

- [x] **Dashboard**
  - Inventory metrics overview
  - Load statistics by status
  - Recent activity feed
  - Charts (recharts)

- [x] **User Experience**
  - Mobile-first responsive design
  - Dark/light theme toggle
  - Bottom navigation
  - Large touch targets (44px+)

### Authentication (Development Mode)

- [x] Username/password login
- [x] Avatar upload to Supabase Storage
- [x] Session persistence (localStorage)
- [x] User profile settings

**Note:** Authentication uses plaintext passwords intentionally for rapid prototyping. See `IDGAF_About_Auth_Security.md` for details.

## Component Structure

```
src/components/
├── Auth/
│   ├── LoginCard.tsx         # Login form
│   └── AvatarUploader.tsx    # Avatar upload
├── Dashboard/
│   └── DashboardView.tsx     # Main dashboard
├── Inventory/
│   ├── InventoryView.tsx     # Main inventory UI
│   ├── CSVUpload.tsx         # CSV import
│   ├── InventoryItemDetailDialog.tsx
│   ├── CreateLoadDialog.tsx
│   ├── LoadManagementDialog.tsx
│   ├── LoadDetailDialog.tsx
│   ├── AddItemsToLoadDialog.tsx
│   ├── MoveItemsDialog.tsx
│   ├── MergeLoadsDialog.tsx
│   ├── RenameLoadDialog.tsx
│   └── ConvertInventoryTypeDialog.tsx
├── Navigation/
│   ├── AppHeader.tsx
│   └── BottomNav.tsx
├── Products/
│   ├── ProductEnrichment.tsx
│   └── ProductDetailDialog.tsx
├── Scanner/
│   ├── BarcodeScanner.tsx    # Camera scanner
│   └── ItemSelectionDialog.tsx
├── Session/
│   ├── CreateSessionDialog.tsx
│   └── ScanningSessionView.tsx
├── Settings/
│   └── SettingsView.tsx
└── ui/                       # shadcn/ui components
```

## Utility Libraries

| File | Purpose |
|------|---------|
| `scanMatcher.ts` | Barcode matching against inventory |
| `sessionManager.ts` | localStorage session persistence |
| `sessionScanner.ts` | Session-specific scanning logic |
| `loadManager.ts` | Load CRUD operations |
| `inventoryConverter.ts` | Inventory type conversion + audit |
| `supabase.ts` | Supabase client configuration |
| `htmlUtils.ts` | HTML entity decoding |
| `utils.ts` | General utilities (cn, etc.) |

## Phase 2: Future Enhancements

### High Priority

- [ ] **Offline-First Sync** - Full offline capability with background sync
- [ ] **Configurable Scan Rules** - UI for setting primary/fallback scan fields per inventory type
- [ ] **Proper Authentication** - Token-based auth, password hashing, RLS policies
- [ ] **Export Functionality** - Export scanned/filtered lists to CSV
- [ ] **Duplicate Detection** - Warn on duplicate scans

### Medium Priority

- [ ] **Photo Capture** - Photograph items during scanning
- [ ] **Notes/Condition Reporting** - Structured condition notes on items
- [ ] **Upload History** - Track CSV uploads with audit trail
- [ ] **Scan History UI** - View all scan activity with timestamps

### Lower Priority

- [ ] **Multi-User Support** - User roles (scanner, supervisor, admin)
- [ ] **Dashboard Analytics** - Advanced reporting and charts
- [ ] **Native Mobile App** - Dedicated scanner SDK integration
- [ ] **Hardware Scanner Support** - Bluetooth/USB barcode scanner integration

## Known Issues / Tech Debt

1. **Missing Scripts** - `seed` and `scrape:ge` package.json scripts reference non-existent files
2. **Plaintext Passwords** - Intentional for development, must be fixed before production
3. **RLS Policies** - Currently wide-open for prototyping
4. **Offline Sync** - PWA shell exists but no true offline capability
5. **Product Data** - GE product catalog not populated (scraper script missing)

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint validation
npm run preview  # Preview production build
```

## CSV Upload Format

Expected columns for inventory import:

```csv
serial,cso,model,inventory_type,sub_inventory,date,consumer_customer_name
VA715942,1064836060,GTD58EBSVWS,ASIS,Load-001,2025-12-31,John Smith
VA812345,1064836061,GTE22EBSVWS,FG,Load-002,2025-12-31,Jane Doe
```

## Scanning Logic

```typescript
async function processScan(scannedValue: string) {
  // 1. Search by serial number
  let matches = await findByField('serial', scannedValue);

  // 2. Fallback to CSO number
  if (matches.length === 0) {
    matches = await findByField('cso', scannedValue);
  }

  // 3. Fallback to model number
  if (matches.length === 0) {
    matches = await findByField('model', scannedValue);
  }

  // 4. Handle results
  if (matches.length === 1) {
    await markAsScanned(matches[0].id);
    showSuccess();
  } else if (matches.length > 1) {
    showItemSelectionDialog(matches);
  } else {
    showError("Item not found");
  }
}
```

## Success Criteria

### MVP Complete (Current State)

- [x] CSV upload and item display
- [x] Camera barcode scanner works reliably
- [x] Items marked as scanned with database update
- [x] Progress tracking accurate
- [x] Mobile-friendly UI
- [x] Search and filter functional
- [x] Load management operational

### Production Readiness Checklist

- [ ] Secure authentication implemented
- [ ] RLS policies enforced
- [ ] Offline sync working
- [ ] Error handling comprehensive
- [ ] Loading states consistent
- [ ] Tested on actual warehouse devices
- [ ] Performance validated with 500+ items

---

*Previous planning document archived at `.context/planning-doc-v1.md`*
