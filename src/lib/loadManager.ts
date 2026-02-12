import supabase from './supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type { LoadMetadata, LoadWithItems, InventoryType, LoadStatus, InventoryItem, LoadConflict, SanityCheckParameters } from '@/types/inventory';
import { getActiveLocationContext } from '@/lib/tenant';

/**
 * Map main inventory types to their database sub-types
 * Note: Parts NEVER use loads, so Parts is not included here
 */
function getInventoryTypes(mainType: InventoryType): InventoryType[] {
  switch (mainType) {
    case 'FG':
      return ['FG', 'BackHaul'];
    case 'LocalStock':
      return ['LocalStock', 'Staged', 'STA', 'Inbound', 'WillCall'];
    case 'ASIS':
      return ['ASIS'];
    default:
      return [mainType];
  }
}

/**
 * Merge multiple loads into one (updates items to target, deletes source metadata)
 */
export async function mergeLoads(
  inventoryType: InventoryType,
  sourceNames: string[],
  targetName: string
): Promise<{ success: boolean; error?: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();

  // Update all items from source loads to target
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ sub_inventory: targetName, updated_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .in('sub_inventory', sourceNames);

  if (updateError) {
    return { success: false, error: updateError };
  }

  // Delete source metadata records
  const { error: deleteError } = await supabase
    .from('load_metadata')
    .delete()
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .in('sub_inventory_name', sourceNames);

  return { success: !deleteError, error: deleteError };
}

/**
 * Update load status
 */
export async function updateLoadStatus(
  inventoryType: InventoryType,
  subInventoryName: string,
  newStatus: LoadStatus
): Promise<{ success: boolean; error?: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { error } = await supabase
    .from('load_metadata')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', subInventoryName);

  return { success: !error, error };
}

/**
 * Update load metadata (category, notes, etc.)
 */
export async function updateLoadMetadata(
  inventoryType: InventoryType,
  subInventoryName: string,
  updates: {
    category?: string | null;
    notes?: string | null;
    friendly_name?: string | null;
    primary_color?: string | null;
    prep_tagged?: boolean;
    prep_wrapped?: boolean;
    sanity_check_requested?: boolean | null;
    sanity_check_requested_at?: string | null;
    sanity_check_requested_by?: string | null;
    sanity_check_stage?: 'early' | 'final' | null;
    sanity_check_parameters?: SanityCheckParameters | null;
    sanity_check_completed_at?: string | null;
    sanity_check_completed_by?: string | null;
    sanity_last_checked_at?: string | null;
    sanity_last_checked_by?: string | null;
    pickup_date?: string | null;
    pickup_tba?: boolean;
  }
): Promise<{ success: boolean; error?: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { error } = await supabase
    .from('load_metadata')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', subInventoryName);

  return { success: !error, error };
}

/**
 * Get load with all its items
 */
export async function getLoadWithItems(
  inventoryType: InventoryType,
  subInventoryName: string
): Promise<{ data: LoadWithItems | null; error: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  // Fetch metadata
  const { data: metadata, error: metadataError } = await supabase
    .from('load_metadata')
    .select('*')
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', subInventoryName)
    .single();

  if (metadataError || !metadata) {
    return { data: null, error: metadataError };
  }

  // Fetch items
  const inventoryTypes = getInventoryTypes(inventoryType);
  let itemsQuery = supabase
    .from('inventory_items')
    .select(`
      *,
      products:product_fk (
        id, model, product_type, brand, description, image_url, price
      )
    `)
    .eq('location_id', locationId)
    .eq('sub_inventory', subInventoryName)
    .order('created_at', { ascending: false });

  if (inventoryTypes.length === 1) {
    itemsQuery = itemsQuery.eq('inventory_type', inventoryTypes[0]);
  } else {
    itemsQuery = itemsQuery.in('inventory_type', inventoryTypes);
  }

  const { data: items, error: itemsError } = await itemsQuery;


  if (itemsError) {
    return { data: null, error: itemsError };
  }

  return {
    data: {
      metadata: metadata as LoadMetadata,
      items: (items || []) as InventoryItem[],
      item_count: items?.length || 0
    },
    error: null
  };
}

/**
 * Get all loads, optionally filtered by inventory type
 * Returns metadata with item counts
 * @param inventoryType - Filter by inventory type
 * @param includeDelivered - Include delivered loads (default: false)
 */
export async function getAllLoads(
  inventoryType?: InventoryType,
  includeDelivered = false
): Promise<{ data: LoadMetadata[] | null; error: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  let query = supabase
    .from('load_metadata')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (inventoryType) {
    const types = getInventoryTypes(inventoryType);
    if (types.length === 1) {
      query = query.eq('inventory_type', types[0]);
    } else {
      query = query.in('inventory_type', types);
    }
  }

  // Exclude delivered loads by default (loads no longer in the building)
  if (!includeDelivered) {
    query = query.or('ge_cso_status.is.null,ge_cso_status.neq.Delivered');
  }

  const { data, error } = await query;

  return { data, error };
}

/**
 * Get item count for a load
 */
export async function getLoadItemCount(
  inventoryType: InventoryType,
  subInventoryName: string
): Promise<{ count: number; error: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { count, error } = await supabase
    .from('inventory_items')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory', subInventoryName);

  return { count: count || 0, error };
}

export async function getLoadConflictCount(
  inventoryType: InventoryType,
  loadNumber: string
): Promise<{ count: number; error: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { count, error } = await supabase
    .from('load_conflicts')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .eq('load_number', loadNumber)
    .eq('status', 'open');

  return { count: count || 0, error };
}

export async function getLoadConflicts(
  inventoryType: InventoryType,
  loadNumber: string
): Promise<{ data: LoadConflict[]; error: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from('load_conflicts')
    .select('*')
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .eq('load_number', loadNumber)
    .order('detected_at', { ascending: false });

  return { data: data ?? [], error };
}

// REMOVED: getBatchLoadItemCounts and getBatchLoadConflictCounts
// These functions were inefficient - they fetched ALL rows to count them
// Instead, use items_total_count from load_metadata (already populated by GE sync)

/**
 * Delete a load (metadata only - items remain but with null sub_inventory)
 */
export async function deleteLoad(
  inventoryType: InventoryType,
  subInventoryName: string,
  clearItems = false
): Promise<{ success: boolean; error?: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  // Optionally clear sub_inventory from items
  if (clearItems) {
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ sub_inventory: null, updated_at: new Date().toISOString() })
      .eq('location_id', locationId)
      .eq('inventory_type', inventoryType)
      .eq('sub_inventory', subInventoryName);

    if (updateError) {
      return { success: false, error: updateError };
    }
  }

  // Delete metadata
  const { error } = await supabase
    .from('load_metadata')
    .delete()
    .eq('location_id', locationId)
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', subInventoryName);

  return { success: !error, error };
}
