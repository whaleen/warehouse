import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';

// findMatchingItemsInSession() removed - use findItemOwningSession() instead

/**
 * Find inventory items by barcode (serial, CSO, or model)
 * No ownership tracking - just finds matching items
 */
export type ItemMatchResult =
  | { type: 'not_found' }
  | {
      type: 'unique';
      item: InventoryItem;
      matchedField: 'serial' | 'cso' | 'model';
    }
  | {
      type: 'multiple';
      items: InventoryItem[];
      matchedField: 'serial' | 'cso' | 'model';
    };

export async function findItemOwningSession(barcode: string): Promise<ItemMatchResult> {
  const trimmedBarcode = barcode.trim();
  if (!trimmedBarcode) {
    return { type: 'not_found' };
  }

  const { locationId } = getActiveLocationContext();
  if (!locationId) {
    throw new Error('No active location selected');
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, products(*)')
    .eq('location_id', locationId)
    .or(`serial.eq.${trimmedBarcode},cso.eq.${trimmedBarcode},model.eq.${trimmedBarcode}`);

  if (error) {
    throw error;
  }

  const matches = (data ?? []) as InventoryItem[];
  if (matches.length === 0) {
    return { type: 'not_found' };
  }

  const serialMatch = matches.filter(item => item.serial === trimmedBarcode);
  const csoMatch = matches.filter(item => item.cso === trimmedBarcode);
  const modelMatch = matches.filter(item => item.model === trimmedBarcode);

  // Serial matches are typically unique
  if (serialMatch.length === 1) {
    return { type: 'unique', item: serialMatch[0], matchedField: 'serial' };
  }

  // CSO can have multiple items
  if (csoMatch.length > 0) {
    if (csoMatch.length === 1) {
      return { type: 'unique', item: csoMatch[0], matchedField: 'cso' };
    }
    return { type: 'multiple', items: csoMatch, matchedField: 'cso' };
  }

  // Model can have many items
  if (modelMatch.length > 0) {
    if (modelMatch.length === 1) {
      return { type: 'unique', item: modelMatch[0], matchedField: 'model' };
    }
    return { type: 'multiple', items: modelMatch, matchedField: 'model' };
  }

  // Serial match but multiple items (rare case)
  if (serialMatch.length > 1) {
    return { type: 'multiple', items: serialMatch, matchedField: 'serial' };
  }

  return { type: 'not_found' };
}
