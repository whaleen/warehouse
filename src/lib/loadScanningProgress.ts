/**
 * Load Scanning Progress Tracking
 *
 * Automatically updates scanning progress counts when items are scanned/mapped
 * Note: Query invalidation is handled automatically by RealtimeContext subscriptions
 */

import supabase from './supabase';
import { getActiveLocationContext } from './tenant';

/**
 * Update scanning progress for a load after scanning an item
 * Call this after successfully logging a product location
 */
export async function updateLoadScanningProgress(loadName: string): Promise<void> {
  const { locationId } = getActiveLocationContext();
  if (!locationId || !loadName) return;

  try {
    // Get load metadata for ge_units (GE sync is source of truth for totals)
    const { data: loadData, error: loadError } = await supabase
      .from('load_metadata')
      .select('ge_units')
      .eq('location_id', locationId)
      .eq('sub_inventory_name', loadName)
      .single();

    if (loadError) {
      console.error('Failed to get load metadata:', loadError);
      return;
    }

    const totalCount = loadData?.ge_units || 0;

    // Get all items in this load (regardless of inventory_type - items can change type when sold)
    const { data: loadItems, error: itemsError } = await supabase
      .from('inventory_items')
      .select('id, serial, qty')
      .eq('location_id', locationId)
      .eq('sub_inventory', loadName);

    if (itemsError) {
      console.error('Failed to get load items:', itemsError);
      return;
    }

    const loadItemIds = (loadItems || []).map(item => item.id).filter(Boolean);

    if (loadItemIds.length === 0) {
      // No items found - set counts to 0
      const { error: updateError } = await supabase
        .from('load_metadata')
        .update({
          items_scanned_count: 0,
          items_total_count: totalCount,
          scanning_complete: false,
        })
        .eq('location_id', locationId)
        .eq('sub_inventory_name', loadName);

      if (updateError) {
        console.error('Failed to update load scanning progress:', updateError);
      }
      return;
    }

    // Count scanned items (qty-aware for non-serialized items)
    const { data: scannedRows, error: scannedError } = await supabase
      .from('product_location_history')
      .select('inventory_item_id')
      .eq('location_id', locationId)
      .in('inventory_item_id', loadItemIds);

    if (scannedError) {
      console.error('Failed to count scanned items:', scannedError);
      return;
    }

    const scannedIds = new Set((scannedRows || []).map(row => row.inventory_item_id));
    const scannedCount = (loadItems || []).reduce((sum, item) => {
      if (!item.id || !scannedIds.has(item.id)) return sum;
      const isSerialized = Boolean(item.serial && String(item.serial).trim());
      return sum + (isSerialized ? 1 : (item.qty ?? 1));
    }, 0);

    const scanningComplete = totalCount > 0 && scannedCount >= totalCount;

    // Update load metadata
    const { error: updateError } = await supabase
      .from('load_metadata')
      .update({
          items_scanned_count: scannedCount,
        items_total_count: totalCount,
        scanning_complete: scanningComplete,
      })
      .eq('location_id', locationId)
      .eq('sub_inventory_name', loadName);

    if (updateError) {
      console.error('Failed to update load scanning progress:', updateError);
    } else {
      console.log(`✅ Updated scanning progress for ${loadName}: ${scannedCount}/${totalCount}`);
      // UI will auto-refresh via Realtime subscription
    }
  } catch (error) {
    console.error('Error updating load scanning progress:', error);
  }
}

/**
 * Bulk update scanning progress for all loads at a location
 * Useful for recalculating progress after bulk operations
 */
export async function recalculateAllLoadScanningProgress(): Promise<void> {
  const { locationId } = getActiveLocationContext();
  if (!locationId) return;

  try {
    // Get all loads
    const { data: loads, error: loadsError } = await supabase
      .from('load_metadata')
      .select('sub_inventory_name')
      .eq('location_id', locationId);

    if (loadsError) {
      console.error('Failed to fetch loads:', loadsError);
      return;
    }

    // Update each load
    for (const load of loads || []) {
      await updateLoadScanningProgress(load.sub_inventory_name);
    }

    console.log(`✅ Recalculated scanning progress for ${loads?.length || 0} loads`);
    // UI will auto-refresh via Realtime subscriptions
  } catch (error) {
    console.error('Error recalculating load scanning progress:', error);
  }
}
