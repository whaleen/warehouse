export interface InventoryItem {
  id?: string;
  company_id?: string;
  location_id?: string;
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
  owning_session_id?: string | null;
  created_at?: string;
  updated_at?: string;
  // GE-sourced fields (from ASIS.csv and per-load CSVs)
  ge_model?: string;
  ge_serial?: string;
  ge_inv_qty?: number;
  ge_orphaned?: boolean;
  ge_orphaned_at?: string;
  ge_availability_status?: string;
  ge_availability_message?: string;
  ge_ordc?: string;
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
  | 'STA'
  | 'Inbound'
  | 'WillCall'
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
  company_id?: string;
  location_id?: string;
  inventory_type: InventoryType;
  sub_inventory_name: string;
  friendly_name?: string | null;
  // GE-sourced fields
  ge_source_status?: string;
  ge_cso_status?: string;
  ge_inv_org?: string;
  ge_units?: number;
  ge_submitted_date?: string;
  ge_cso?: string;
  ge_pricing?: string;
  ge_notes?: string;
  ge_scanned_at?: string;
  // Internal fields
  primary_color?: string | null;
  prep_tagged?: boolean;
  prep_wrapped?: boolean;
  sanity_check_requested?: boolean | null;
  sanity_check_requested_at?: string | null;
  sanity_check_requested_by?: string | null;
  sanity_check_completed_at?: string | null;
  sanity_check_completed_by?: string | null;
  pickup_date?: string | null;
  pickup_tba?: boolean;
  status: LoadStatus;
  category?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface LoadConflict {
  id?: string;
  company_id?: string;
  location_id?: string;
  inventory_type: InventoryType;
  load_number: string;
  serial: string;
  conflicting_load: string;
  status?: 'open' | 'resolved';
  notes?: string;
  detected_at?: string;
}

export interface InventoryConflictGroup {
  inventory_type: InventoryType | string;
  sub_inventory?: string | null;
  count?: number;
}

export interface InventoryConflict {
  id?: string;
  company_id?: string;
  location_id?: string;
  serial: string;
  groups: InventoryConflictGroup[];
  source?: string | null;
  status?: 'open' | 'resolved';
  detected_at?: string;
  updated_at?: string;
}

export interface LoadWithItems {
  metadata: LoadMetadata;
  items: InventoryItem[];
  item_count: number;
}

// Inventory Conversion Types
export interface InventoryConversion {
  id?: string;
  company_id?: string;
  location_id?: string;
  inventory_item_id: string;
  from_inventory_type: InventoryType | 'Salvage'; // Include Salvage for historical data
  to_inventory_type: InventoryType;
  from_sub_inventory?: string;
  to_sub_inventory?: string;
  converted_by?: string;
  notes?: string;
  created_at?: string;
}

// Parts Inventory Tracking Types
export interface TrackedPart {
  id: string;
  company_id?: string;
  location_id?: string;
  product_id: string;
  reorder_threshold: number;
  is_active: boolean;
  reordered_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface TrackedPartWithDetails extends TrackedPart {
  products: Product;
  current_qty: number;
  inventory_item_id?: string;
}

export interface InventoryCount {
  id: string;
  company_id?: string;
  location_id?: string;
  product_id: string;
  tracked_part_id?: string;
  qty: number;
  previous_qty?: number;
  delta?: number;
  count_reason?: 'usage' | 'return' | 'restock' | null;
  counted_by?: string;
  notes?: string;
  created_at: string;
}

export interface InventoryCountWithProduct extends InventoryCount {
  products?: {
    model?: string;
    price?: number | string | null;
    msrp?: number | string | null;
  } | null;
}

export interface ReorderAlert {
  tracked_part_id: string;
  product_id: string;
  model: string;
  description?: string;
  current_qty: number;
  reorder_threshold: number;
  is_critical: boolean; // qty === 0
  reordered_at?: string | null;
}
