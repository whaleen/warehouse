/**
 * Map Types
 */

export interface Beacon {
  id: string;
  company_id: string;
  location_id: string;
  name: string; // e.g., "VELVET-HAMMER"
  position_x: number;
  position_y: number;
  icon?: string | null; // Lucide icon name
  created_at: string;
}

export type PositionSource = 'gps' | 'beacon';

export interface ProductLocationHistory {
  id: string;
  company_id: string;
  location_id: string;
  product_id: string | null;
  inventory_item_id: string | null;
  scanning_session_id: string | null;
  position_x: number;
  position_y: number;
  position_source: PositionSource;
  beacon_id: string | null;
  raw_lat: number | null; // original GPS latitude
  raw_lng: number | null; // original GPS longitude
  accuracy: number | null; // GPS accuracy in meters
  scanned_by: string | null;
  product_type: string | null; // snapshot at scan time
  sub_inventory: string | null; // snapshot at scan time
  created_at: string;
}

export interface RawGPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
}

/**
 * Product location with load color for map visualization
 */
export interface ProductLocationForMap {
  id: string;
  position_x: number;
  position_y: number;
  raw_lat: number | null;
  raw_lng: number | null;
  inventory_item_id?: string | null;
  inventory_type?: string | null;
  image_url?: string | null;
  load_item_count?: number | null;
  product_type: string | null;
  model?: string | null;
  serial?: string | null;
  sub_inventory: string | null;
  load_friendly_name?: string | null;
  load_color: string;
  created_at: string;
  accuracy: number | null;
  scanning_session_id?: string | null;
  // owning_session_id removed - no permanent session ownership
}

/**
 * Map configuration for warehouse floor plan
 */
export interface MapConfig {
  center: [number, number];
  zoom: number;
  floorPlanUrl?: string;
  bounds?: [[number, number], [number, number]];
}
