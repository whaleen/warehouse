/**
 * Map Manager - Fog of War positioning system
 *
 * Handles GPS positioning and map data access.
 * Stores raw GPS coordinates for map visualization.
 */

import supabase from './supabase';
import { getActiveLocationContext } from './tenant';
import type { RawGPSPosition, ProductLocationHistory, ProductLocationForMap } from '@/types/map';
import { getLoadColorByName } from './loadColors';

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
        console.log('✅ Position acquired:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.error('❌ Geolocation error:', {
          code: error.code,
          message: error.message,
          PERMISSION_DENIED: error.code === 1,
          POSITION_UNAVAILABLE: error.code === 2,
          TIMEOUT: error.code === 3
        });
        resolve(null);
      },
      {
        enableHighAccuracy: true, // Use GPS on phones for best accuracy
        timeout: 10000, // 10 second timeout (plenty for phones with GPS)
        maximumAge: 5000, // Use positions up to 5 seconds old
      }
    );
  });
}

/**
 * Log product location during scan
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
}): Promise<{ success: boolean; error?: unknown }> {
  const { locationId, companyId } = getActiveLocationContext();

  // Insert location record
  const { error } = await supabase
    .from('product_location_history')
    .insert({
      company_id: companyId,
      location_id: locationId,
      product_id: input.product_id ?? null,
      inventory_item_id: input.inventory_item_id ?? null,
      scanning_session_id: input.scanning_session_id,
      position_x: 0,
      position_y: 0,
      position_source: 'gps',
      raw_lat: input.raw_lat,
      raw_lng: input.raw_lng,
      accuracy: input.accuracy,
      scanned_by: input.scanned_by ?? null,
      product_type: input.product_type ?? null,
      sub_inventory: input.sub_inventory ?? null,
    });

  return { success: !error, error };
}

/**
 * Get all product locations for map display
 * Returns positions with load colors for visualization
 */
export async function getProductLocations(): Promise<{
  data: ProductLocationForMap[];
  error: unknown;
}> {
  const { locationId } = getActiveLocationContext();

  const { data, error } = await supabase
    .from('product_location_history')
    .select('id, position_x, position_y, raw_lat, raw_lng, accuracy, created_at, product_type, sub_inventory, inventory_item_id, product_id, scanning_session_id')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error };
  }

  const inventoryItemIds = Array.from(
    new Set((data as ProductLocationHistory[]).map((item) => item.inventory_item_id).filter(Boolean))
  ) as string[];

  const productIds = Array.from(
    new Set((data as ProductLocationHistory[]).map((item) => item.product_id).filter(Boolean))
  ) as string[];

  const inventoryItemById = new Map<
    string,
    {
      model: string | null;
      serial: string | null;
      product_type: string | null;
      product_fk: string | null;
    }
  >();
  if (inventoryItemIds.length > 0) {
    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('id, model, serial, product_type, product_fk')
      .in('id', inventoryItemIds);

    if (!inventoryError && inventoryItems) {
      for (const item of inventoryItems as {
        id: string;
        model: string | null;
        serial: string | null;
        product_type: string | null;
        product_fk: string | null;
      }[]) {
        inventoryItemById.set(item.id, item);
      }
    }
  }

  const productById = new Map<string, { model: string | null; product_type: string | null; image_url: string | null }>();
  const productByModel = new Map<string, { id: string; model: string | null; product_type: string | null; image_url: string | null }>();

  const productIdsFromInventory = Array.from(
    new Set(
      (Array.from(inventoryItemById.values()).map((item) => item.product_fk).filter(Boolean)) as string[]
    )
  );

  const allProductIds = Array.from(new Set([...productIds, ...productIdsFromInventory]));
  if (allProductIds.length > 0) {
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, model, product_type, image_url')
      .in('id', allProductIds);

    if (!productError && products) {
      for (const product of products as { id: string; model: string | null; product_type: string | null; image_url: string | null }[]) {
        productById.set(product.id, product);
        if (product.model) {
          productByModel.set(product.model, product);
        }
      }
    }
  }

  const modelsFromInventory = Array.from(
    new Set(
      (Array.from(inventoryItemById.values())
        .map((item) => item.model)
        .filter((model): model is string => Boolean(model)))
    )
  );

  if (modelsFromInventory.length > 0) {
    const { data: productsByModel, error: productsByModelError } = await supabase
      .from('products')
      .select('id, model, product_type, image_url')
      .in('model', modelsFromInventory);

    if (!productsByModelError && productsByModel) {
      for (const product of productsByModel as { id: string; model: string | null; product_type: string | null; image_url: string | null }[]) {
        if (!productById.has(product.id)) {
          productById.set(product.id, product);
        }
        if (product.model) {
          productByModel.set(product.model, product);
        }
      }
    }
  }

  // Get all unique load names for color mapping
  const loadNames = Array.from(
    new Set(
      (data as ProductLocationHistory[])
        .map((item) => item.sub_inventory)
        .filter((name): name is string => name != null)
    )
  );

  const loadItemCounts = new Map<string, number>();
  if (loadNames.length > 0) {
    const { data: loadItems, error: loadItemsError } = await supabase
      .from('inventory_items')
      .select('sub_inventory')
      .eq('location_id', locationId)
      .in('sub_inventory', loadNames);

    if (!loadItemsError && loadItems) {
      for (const item of loadItems as { sub_inventory: string | null }[]) {
        if (!item.sub_inventory) continue;
        loadItemCounts.set(item.sub_inventory, (loadItemCounts.get(item.sub_inventory) ?? 0) + 1);
      }
    }
  }

  const loadMetadataByName = new Map<string, { friendly_name: string | null }>();
  if (loadNames.length > 0) {
    const { data: loadMetadata, error: loadError } = await supabase
      .from('load_metadata')
      .select('sub_inventory_name, friendly_name')
      .eq('location_id', locationId)
      .in('sub_inventory_name', loadNames);

    if (!loadError && loadMetadata) {
      for (const load of loadMetadata as { sub_inventory_name: string; friendly_name: string | null }[]) {
        loadMetadataByName.set(load.sub_inventory_name, { friendly_name: load.friendly_name });
      }
    }
  }

  // Map locations with colors
  const locationsWithColors: ProductLocationForMap[] = (data as ProductLocationHistory[]).map((item) => {
    const loadColor = getLoadColorByName(loadNames, item.sub_inventory);
    const loadFriendlyName = item.sub_inventory
      ? loadMetadataByName.get(item.sub_inventory)?.friendly_name ?? null
      : null;
    const inventoryItem = item.inventory_item_id ? inventoryItemById.get(item.inventory_item_id) : undefined;
    const resolvedProductId = item.product_id ?? inventoryItem?.product_fk ?? null;
    const product =
      (resolvedProductId ? productById.get(resolvedProductId) : undefined) ??
      (inventoryItem?.model ? productByModel.get(inventoryItem.model) : undefined);
    const model = inventoryItem?.model ?? product?.model ?? null;
    const serial = inventoryItem?.serial ?? null;
    const productType = item.product_type ?? inventoryItem?.product_type ?? product?.product_type ?? null;
    const imageUrl = product?.image_url ?? null;
    const loadItemCount = item.sub_inventory ? loadItemCounts.get(item.sub_inventory) ?? null : null;

    return {
      id: item.id,
      position_x: item.position_x,
      position_y: item.position_y,
      raw_lat: item.raw_lat != null ? Number(item.raw_lat) : null,
      raw_lng: item.raw_lng != null ? Number(item.raw_lng) : null,
      image_url: imageUrl,
      load_item_count: loadItemCount,
      product_type: productType,
      model,
      serial,
      sub_inventory: item.sub_inventory,
      load_friendly_name: loadFriendlyName,
      load_color: loadColor,
      created_at: item.created_at,
      accuracy: item.accuracy,
      scanning_session_id: item.scanning_session_id,
    };
  });

  return { data: locationsWithColors, error: null };
}

export async function deleteProductLocation(locationId: string): Promise<{ error?: unknown }> {
  const { locationId: activeLocationId } = getActiveLocationContext();

  const { error } = await supabase
    .from('product_location_history')
    .delete()
    .eq('id', locationId)
    .eq('location_id', activeLocationId);

  return { error };
}

/**
 * Get location history for a specific scanning session
 */
export async function getSessionLocationHistory(
  sessionId: string
): Promise<{
  data: ProductLocationHistory[];
  error: unknown;
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
