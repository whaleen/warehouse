import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';

// findMatchingItemsInSession() removed - use findItemOwningSession() instead

/**
 * Deduplicate items that exist in both ASIS and STA
 * Priority rule: STA wins when both exist for the same serial
 */
export function deduplicateAsisStaItems(items: InventoryItem[]): InventoryItem[] {
  // Group by serial
  const bySerial = new Map<string, InventoryItem[]>();
  for (const item of items) {
    if (!item.serial) continue;
    const existing = bySerial.get(item.serial) || [];
    existing.push(item);
    bySerial.set(item.serial, existing);
  }

  const deduplicated: InventoryItem[] = [];

  // For each serial, if both ASIS and STA exist, keep only STA
  for (const itemsWithSerial of bySerial.values()) {
    if (itemsWithSerial.length === 1) {
      deduplicated.push(itemsWithSerial[0]);
      continue;
    }

    // Check if we have both ASIS and STA
    const staItem = itemsWithSerial.find(i => i.inventory_type === 'STA');
    const asisItem = itemsWithSerial.find(i => i.inventory_type === 'ASIS');

    if (staItem && asisItem) {
      // Both exist - STA wins
      deduplicated.push(staItem);
    } else {
      // No conflict, keep all
      deduplicated.push(...itemsWithSerial);
    }
  }

  // Include items without serials (won't be deduplicated)
  const withoutSerial = items.filter(i => !i.serial);
  deduplicated.push(...withoutSerial);

  return deduplicated;
}

/**
 * Find inventory items by barcode (serial, CSO, or model)
 * Deduplicates ASIS/STA conflicts (STA wins)
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
    .or(`serial.ilike.${trimmedBarcode},cso.ilike.${trimmedBarcode},model.ilike.${trimmedBarcode}`);

  if (error) {
    throw error;
  }

  let matches = (data ?? []) as InventoryItem[];
  if (matches.length === 0) {
    console.log('❌ Barcode not found:', trimmedBarcode, '| Searched: serial/cso/model');
    return { type: 'not_found' };
  }

  console.log('✅ Found', matches.length, 'match(es) for:', trimmedBarcode);

  // Deduplicate ASIS/STA conflicts (STA wins)
  matches = deduplicateAsisStaItems(matches);

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
