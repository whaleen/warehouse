import supabase from './supabase';
import type { InventoryItem, ScanResult } from '@/types/inventory';

/**
 * Search for inventory items matching the scanned barcode
 * Searches across serial, CSO, and model fields simultaneously
 */
export async function findMatchingItems(
  barcode: string,
  inventoryType?: string
): Promise<ScanResult> {
  const trimmedBarcode = barcode.trim();

  if (!trimmedBarcode) {
    return { type: 'not_found' };
  }

  try {
    // Build query
    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('is_scanned', false); // Only search unscanned items

    // Filter by inventory type if provided
    if (inventoryType) {
      query = query.eq('inventory_type', inventoryType);
    }

    // Search across all three fields using OR logic
    query = query.or(
      `serial.eq.${trimmedBarcode},cso.eq.${trimmedBarcode},model.eq.${trimmedBarcode}`
    );

    const { data, error } = await query;

    if (error) {
      console.error('Error searching for items:', error);
      return { type: 'not_found' };
    }

    if (!data || data.length === 0) {
      return { type: 'not_found' };
    }

    // Determine which field matched
    const serialMatch = data.filter(item => item.serial === trimmedBarcode);
    const csoMatch = data.filter(item => item.cso === trimmedBarcode);
    const modelMatch = data.filter(item => item.model === trimmedBarcode);

    // Serial matches are typically unique
    if (serialMatch.length === 1) {
      return {
        type: 'unique',
        items: serialMatch,
        matchedField: 'serial'
      };
    }

    // CSO can have multiple items
    if (csoMatch.length > 0) {
      return {
        type: csoMatch.length === 1 ? 'unique' : 'multiple',
        items: csoMatch,
        matchedField: 'cso'
      };
    }

    // Model can have many items
    if (modelMatch.length > 0) {
      return {
        type: modelMatch.length === 1 ? 'unique' : 'multiple',
        items: modelMatch,
        matchedField: 'model'
      };
    }

    // Serial match but multiple items (rare case)
    if (serialMatch.length > 1) {
      return {
        type: 'multiple',
        items: serialMatch,
        matchedField: 'serial'
      };
    }

    return { type: 'not_found' };
  } catch (err) {
    console.error('Error in findMatchingItems:', err);
    return { type: 'not_found' };
  }
}

/**
 * Mark an inventory item as scanned
 */
export async function markItemAsScanned(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('inventory_items')
      .update({
        is_scanned: true,
        scanned_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (error) {
      console.error('Error marking item as scanned:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in markItemAsScanned:', err);
    return false;
  }
}

/**
 * Mark multiple items as scanned
 */
export async function markItemsAsScanned(itemIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('inventory_items')
      .update({
        is_scanned: true,
        scanned_at: new Date().toISOString()
      })
      .in('id', itemIds);

    if (error) {
      console.error('Error marking items as scanned:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in markItemsAsScanned:', err);
    return false;
  }
}
