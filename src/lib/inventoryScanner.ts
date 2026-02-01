import supabase from './supabase';
import { getActiveLocationContext } from './tenant';
import type { InventoryItem, ScanResult } from '@/types/inventory';

/**
 * Search for items matching the scanned barcode across entire inventory
 * Used for fog of war mode to validate scans against known inventory
 */
export async function findMatchingItemsInInventory(
  barcode: string
): Promise<ScanResult> {
  const trimmedBarcode = barcode.trim();

  if (!trimmedBarcode) {
    return { type: 'not_found' };
  }

  const { locationId } = getActiveLocationContext();
  if (!locationId) {
    throw new Error('No active location selected');
  }

  // Search across serial, CSO, and model
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, products(*)')
    .eq('location_id', locationId)
    .or(`serial.eq.${trimmedBarcode},cso.eq.${trimmedBarcode},model.eq.${trimmedBarcode}`);

  if (error) {
    console.error('Inventory search error:', error);
    throw error;
  }

  const matches = (data ?? []) as InventoryItem[];

  if (matches.length === 0) {
    return { type: 'not_found' };
  }

  // Determine which field matched
  const serialMatch = matches.filter(item => item.serial === trimmedBarcode);
  const csoMatch = matches.filter(item => item.cso === trimmedBarcode);
  const modelMatch = matches.filter(item => item.model === trimmedBarcode);

  // Serial matches should be unique
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

  // Model can have many items - this is the ambiguous case
  if (modelMatch.length > 0) {
    return {
      type: 'multiple',
      items: modelMatch,
      matchedField: 'model'
    };
  }

  // Multiple serial matches (rare/error case)
  if (serialMatch.length > 1) {
    return {
      type: 'multiple',
      items: serialMatch,
      matchedField: 'serial'
    };
  }

  return { type: 'not_found' };
}
