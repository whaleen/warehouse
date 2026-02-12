import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';

// findMatchingItemsInSession() removed - use findItemOwningSession() instead

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

  const sanitizedBarcode = trimmedBarcode.replace(/[^A-Za-z0-9]/g, '');
  const modelQuery = trimmedBarcode.includes(',') ? sanitizedBarcode : trimmedBarcode;

  const { locationId } = getActiveLocationContext();
  if (!locationId) {
    throw new Error('No active location selected');
  }

  const resolveMatches = (matches: InventoryItem[], matchedField: 'serial' | 'cso' | 'model'): ItemMatchResult => {
    if (matches.length === 0) return { type: 'not_found' };

    if (matches.length === 1) {
      return { type: 'unique', item: matches[0], matchedField };
    }

    return { type: 'multiple', items: matches, matchedField };
  };

  if (sanitizedBarcode) {
    const { data: serialMatches, error: serialError } = await supabase
      .from('inventory_items')
      .select('*, products(*)')
      .eq('location_id', locationId)
      .or(`serial.ilike.${sanitizedBarcode},ge_serial.ilike.${sanitizedBarcode}`);

    if (serialError) {
      throw serialError;
    }

    if (serialMatches && serialMatches.length > 0) {
      return resolveMatches(serialMatches as InventoryItem[], 'serial');
    }
  }

  if (!trimmedBarcode.includes(',')) {
    const { data: serialMatches, error: serialError } = await supabase
      .from('inventory_items')
      .select('*, products(*)')
      .eq('location_id', locationId)
      .or(`serial.ilike.${trimmedBarcode},ge_serial.ilike.${trimmedBarcode}`);

    if (serialError) {
      throw serialError;
    }

    if (serialMatches && serialMatches.length > 0) {
      return resolveMatches(serialMatches as InventoryItem[], 'serial');
    }
  }

  if (sanitizedBarcode) {
    const { data: csoMatches, error: csoError } = await supabase
      .from('inventory_items')
      .select('*, products(*)')
      .eq('location_id', locationId)
      .ilike('cso', sanitizedBarcode);

    if (csoError) {
      throw csoError;
    }

    if (csoMatches && csoMatches.length > 0) {
      return resolveMatches(csoMatches as InventoryItem[], 'cso');
    }
  }

  if (modelQuery) {
    const { data: modelMatches, error: modelError } = await supabase
      .from('inventory_items')
      .select('*, products(*)')
      .eq('location_id', locationId)
      .or(`model.ilike.${modelQuery},ge_model.ilike.${modelQuery}`);

    if (modelError) {
      throw modelError;
    }

    if (modelMatches && modelMatches.length > 0) {
      return resolveMatches(modelMatches as InventoryItem[], 'model');
    }
  }

  return { type: 'not_found' };
}
