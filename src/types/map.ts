/**
 * Map Types - Fog of War positioning system
 */

export interface GenesisPoint {
  id: string;
  location_id: string;
  genesis_lat: number;
  genesis_lng: number;
  genesis_scan_id: string | null;
  established_at: string;
  established_by: string | null;
}

export interface Beacon {
  id: string;
  company_id: string;
  location_id: string;
  name: string; // e.g., "VELVET-HAMMER"
  position_x: number; // meters from genesis
  position_y: number; // meters from genesis
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
  position_x: number; // meters from genesis
  position_y: number; // meters from genesis
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

export interface RelativePosition {
  x: number; // meters from genesis
  y: number; // meters from genesis
}

/**
 * Product location with load color for map visualization
 */
export interface ProductLocationForMap {
  id: string;
  position_x: number;
  position_y: number;
  product_type: string | null;
  sub_inventory: string | null;
  load_color: string;
  created_at: string;
  accuracy: number | null;
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
