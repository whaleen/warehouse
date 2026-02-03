import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem, ScanResult } from '@/types/inventory';
import type { ScanningSession } from '@/types/session';

/**
 * Search for items matching the scanned barcode within a session
 * Only searches items in the current session
 */
export function findMatchingItemsInSession(
  barcode: string,
  session: ScanningSession
): ScanResult {
  const trimmedBarcode = barcode.trim();

  if (!trimmedBarcode) {
    return { type: 'not_found' };
  }

  // Only search unscanned items in this session
  const unscannedItems = session.items.filter(
    item => !session.scannedItemIds.includes(item.id!)
  );

  if (unscannedItems.length === 0) {
    return { type: 'not_found' };
  }

  // Search across serial, CSO, and model
  const matches = unscannedItems.filter(item =>
    item.serial === trimmedBarcode ||
    item.cso === trimmedBarcode ||
    item.model === trimmedBarcode
  );

  if (matches.length === 0) {
    return { type: 'not_found' };
  }

  // Determine which field matched
  const serialMatch = matches.filter(item => item.serial === trimmedBarcode);
  const csoMatch = matches.filter(item => item.cso === trimmedBarcode);
  const modelMatch = matches.filter(item => item.model === trimmedBarcode);

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
}

type OwningSessionInfo = {
  id: string;
  name: string;
  sub_inventory: string | null;
};

export type OwningSessionMatchResult =
  | { type: 'not_found' }
  | {
      type: 'unique';
      item: InventoryItem;
      matchedField: 'serial' | 'cso' | 'model';
      owningSession: OwningSessionInfo | null;
    }
  | {
      type: 'multiple';
      items: InventoryItem[];
      matchedField: 'serial' | 'cso' | 'model';
      owningSession: OwningSessionInfo | null;
      ownershipScope: 'single' | 'mixed' | 'unassigned';
    };

export async function findItemOwningSession(barcode: string): Promise<OwningSessionMatchResult> {
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

  const resolveOwningSession = async (owningSessionId: string | null | undefined) => {
    if (!owningSessionId) return null;
    const { data: session, error: sessionError } = await supabase
      .from('scanning_sessions')
      .select('id, name, sub_inventory')
      .eq('id', owningSessionId)
      .maybeSingle();

    if (sessionError || !session) return null;
    return session as OwningSessionInfo;
  };

  const resolveMultipleOwnership = async (items: InventoryItem[]) => {
    const ids = Array.from(new Set(items.map(item => item.owning_session_id).filter(Boolean))) as string[];
    if (ids.length === 0) {
      return { owningSession: null, ownershipScope: 'unassigned' as const };
    }
    if (ids.length > 1) {
      return { owningSession: null, ownershipScope: 'mixed' as const };
    }
    const owningSession = await resolveOwningSession(ids[0]);
    return { owningSession, ownershipScope: 'single' as const };
  };

  if (serialMatch.length === 1) {
    const item = serialMatch[0];
    const owningSession = await resolveOwningSession(item.owning_session_id ?? null);
    return { type: 'unique', item, matchedField: 'serial', owningSession };
  }

  if (csoMatch.length > 0) {
    if (csoMatch.length === 1) {
      const item = csoMatch[0];
      const owningSession = await resolveOwningSession(item.owning_session_id ?? null);
      return { type: 'unique', item, matchedField: 'cso', owningSession };
    }

    const { owningSession, ownershipScope } = await resolveMultipleOwnership(csoMatch);
    return { type: 'multiple', items: csoMatch, matchedField: 'cso', owningSession, ownershipScope };
  }

  if (modelMatch.length > 0) {
    const { owningSession, ownershipScope } = await resolveMultipleOwnership(modelMatch);
    return { type: 'multiple', items: modelMatch, matchedField: 'model', owningSession, ownershipScope };
  }

  if (serialMatch.length > 1) {
    const { owningSession, ownershipScope } = await resolveMultipleOwnership(serialMatch);
    return { type: 'multiple', items: serialMatch, matchedField: 'serial', owningSession, ownershipScope };
  }

  return { type: 'not_found' };
}
