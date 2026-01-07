import type { ScanResult } from '@/types/inventory';
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
