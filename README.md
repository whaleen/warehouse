# Warehouse - Inventory Management System

A mobile-first React PWA for warehouse inventory management, barcode scanning, load tracking, and product data management with real-time Supabase backend.

## Project Overview

Warehouse is designed for warehouse inventory management including:
- Barcode scanning (camera + manual entry)
- Inventory item tracking with scan verification
- Load/batch management (create, merge, rename, status tracking)
- Customer order tracking (CSO)
- Product database with GE Appliances catalog support
- Serial number tracking for appliances
- Inventory type conversion with audit trail
- Scanning sessions with progress tracking

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: shadcn/ui (Radix primitives) + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Barcode Scanning**: html5-qrcode
- **Charts**: recharts
- **CSV Parsing**: papaparse
- **PWA**: vite-plugin-pwa

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Supabase account

### 1. Environment Setup

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install & Run

```bash
npm install
npm run dev
```

### 3. Database Setup

Create the following tables in your Supabase project. See `planning-doc.md` for full schema details.

**Required Tables:**
- `inventory_items` - Main inventory tracking
- `products` - Product catalog
- `load_metadata` - Load/batch management
- `inventory_conversions` - Conversion audit trail
- `users` - User authentication (development mode)

## Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components (17 files)
│   ├── Auth/               # Login, avatar upload
│   ├── Dashboard/          # Metrics overview
│   ├── Inventory/          # Inventory management (11 components)
│   ├── Navigation/         # Header, bottom nav
│   ├── Products/           # Product search and details
│   ├── Scanner/            # Barcode scanning
│   ├── Session/            # Scanning sessions
│   └── Settings/           # User settings
├── context/
│   └── AuthContext.tsx     # Authentication state
├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── scanMatcher.ts      # Barcode matching logic
│   ├── sessionManager.ts   # Session persistence (localStorage)
│   ├── sessionScanner.ts   # Session scanning utilities
│   ├── loadManager.ts      # Load CRUD operations
│   ├── inventoryConverter.ts # Inventory type conversion
│   ├── htmlUtils.ts        # HTML entity decoding
│   └── utils.ts            # General utilities
├── types/
│   ├── inventory.ts        # Inventory & product types
│   └── session.ts          # Session types
├── App.tsx
└── main.tsx
```

## Features

### Core Functionality

- [x] **Barcode Scanning** - Camera-based scanner with adjustable scan area and manual fallback
- [x] **Inventory Management** - Full CRUD with search, filter, and bulk operations
- [x] **CSV Upload** - Import inventory from CSV files
- [x] **Load Management** - Create, rename, merge loads; track status (active → staged → in_transit → delivered)
- [x] **Inventory Conversion** - Convert items between types with full audit trail
- [x] **Scanning Sessions** - Track scanning progress with session persistence
- [x] **Product Database** - Search and enrich product catalog
- [x] **Dashboard** - Metrics, load statistics, recent activity with charts

### User Experience

- [x] **Mobile-First Design** - Optimized for warehouse mobile devices
- [x] **Dark Mode** - Theme switching support
- [x] **Responsive PWA** - Installable progressive web app
- [x] **Bottom Navigation** - Easy thumb-reach navigation

### Authentication (Development Mode)

- [x] Username/password login
- [x] Avatar upload
- [x] Session persistence

> **Note:** Authentication uses plaintext passwords for rapid prototyping. See `IDGAF_About_Auth_Security.md` for details. Not suitable for production.

## Database Schema

### inventory_items

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| serial | text | Serial number |
| cso | text | Customer Service Order |
| model | text | Product model number |
| inventory_type | text | ASIS, FG, LocalStock, Parts, BackHaul, Staged, Inbound, WillCall |
| sub_inventory | text | Load/location name |
| is_scanned | boolean | Scan status |
| scanned_at | timestamp | When scanned |
| scanned_by | text | Who scanned |
| status | text | PICKED, DELIVERED, PENDING, SHIPPED |
| product_fk | uuid | FK to products |

### products

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| model | text | Unique model number |
| product_type | text | WASHER, REFRIGERATOR, etc. |
| product_category | text | appliance, part, accessory |
| brand | text | Brand name |
| image_url | text | Product image |
| price / msrp | numeric | Pricing |
| dimensions | jsonb | Width, height, depth |
| specs | jsonb | All specifications |

### load_metadata

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| inventory_type | text | Load type |
| sub_inventory_name | text | Load name |
| status | text | active, staged, in_transit, delivered |

### inventory_conversions

Audit trail for inventory type changes (from_type, to_type, converted_by, etc.)

### users

Development auth table (id, username, password, image)

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build (TypeScript + Vite)
npm run lint     # ESLint validation
npm run preview  # Preview production build
```

## Product Categorization

Products are categorized into three types:

1. **Appliances** - Full units requiring serial numbers (washers, refrigerators, etc.)
2. **Parts** - Replacement components (control boards, shelves, etc.)
3. **Accessories** - Add-on items (filters, racks, kits, etc.)

This helps warehouse staff understand which items need serial number tracking.

## Inventory Types

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

## CSV Import Format

```csv
serial,cso,model,inventory_type,sub_inventory,date,consumer_customer_name
VA715942,1064836060,GTD58EBSVWS,ASIS,Load-001,2025-12-31,John Smith
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
