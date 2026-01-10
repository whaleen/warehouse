export interface InventoryItem {
  id?: string;
  date?: string;
  route_id?: string;
  stop?: number;
  cso: string;
  consumer_customer_name?: string;
  model: string;
  qty: number;
  serial?: string;
  product_type: string;
  status?: string;
  inventory_type: InventoryType;
  sub_inventory?: string;
  is_scanned: boolean;
  scanned_at?: string;
  scanned_by?: string;
  notes?: string;
  product_fk?: string;
  created_at?: string;
  updated_at?: string;
  // Joined data
  products?: Product;
}


//   id: string;
//   model: string;
//   product_type: string;
//   brand?: string;
//   description?: string;
//   dimensions?: {
//     width?: number;
//     height?: number;
//     depth?: number;
//   };
//   image_url?: string;
//   product_url?: string;
//   price?: number;
//   msrp?: number;
//   color?: string;

export interface Product {
  id?: string;
  model: string;
  product_type: string;
  brand?: string;
  description?: string;
  weight?: number;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
  };
  image_url?: string;
  product_url?: string;
  price?: number;
  msrp?: number;
  color?: string;
  created_at?: string;
}

export type InventoryType =
  | 'ASIS'
  | 'BackHaul'
  | 'Staged'
  | 'Inbound'
  | 'FG'
  | 'LocalStock'
  | 'Parts';

export type ProductType =
  | 'WASHER'
  | 'REFRIGERATOR'
  | 'MICROWAVE OVEN'
  | 'MICROWAVE OVEN ACCESS'
  | 'GAS RANGE'
  | 'GAS RANGE SURFACE'
  | 'ELECTRIC RANGE'
  | 'ELECTRIC DRYER'
  | 'DISHWASHER'
  | 'DISHWASHER BI'
  | 'H-ACCESS'
  | 'NO SPARE FREE';

export interface ScanResult {
  type: 'unique' | 'multiple' | 'not_found';
  items?: InventoryItem[];
  matchedField?: 'serial' | 'cso' | 'model';
}

// Load Management Types
export type LoadStatus = 'active' | 'staged' | 'in_transit' | 'delivered';

export interface LoadMetadata {
  id?: string;
  inventory_type: InventoryType;
  sub_inventory_name: string;
  status: LoadStatus;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  notes?: string;
}

export interface LoadWithItems {
  metadata: LoadMetadata;
  items: InventoryItem[];
  item_count: number;
}

// Inventory Conversion Types
export interface InventoryConversion {
  id?: string;
  inventory_item_id: string;
  from_inventory_type: InventoryType | 'Salvage'; // Include Salvage for historical data
  to_inventory_type: InventoryType;
  from_sub_inventory?: string;
  to_sub_inventory?: string;
  converted_by?: string;
  notes?: string;
  created_at?: string;
}
