export interface Delivery {
  id?: string;
  date: string;
  truck_id: string; // Keep for backward compatibility
  truck_fk?: string;
  stop: number;
  cso: string;
  consumer_customer_name: string; // Keep for backward compatibility
  customer_fk?: string;
  model: string; // Keep for backward compatibility
  product_fk?: string;
  qty: number;
  serial: string;
  product_type: string;
  status: string;
  scanned: boolean;
  marked_for_truck: boolean;
  staged: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined data
  trucks?: Truck;
  customers?: Customer;
  products?: Product;
}

export interface Truck {
  id?: string;
  truck_id: string;
  abbreviated_name?: string;
  color?: string;
  driver_name?: string;
  capacity?: number;
  active?: boolean;
  created_at?: string;
}

export interface Customer {
  id?: string;
  customer_name: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at?: string;
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

export type DeliveryStatus = 'PICKED' | 'IN_TRANSIT' | 'DELIVERED' | 'PENDING' | 'CANCELLED';

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