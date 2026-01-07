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
  created_at?: string;
}

export type InventoryType =
  | 'ASIS'
  | 'BackHaul'
  | 'Salvage'
  | 'Staged'
  | 'Inbound'
  | 'FG'
  | 'LocalStock';

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
