# "Warehouse" - Warehouse Inventory Management

A React application for managing warehouse inventory and appliance product data with real-time data from Supabase.

## Project Overview

"Warehouse" is designed for warehouse inventory management including:
- Inventory item tracking and management
- Customer order tracking (CSO)
- Product database with comprehensive GE Appliances catalog
- Serial number tracking for appliances
- Product categorization (appliances, parts, accessories)
- Route and delivery status management

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4

## Database Schema

### Tables

#### `inventory_items`
- `id` (uuid, primary key)
- `date` (date) - Item date
- `route_id` (text) - Route identifier
- `stop` (integer) - Stop number on route
- `cso` (text) - Customer Service Order number
- `consumer_customer_name` (text) - Customer name
- `model` (text) - Product model number
- `qty` (integer) - Quantity
- `serial` (text) - Serial number (for appliances only)
- `product_type` (text) - WASHER, REFRIGERATOR, DISHWASHER, etc.
- `product_fk` (uuid) - Foreign key to products table
- `status` (text) - PICKED, DELIVERED, PENDING, SHIPPED, etc.
- `inventory_type` (text) - WAREHOUSE, IN_TRANSIT, CUSTOMER
- `sub_inventory` (text) - Specific location within warehouse
- `is_scanned` (boolean) - Whether item has been scanned
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `products`
- `id` (uuid, primary key)
- `model` (text, unique) - Product model number
- `product_type` (text) - WASHER, REFRIGERATOR, DISHWASHER, etc.
- `product_category` (text) - appliance, part, or accessory
- `brand` (text) - Brand name (e.g., GE, Café, Monogram)
- `description` (text) - Product description
- `image_url` (text) - Product image URL
- `product_url` (text) - Link to product page
- `price` (numeric) - Current price
- `msrp` (numeric) - Manufacturer's suggested retail price
- `color` (text) - Product color/finish
- `capacity` (text) - Capacity (for appliances)
- `availability` (text) - Product availability status
- `commercial_category` (text) - Commercial category hierarchy
- `is_part` (boolean) - Whether item is a replacement part
- `dimensions` (jsonb) - Width, height, depth in inches
- `specs` (jsonb) - All product specifications
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### 1. Environment Setup

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key to the `.env.local` file
3. Run the database migrations (see SQL scripts in `/sql` directory)

### 4. Database Migration

Run the migrations in order from the `/migrations` directory in your Supabase SQL editor:

1. `001_initial_schema.sql` - Creates initial products and inventory_items tables
2. `002_add_product_category.sql` - Adds product categorization
3. `003_expand_products_schema.sql` - Adds comprehensive product fields (images, pricing, specs)
4. `004_add_product_category_type.sql` - Creates product_category enum type
5. `005_add_is_part_field.sql` - Adds is_part boolean for distinguishing parts
6. `006_recategorize_with_is_part.sql` - Re-categorizes products based on is_part field

### 5. Scrape Product Data

After running migrations, populate the products table with GE Appliances data:

```bash
npm run scrape-products
```

This will fetch up to 10,000 products from the GE Appliances API including:
- Product specifications and dimensions
- Images and product URLs
- Pricing information (price, MSRP)
- Product categorization (appliance, part, accessory)

### 6. Seed Inventory Data (Optional)

Generate test inventory data:

```bash
npm run seed-inventory
```

### 7. Development

```bash
npm run dev
```

## Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── Dashboard/          # Dashboard view with metrics
│   ├── Inventory/          # Inventory management components
│   ├── Products/           # Product database and enrichment
│   ├── Settings/           # Settings and configuration
│   └── Navigation/         # App navigation components
├── lib/
│   ├── supabase.ts         # Supabase client setup
│   ├── utils.ts            # Utility functions
│   └── htmlUtils.ts        # HTML entity decoding utilities
├── scripts/
│   ├── scrapeGEProducts.ts # GE product catalog scraper
│   └── seed-inventory.ts   # Inventory data seeding
├── migrations/             # Database migration files
└── App.tsx
```

## Features

- [x] **Dashboard** - Overview of warehouse metrics and inventory status
- [x] **Inventory Management** - Track and manage inventory items across warehouse locations
  - Filter by product type, status, inventory type, and product category
  - Search by model, CSO, serial number, or customer name
  - View comprehensive product details including images and specifications
  - Support for appliances, parts, and accessories
- [x] **Product Database** - Comprehensive GE Appliances product catalog
  - 10,000+ products from GE Appliances API
  - Product images, descriptions, and specifications
  - Pricing information (price, MSRP)
  - Dimensions and technical specs
  - Product categorization (appliance/part/accessory)
- [x] **Product Enrichment** - Search and add products to the database
  - Live search with product images and details
  - Create new product entries
  - Link to official product pages
- [x] **Customer Order Tracking** - Track items by CSO number
- [x] **Serial Number Tracking** - Track serial numbers for appliances
- [x] **Route Management** - Assign items to routes and track delivery stops
- [x] **Status Tracking** - Monitor item status (picked, shipped, delivered, etc.)
- [x] **Responsive PWA** - Mobile-first design with offline capabilities
- [x] **Dark Mode** - Theme switching support

## Product Categorization

The application automatically categorizes products into three types:

1. **Appliances** - Full units that require serial numbers (washers, dryers, refrigerators, etc.)
   - `is_part = false` AND not in "Parts & Accessories" category

2. **Parts** - Replacement components that don't require serial numbers (control boards, shelves, tubes, etc.)
   - `is_part = true`

3. **Accessories** - Add-on items that don't require serial numbers (filters, racks, kits, etc.)
   - `is_part = false` AND in "Parts & Accessories" category

This categorization helps warehouse staff understand which items need serial number tracking.

## Data Source

Product data is sourced from the official GE Appliances SearchSpring API:
- API endpoint: `https://q7rntw.a.searchspring.io/api/search/search.json`
- Data includes: product specifications, images, pricing, dimensions, availability
- The scraper respects rate limits (500ms between requests)
- Data is stored locally in Supabase for fast access

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License