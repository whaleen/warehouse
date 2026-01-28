/**
 * Map Manager - Fog of War positioning system
 *
 * Handles GPS positioning with genesis point relative coordinates.
 * First scan establishes coordinate origin (0,0) for the location.
 * Subsequent scans are positioned relative to genesis.
 */

import supabase from './supabase';
import { getActiveLocationContext } from './tenant';
import type {
  GenesisPoint,
  RawGPSPosition,
  RelativePosition,
  ProductLocationHistory,
  ProductLocationForMap,
} from '@/types/map';
import { getLoadColorByName } from './loadColors';

/**
 * Convert GPS coordinates to relative x,y from genesis point
 * Uses Haversine formula for distance, bearing for direction
 *
 * @returns x,y coordinates in meters from genesis point
 */
function gpsToRelative(
  lat: number,
  lng: number,
  genesisLat: number,
  genesisLng: number
): RelativePosition {
  const R = 6371000; // Earth radius in meters

  const φ1 = (genesisLat * Math.PI) / 180;
  const φ2 = (lat * Math.PI) / 180;
  const Δφ = ((lat - genesisLat) * Math.PI) / 180;
  const Δλ = ((lng - genesisLng) * Math.PI) / 180;

  // Calculate bearing (direction from genesis to point)
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const bearing = Math.atan2(y, x);

  // Calculate distance using Haversine
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Convert polar (distance, bearing) to cartesian (x, y)
  const relX = distance * Math.sin(bearing);
  const relY = distance * Math.cos(bearing);

  return { x: relX, y: relY };
}

/**
 * Get genesis point for current location
 */
export async function getGenesisPoint(): Promise<{
  data: GenesisPoint | null;
  error: any;
}> {
  const { locationId } = getActiveLocationContext();

  const { data, error } = await supabase
    .from('location_genesis_points')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  return { data: data as GenesisPoint | null, error };
}

/**
 * Create genesis point for location (first scan)
 */
export async function createGenesisPoint(
  firstScanLat: number,
  firstScanLng: number,
  establishedBy?: string
): Promise<{ data: GenesisPoint | null; error: any }> {
  const { locationId } = getActiveLocationContext();

  const { data, error } = await supabase
    .from('location_genesis_points')
    .insert({
      location_id: locationId,
      genesis_lat: firstScanLat,
      genesis_lng: firstScanLng,
      established_by: establishedBy ?? null,
    })
    .select()
    .single();

  return { data: data as GenesisPoint | null, error };
}

/**
 * Get or create genesis point (handles first scan automatically)
 */
export async function getOrCreateGenesisPoint(
  firstScanLat: number,
  firstScanLng: number,
  establishedBy?: string
): Promise<{ data: GenesisPoint | null; error: any }> {
  // Check if genesis exists
  const { data: existing, error: fetchError } = await getGenesisPoint();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 is "not found" - that's expected for first scan
    return { data: null, error: fetchError };
  }

  if (existing) {
    return { data: existing, error: null };
  }

  // Create new genesis point
  return await createGenesisPoint(firstScanLat, firstScanLng, establishedBy);
}

/**
 * Capture current GPS position from device
 */
export async function getCurrentPosition(): Promise<RawGPSPosition | null> {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported by this device/browser');
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Log product location during scan
 * Automatically handles genesis point creation and relative positioning
 *
 * Note: inventory_item_id is optional since session items are snapshots
 * and may not have valid FK references to inventory_items table.
 * We store product_type and sub_inventory as snapshots for map visualization.
 */
export async function logProductLocation(input: {
  product_id?: string;
  inventory_item_id?: string;
  scanning_session_id: string;
  raw_lat: number;
  raw_lng: number;
  accuracy: number;
  scanned_by?: string;
  product_type?: string;
  sub_inventory?: string;
}): Promise<{ success: boolean; error?: any; isGenesisScan?: boolean }> {
  const { locationId, companyId } = getActiveLocationContext();

  // Get or establish genesis point
  const { data: genesis, error: genesisError } = await getOrCreateGenesisPoint(
    input.raw_lat,
    input.raw_lng,
    input.scanned_by
  );

  if (genesisError || !genesis) {
    return { success: false, error: genesisError };
  }

  const isGenesisScan =
    genesis.genesis_lat === input.raw_lat && genesis.genesis_lng === input.raw_lng;

  // Calculate relative position from genesis
  const { x, y } = gpsToRelative(
    input.raw_lat,
    input.raw_lng,
    genesis.genesis_lat,
    genesis.genesis_lng
  );

  // Insert location record
  const { data: locationRecord, error } = await supabase
    .from('product_location_history')
    .insert({
      company_id: companyId,
      location_id: locationId,
      product_id: input.product_id ?? null,
      inventory_item_id: input.inventory_item_id ?? null,
      scanning_session_id: input.scanning_session_id,
      position_x: x,
      position_y: y,
      position_source: 'gps',
      raw_lat: input.raw_lat,
      raw_lng: input.raw_lng,
      accuracy: input.accuracy,
      scanned_by: input.scanned_by ?? null,
      product_type: input.product_type ?? null,
      sub_inventory: input.sub_inventory ?? null,
    })
    .select()
    .single();

  // Update genesis point with genesis_scan_id if this is the first scan
  if (isGenesisScan && !genesis.genesis_scan_id && locationRecord) {
    await supabase
      .from('location_genesis_points')
      .update({ genesis_scan_id: locationRecord.id })
      .eq('id', genesis.id);
  }

  return { success: !error, error, isGenesisScan };
}

/**
 * Get all product locations for map display
 * Returns positions with load colors for visualization
 */
export async function getProductLocations(): Promise<{
  data: ProductLocationForMap[];
  error: any;
}> {
  const { locationId } = getActiveLocationContext();

  const { data, error } = await supabase
    .from('product_location_history')
    .select('id, position_x, position_y, accuracy, created_at, product_type, sub_inventory')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error };
  }

  // Get all unique load names for color mapping
  const loadNames = Array.from(
    new Set(
      (data as ProductLocationHistory[])
        .map((item) => item.sub_inventory)
        .filter((name): name is string => name != null)
    )
  );

  // Map locations with colors
  const locationsWithColors: ProductLocationForMap[] = (data as ProductLocationHistory[]).map((item) => {
    const loadColor = getLoadColorByName(loadNames, item.sub_inventory);

    return {
      id: item.id,
      position_x: item.position_x,
      position_y: item.position_y,
      product_type: item.product_type,
      sub_inventory: item.sub_inventory,
      load_color: loadColor,
      created_at: item.created_at,
      accuracy: item.accuracy,
    };
  });

  return { data: locationsWithColors, error: null };
}

/**
 * Get location history for a specific scanning session
 */
export async function getSessionLocationHistory(
  sessionId: string
): Promise<{
  data: ProductLocationHistory[];
  error: any;
}> {
  const { locationId } = getActiveLocationContext();

  const { data, error } = await supabase
    .from('product_location_history')
    .select('*')
    .eq('location_id', locationId)
    .eq('scanning_session_id', sessionId)
    .order('created_at', { ascending: true });

  return { data: (data as ProductLocationHistory[]) ?? [], error };
}
