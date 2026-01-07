# BlueJacket - Appliance Delivery Logistics Viewer

A React application for viewing appliance delivery logistics data with real-time data from Supabase.

## Project Overview

BlueJacket is designed to display appliance delivery logistics information including:
- Delivery truck routes and schedules
- Customer order tracking (CSO)
- Appliance inventory (washers, refrigerators, microwaves, ranges, dryers, dishwashers)
- Serial number tracking and delivery status
- Stop-by-stop delivery progress

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4

## Database Schema

### Tables

#### `deliveries`
- `id` (uuid, primary key)
- `date` (date) - Delivery date
- `truck_id` (text) - Truck identifier (e.g., CAP-008, GRAN15)
- `stop` (integer) - Stop number on route
- `cso` (text) - Customer Service Order number
- `consumer_customer_name` (text) - Customer name
- `model` (text) - Product model number
- `qty` (integer) - Quantity delivered
- `serial` (text) - Serial number
- `product_type` (text) - WASHER, REFRIGERATOR, MICROWAVE OVEN, etc.
- `status` (text) - PICKED, DELIVERED, PENDING, etc.
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `trucks`
- `id` (uuid, primary key)
- `truck_id` (text, unique) - Truck identifier
- `driver_name` (text)
- `capacity` (integer) - Max items per truck
- `active` (boolean) - Is truck currently active
- `created_at` (timestamp)

#### `customers`
- `id` (uuid, primary key)
- `customer_name` (text)
- `address` (text)
- `phone` (text)
- `email` (text)
- `created_at` (timestamp)

#### `products`
- `id` (uuid, primary key)
- `model` (text, unique) - Product model number
- `product_type` (text) - Product category
- `brand` (text)
- `description` (text)
- `weight` (decimal) - Product weight
- `dimensions` (jsonb) - Width, height, depth
- `created_at` (timestamp)

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

Execute the following SQL in your Supabase SQL editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create deliveries table
CREATE TABLE deliveries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  truck_id TEXT NOT NULL,
  stop INTEGER NOT NULL,
  cso TEXT NOT NULL,
  consumer_customer_name TEXT NOT NULL,
  model TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  serial TEXT,
  product_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trucks table
CREATE TABLE trucks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id TEXT UNIQUE NOT NULL,
  driver_name TEXT,
  capacity INTEGER DEFAULT 50,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customers table
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model TEXT UNIQUE NOT NULL,
  product_type TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  weight DECIMAL,
  dimensions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_deliveries_truck_id ON deliveries(truck_id);
CREATE INDEX idx_deliveries_date ON deliveries(date);
CREATE INDEX idx_deliveries_cso ON deliveries(cso);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_product_type ON deliveries(product_type);

-- Enable Row Level Security
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (adjust as needed for your use case)
CREATE POLICY "Allow read access to deliveries" ON deliveries FOR SELECT USING (true);
CREATE POLICY "Allow read access to trucks" ON trucks FOR SELECT USING (true);
CREATE POLICY "Allow read access to customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow read access to products" ON products FOR SELECT USING (true);
```

### 5. Development

```bash
npm run dev
```

## Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── DeliveryViewer/     # Main delivery viewing components
│   ├── TruckRoutes/        # Truck route displays
│   ├── DeliveryStatus/     # Status tracking components
│   └── ProductCatalog/     # Product information display
├── lib/
│   ├── supabase.ts         # Supabase client setup
│   └── utils.ts            # Utility functions
├── types/
│   └── deliveries.ts       # TypeScript type definitions
└── App.tsx
```

## Features

- [ ] Delivery route overview
- [ ] Real-time delivery status tracking
- [ ] Truck route optimization display
- [ ] Customer order tracking (CSO lookup)
- [ ] Product inventory management
- [ ] Serial number tracking
- [ ] Responsive design for mobile and desktop
- [ ] Search and filter deliveries
- [ ] Print-friendly delivery manifests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License