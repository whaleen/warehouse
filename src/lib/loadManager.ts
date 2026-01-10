import supabase from './supabase';
import type { LoadMetadata, LoadWithItems, InventoryType, LoadStatus, InventoryItem } from '@/types/inventory';

/**
 * Map main inventory types to their database sub-types
 * Note: Parts NEVER use loads, so Parts is not included here
 */
function getInventoryTypes(mainType: InventoryType): InventoryType[] {
  switch (mainType) {
    case 'FG':
      return ['FG', 'BackHaul'];
    case 'LocalStock':
      return ['LocalStock', 'Staged', 'Inbound', 'WillCall'];
    case 'ASIS':
      return ['ASIS'];
    default:
      return [mainType];
  }
}

/**
 * Create a new load (metadata record)
 */
export async function createLoad(
  inventoryType: InventoryType,
  subInventoryName: string,
  notes?: string,
  createdBy?: string,
  category?: string
): Promise<{ data: LoadMetadata | null; error: any }> {
  const { data, error } = await supabase
    .from('load_metadata')
    .insert({
      inventory_type: inventoryType,
      sub_inventory_name: subInventoryName,
      status: 'active' as LoadStatus,
      category,
      notes,
      created_by: createdBy
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Rename a load (updates metadata and all items with that sub_inventory)
 */
export async function renameLoad(
  inventoryType: InventoryType,
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: any }> {
  // Check if new name already exists
  const { data: existing } = await supabase
    .from('load_metadata')
    .select('id')
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', newName)
    .single();

  if (existing) {
    return { success: false, error: 'Load name already exists for this inventory type' };
  }

  // Update metadata
  const { error: metadataError } = await supabase
    .from('load_metadata')
    .update({ sub_inventory_name: newName, updated_at: new Date().toISOString() })
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', oldName);

  if (metadataError) {
    return { success: false, error: metadataError };
  }

  // Update all items with this sub_inventory
  const { error: itemsError } = await supabase
    .from('inventory_items')
    .update({ sub_inventory: newName, updated_at: new Date().toISOString() })
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory', oldName);

  return { success: !itemsError, error: itemsError };
}

/**
 * Merge multiple loads into one (updates items to target, deletes source metadata)
 */
export async function mergeLoads(
  inventoryType: InventoryType,
  sourceNames: string[],
  targetName: string,
  createTarget = false
): Promise<{ success: boolean; error?: any }> {
  // Create target load if needed
  if (createTarget) {
    const { error: createError } = await createLoad(inventoryType, targetName);
    if (createError) {
      return { success: false, error: createError };
    }
  }

  // Update all items from source loads to target
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ sub_inventory: targetName, updated_at: new Date().toISOString() })
    .eq('inventory_type', inventoryType)
    .in('sub_inventory', sourceNames);

  if (updateError) {
    return { success: false, error: updateError };
  }

  // Delete source metadata records
  const { error: deleteError } = await supabase
    .from('load_metadata')
    .delete()
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
): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase
    .from('load_metadata')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
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
  updates: { category?: string; notes?: string }
): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase
    .from('load_metadata')
    .update({ ...updates, updated_at: new Date().toISOString() })
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
): Promise<{ data: LoadWithItems | null; error: any }> {
  // Fetch metadata
  const { data: metadata, error: metadataError } = await supabase
    .from('load_metadata')
    .select('*')
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', subInventoryName)
    .single();

  if (metadataError || !metadata) {
    return { data: null, error: metadataError };
  }

  // Fetch items
  const { data: items, error: itemsError } = await supabase
    .from('inventory_items')
    .select(`
      *,
      products:product_fk (
        id, model, product_type, brand, description, image_url, price
      )
    `)
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory', subInventoryName)
    .order('created_at', { ascending: false });

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
 */
export async function getAllLoads(
  inventoryType?: InventoryType
): Promise<{ data: LoadMetadata[] | null; error: any }> {
  let query = supabase
    .from('load_metadata')
    .select('*')
    .order('created_at', { ascending: false });

  if (inventoryType) {
    const types = getInventoryTypes(inventoryType);
    if (types.length === 1) {
      query = query.eq('inventory_type', types[0]);
    } else {
      query = query.in('inventory_type', types);
    }
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
): Promise<{ count: number; error: any }> {
  const { count, error } = await supabase
    .from('inventory_items')
    .select('*', { count: 'exact', head: true })
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory', subInventoryName);

  return { count: count || 0, error };
}

/**
 * Delete a load (metadata only - items remain but with null sub_inventory)
 */
export async function deleteLoad(
  inventoryType: InventoryType,
  subInventoryName: string,
  clearItems = false
): Promise<{ success: boolean; error?: any }> {
  // Optionally clear sub_inventory from items
  if (clearItems) {
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ sub_inventory: null, updated_at: new Date().toISOString() })
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
    .eq('inventory_type', inventoryType)
    .eq('sub_inventory_name', subInventoryName);

  return { success: !error, error };
}
