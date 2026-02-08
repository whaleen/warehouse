# Warehouse - Inventory Management System

A mobile-first React PWA for warehouse inventory management, load tracking, and verification scanning with a Supabase backend.

## MVP Vision

This is an internal tool for warehouse operations. The core workflow:

1. **Product data comes from external systems** - Not entered via scanning. GE ASIS data is synced via a dedicated `ge-sync` service (Playwright + Supabase). Static files in `/public/` are legacy/reference only.

2. **Loads are managed and prepped** - Loads are mirrored from GE ASIS and enriched locally (friendly name, color, notes, prep checklist).

3. **Scanning is for verification ("sanity checks")** - When a load is ready for pickup, use the Map scanner (Fog of War or Ad-hoc) to verify items are present. Think of it as a "job": boss says "let's confirm Load Q is all there" → scan each item → get final count → done. This sanity count is part of the prep checklist, typically done day-of pickup as a final stamp of approval.

4. **Floor displays show live status** - TV screens on the warehouse floor showing load summaries, parts alerts, and active sessions via Supabase Realtime.

## Feature Status

### Done
- [x] Load management (GE-synced; no manual load creation; prep checklist + status tracking)
- [x] Load prep checklist (tagged, wrapped, pickup date)
- [x] Barcode scanning (camera + manual entry)
- [x] Map scanner (Fog of War + Ad-hoc) for verification counts
- [x] Product database with search
- [x] Floor displays with 6-digit pairing (public, unauthenticated)
- [x] Floor display widgets (loads summary, parts alerts, active sessions, clock, text)
- [x] Supabase Realtime for live updates
- [x] Multi-tenant (companies + locations)
- [x] Dark mode + mobile-first PWA
- [x] GE ASIS sync service (Playwright + Supabase)
- [x] Activity log (sync, wipe, load edits)

### In Progress
- [ ] Sanity count as explicit prep checklist item
- [ ] Floor display UI polish

### Planned
- [ ] Expand GE sync beyond ASIS
- [ ] Enhanced load conflict tracking
- [ ] Reporting/analytics

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: shadcn/ui (Radix primitives) + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + Realtime)
- **Barcode Scanning**: html5-qrcode
- **Charts**: recharts
- **CSV Parsing**: papaparse
- **PWA**: vite-plugin-pwa
- **Legacy Browser Support**: @vitejs/plugin-legacy (for Samsung TV)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Supabase account

### 1. Environment Setup

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional for initial tenancy
VITE_ACTIVE_COMPANY_ID=your_company_uuid
VITE_ACTIVE_LOCATION_ID=your_location_uuid
# Optional for unlocking company/location manager in Settings
VITE_SUPERADMIN_USERNAME=your_admin_username
VITE_SUPERADMIN_PASSWORD=your_admin_password
# Optional for GE sync service
VITE_GE_SYNC_URL=http://localhost:3001
VITE_GE_SYNC_API_KEY=your_api_key
```

#### GE Sync environments (dev vs prod)

- **Local dev**: keep `VITE_GE_SYNC_URL=http://localhost:3001` in `.env.local` and run the service locally (`services/ge-sync`).
- **Production**: set `VITE_GE_SYNC_URL` and `VITE_GE_SYNC_API_KEY` in your hosted frontend environment (the values are baked at build time). Use your Railway service URL.

### 2. Install & Run

```bash
pnpm install
pnpm run dev
```

### 2b. GE Sync Service (ASIS)

The GE sync service lives in `services/ge-sync` and runs separately.

```bash
cd services/ge-sync
pnpm install
pnpm exec playwright install chromium
pnpm run dev
```

Scaling notes (beta+):
- Syncs run inline (no queue) and there is no per-location lock or global cap yet.
- Avoid overlapping syncs for the same location; heavy parallel syncs can exhaust Playwright resources.
- See `services/ge-sync/README.md` for planned queue/lock details and beta operational guidance.

### 3. Database Setup

Database migrations are managed via Supabase CLI in `supabase/migrations/`. Use `warehouse.sql` as a reference schema.

**Key tables:**
- `companies`, `locations`, `settings`
- `inventory_items`, `products`, `load_metadata`
- `scanning_sessions`, `tracked_parts`, `inventory_counts`, `trucks`, `users`
- `floor_displays` (with Realtime enabled)
- `activity_log` (user actions)

## Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── Auth/               # Login, avatar upload
│   ├── Activity/           # Activity log
│   ├── Dashboard/          # Metrics overview
│   ├── FloorDisplay/       # TV display + widgets
│   ├── Inventory/          # Inventory + load management
│   ├── Navigation/         # Header, user menu, location switcher
│   ├── Products/           # Product search and details
│   ├── Scanner/            # Barcode scanning + scan overlay
│   ├── Map/                # Warehouse map + scan view
│   └── Settings/           # Settings + user manager + display manager
├── context/
│   └── AuthContext.tsx     # Authentication state
├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── displayManager.ts   # Floor display CRUD + Realtime
│   ├── loadManager.ts      # Load data access + updates
│   ├── sessionManager.ts   # Scan session persistence (scanner-managed)
│   ├── scanMatcher.ts      # Barcode matching logic
│   └── utils.ts            # General utilities
├── types/
│   ├── inventory.ts        # Inventory & product types
│   ├── session.ts          # Scan session types
│   └── display.ts          # Floor display types
├── App.tsx
└── main.tsx
```

## Floor Display Setup

Floor displays are public screens that show live warehouse data without authentication.

1. **Create a display** - Go to Settings → Displays → Create Display
2. **Get the pairing code** - Note the 6-digit code shown
3. **On the TV** - Navigate to `/display` and enter the pairing code
4. **Configure widgets** - Back in Settings, configure which widgets appear

Supported widgets:
- **Loads Summary** - Count of loads by status
- **Parts Alerts** - Low stock warnings
- **Active Sessions** - Current scanning sessions
- **Clock** - Date and time
- **Text** - Custom message

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  External Systems (GE)                                       │
│  - GE DMS ASIS exports (Report History + per-load CSVs)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  GE Sync Service (services/ge-sync)                          │
│  - Playwright SSO + cookie persistence                        │
│  - Fetches GE ASIS sheets + merges                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL)                                       │
│  - products, inventory_items, load_metadata                  │
│  - ge_changes, activity_log                                  │
│  - Realtime enabled for floor_displays                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│  Mobile App (Auth)       │   │  Floor Display (Public)  │
│  - Load management       │   │  - /display route        │
│  - Map scanner           │   │  - 6-digit pairing       │
│  - Inventory CRUD        │   │  - Realtime widgets      │
│  - Display configuration │   │  - No auth required      │
└─────────────────────────┘   └─────────────────────────┘
```

## Inventory Types

| Type | Description |
|------|-------------|
| ASIS | As-is/open-box items |
| FG | Finished goods |
| LocalStock | Local warehouse stock |
| Parts | Replacement parts (no loads) |
| BackHaul | Items being returned |
| Staged | Items staged for delivery |
| Inbound | Incoming shipments |
| WillCall | Customer pickup items |

## Available Scripts

```bash
pnpm run dev      # Start development server
pnpm run build    # Production build (TypeScript + Vite)
pnpm run lint     # ESLint validation
pnpm run preview  # Preview production build
```

## Production Deployment (Floor Display)

For Samsung TV or other legacy browsers:

```bash
pnpm run build
pnpm exec serve dist -s   # -s flag for SPA routing
```

The build includes legacy browser support via `@vitejs/plugin-legacy`.

## Audience Notes

### For Developers
- This is the high-level product/tech overview. Use `docs/INDEX.md` for validated docs.

### For Operators
- This is a technical overview; daily workflows are in the Docs UI (Warehouse + GE DMS sections).

### For Agent
- Treat this as a broad overview only; prefer detailed docs for workflow steps.
