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
import { updateLoadScanningProgress } from './loadScanningProgress';

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
        maximumAge: 0, // Always request a fresh fix
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
  serial?: string;
  raw_lat: number;
  raw_lng: number;
  accuracy: number;
  scanned_by?: string;
  product_type?: string;
  sub_inventory?: string;
}): Promise<{ success: boolean; error?: unknown; action?: 'created' | 'updated' }> {
  const { locationId, companyId } = getActiveLocationContext();
  const now = new Date().toISOString();
  const isUuid = (value?: string | null) =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

  let resolvedInventoryItemId = isUuid(input.inventory_item_id) ? input.inventory_item_id : null;

  if (!resolvedInventoryItemId && input.serial) {
    const sanitizedSerial = input.serial.trim().replace(/[^A-Za-z0-9]/g, '');
    if (sanitizedSerial) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('location_id', locationId)
        .or(`serial.ilike.${sanitizedSerial},ge_serial.ilike.${sanitizedSerial}`)
        .limit(1)
        .maybeSingle();

      if (!error && data?.id && isUuid(data.id)) {
        resolvedInventoryItemId = data.id;
      }
    }
  }

  const canUpdateExisting = Boolean(resolvedInventoryItemId);

  if (canUpdateExisting) {
    const { data: recent, error: recentError } = await supabase
      .from('product_location_history')
      .select('id, created_at')
      .eq('inventory_item_id', resolvedInventoryItemId ?? null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recentError && recent) {
      const { error } = await supabase
        .from('product_location_history')
        .update({
          position_x: 0,
          position_y: 0,
          position_source: 'gps',
          raw_lat: input.raw_lat,
          raw_lng: input.raw_lng,
          accuracy: input.accuracy,
          scanned_by: input.scanned_by ?? null,
          product_type: input.product_type ?? null,
          sub_inventory: input.sub_inventory ?? null,
          created_at: now,
        })
        .eq('id', recent.id);

      // Update load scanning progress if item is part of a load
      if (!error && input.sub_inventory) {
        updateLoadScanningProgress(input.sub_inventory).catch(err =>
          console.warn('Failed to update load scanning progress:', err)
        );
      }

      return { success: !error, error, action: !error ? 'updated' : undefined };
    }
  }

  // Insert location record
  const { error } = await supabase
    .from('product_location_history')
    .insert({
      company_id: companyId,
      location_id: locationId,
      product_id: input.product_id ?? null,
      inventory_item_id: resolvedInventoryItemId ?? null,
      scanning_session_id: null,
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

  // Update load scanning progress if item is part of a load
  if (!error && input.sub_inventory) {
    updateLoadScanningProgress(input.sub_inventory).catch(err =>
      console.warn('Failed to update load scanning progress:', err)
    );
  }

  return { success: !error, error, action: !error ? 'created' : undefined };
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
  const adHocSubInventoryName = 'Ad-hoc Scan';

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
      sub_inventory: string | null;
      inventory_type: string | null;
      inventory_bucket: string | null;
      inventory_state: string | null;
      source_type: string | null;
    }
  >();
  if (inventoryItemIds.length > 0) {
    // Batch queries to avoid URL length limits (max ~100 IDs per request)
    const batchSize = 100;
    for (let i = 0; i < inventoryItemIds.length; i += batchSize) {
      const batch = inventoryItemIds.slice(i, i + batchSize);
      const { data: inventoryItems, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('id, model, serial, product_type, product_fk, sub_inventory, inventory_type, inventory_bucket, inventory_state, source_type')
        .in('id', batch);

      if (!inventoryError && inventoryItems) {
        for (const item of inventoryItems as {
          id: string;
          model: string | null;
          serial: string | null;
          product_type: string | null;
          product_fk: string | null;
          sub_inventory: string | null;
          inventory_type: string | null;
          inventory_bucket: string | null;
          inventory_state: string | null;
          source_type: string | null;
        }[]) {
          inventoryItemById.set(item.id, item);
        }
      }
    }
  }

  const staleLocationIds: string[] = [];
  for (const item of data as ProductLocationHistory[]) {
    const hasInventoryId = Boolean(item.inventory_item_id);
    if (hasInventoryId) {
      if (!inventoryItemById.has(item.inventory_item_id as string)) {
        staleLocationIds.push(item.id);
      }
      continue;
    }

    const subInventory = item.sub_inventory ?? null;
    if (subInventory !== adHocSubInventoryName) {
      staleLocationIds.push(item.id);
    }
  }

  if (staleLocationIds.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < staleLocationIds.length; i += chunkSize) {
      const chunk = staleLocationIds.slice(i, i + chunkSize);
      await supabase
        .from('product_location_history')
        .delete()
        .eq('location_id', locationId)
        .in('id', chunk);
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
    // Batch queries to avoid URL length limits
    const batchSize = 100;
    for (let i = 0; i < allProductIds.length; i += batchSize) {
      const batch = allProductIds.slice(i, i + batchSize);
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, model, product_type, image_url')
        .in('id', batch);

      if (!productError && products) {
        for (const product of products as { id: string; model: string | null; product_type: string | null; image_url: string | null }[]) {
          productById.set(product.id, product);
          if (product.model) {
            productByModel.set(product.model, product);
          }
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
    // Batch queries to avoid URL length limits
    const batchSize = 100;
    for (let i = 0; i < modelsFromInventory.length; i += batchSize) {
      const batch = modelsFromInventory.slice(i, i + batchSize);
      const { data: productsByModel, error: productsByModelError } = await supabase
        .from('products')
        .select('id, model, product_type, image_url')
        .in('model', batch);

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
  }

  const resolveSubInventory = (item: ProductLocationHistory) => {
    const inventoryItem = item.inventory_item_id ? inventoryItemById.get(item.inventory_item_id) : undefined;
    return inventoryItem?.sub_inventory ?? item.sub_inventory;
  };

  // Get all unique load names for color mapping
  const loadNames = Array.from(
    new Set(
      (data as ProductLocationHistory[])
        .map((item) => resolveSubInventory(item))
        .filter((name): name is string => name != null)
    )
  ).sort((a, b) => a.localeCompare(b));

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

  const loadMetadataByName = new Map<string, { friendly_name: string | null; primary_color: string | null; inventory_type: string | null }>();
  if (loadNames.length > 0) {
    const { data: loadMetadata, error: loadError } = await supabase
      .from('load_metadata')
      .select('sub_inventory_name, friendly_name, primary_color, inventory_type')
      .eq('location_id', locationId)
      .in('sub_inventory_name', loadNames);

    if (!loadError && loadMetadata) {
      for (const load of loadMetadata as { sub_inventory_name: string; friendly_name: string | null; primary_color: string | null; inventory_type: string | null }[]) {
        loadMetadataByName.set(load.sub_inventory_name, {
          friendly_name: load.friendly_name,
          primary_color: load.primary_color,
          inventory_type: load.inventory_type,
        });
      }
    }
  }

  // Map locations with colors
  const locationsWithColors: ProductLocationForMap[] = (data as ProductLocationHistory[])
    .filter((item) => {
      if (item.inventory_item_id) {
        return inventoryItemById.has(item.inventory_item_id);
      }
      return item.sub_inventory === adHocSubInventoryName;
    })
    .map((item) => {
    const inventoryItem = item.inventory_item_id ? inventoryItemById.get(item.inventory_item_id) : undefined;
    const resolvedSubInventory = inventoryItem?.sub_inventory ?? item.sub_inventory;
    const loadMeta = resolvedSubInventory ? loadMetadataByName.get(resolvedSubInventory) : null;
    const loadColor = loadMeta?.primary_color || getLoadColorByName(loadNames, resolvedSubInventory ?? null);
    const loadFriendlyName = loadMeta?.friendly_name ?? null;
    const resolvedProductId = item.product_id ?? inventoryItem?.product_fk ?? null;
    const product =
      (resolvedProductId ? productById.get(resolvedProductId) : undefined) ??
      (inventoryItem?.model ? productByModel.get(inventoryItem.model) : undefined);
    const model = inventoryItem?.model ?? product?.model ?? null;
    const serial = inventoryItem?.serial ?? null;
    const productType = item.product_type ?? inventoryItem?.product_type ?? product?.product_type ?? null;
    const imageUrl = product?.image_url ?? null;
    const loadItemCount = resolvedSubInventory ? loadItemCounts.get(resolvedSubInventory) ?? null : null;

    const finalInventoryType = inventoryItem?.inventory_type ?? loadMeta?.inventory_type ?? null;
    const finalInventoryBucket = inventoryItem?.inventory_bucket ?? loadMeta?.inventory_type ?? inventoryItem?.inventory_type ?? null;
    const finalInventoryState = inventoryItem?.inventory_state ?? null;
    const finalSourceType = inventoryItem?.source_type ?? null;

    return {
      id: item.id,
      position_x: item.position_x,
      position_y: item.position_y,
      raw_lat: item.raw_lat != null ? Number(item.raw_lat) : null,
      raw_lng: item.raw_lng != null ? Number(item.raw_lng) : null,
      inventory_item_id: item.inventory_item_id,
      inventory_type: finalInventoryType,
      inventory_bucket: finalInventoryBucket,
      inventory_state: finalInventoryState,
      source_type: finalSourceType,
      image_url: imageUrl,
      load_item_count: loadItemCount,
      product_type: productType,
      model,
      serial,
      sub_inventory: resolvedSubInventory ?? null,
      load_friendly_name: loadFriendlyName,
      load_color: loadColor,
      created_at: item.created_at,
      accuracy: item.accuracy,
      scanning_session_id: item.scanning_session_id,
      // owning_session_id removed - no permanent session ownership
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
