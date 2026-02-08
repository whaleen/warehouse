/**
 * Sanity Check Business Logic
 *
 * Handles calculation of sanity check parameters based on load lifecycle stage.
 */

import type { LoadMetadata, SanityCheckParameters } from '@/types/inventory';

/**
 * Calculate what needs to be verified in a sanity check based on load status
 */
export function getSanityCheckParameters(load: LoadMetadata): SanityCheckParameters {
  const geStatus = load.ge_source_status?.toLowerCase() || '';
  const isSold = geStatus.includes('sold');
  const isShipped = geStatus.includes('shipped');
  const isPicked = geStatus.includes('picked');

  // Early stage: just verify grouping and inventory matches GE
  if (!isShipped && !isSold && !isPicked) {
    return {
      checkGrouping: true,
      checkWrapping: false,
      checkTagging: false,
      checkEndCapMarkers: false,
      checkNoExtraItems: true,
      checkVisuallyLocatable: true,
      geStatus,
      notes: 'Early consolidation check: verify items are grouped and match GE inventory',
    };
  }

  // Final stage: verify everything is ready for pickup
  // Salvage loads never require wrapping or tagging
  const isSalvage = load.category?.toLowerCase() === 'salvage';
  const wrappingRequired = !isSalvage && (isShipped || isSold);
  const taggingRequired = !isSalvage && isSold;
  const endCapMarkersRequired = taggingRequired && load.prep_tagged === true;

  return {
    checkGrouping: true,
    checkWrapping: wrappingRequired,
    checkTagging: taggingRequired,
    checkEndCapMarkers: endCapMarkersRequired,
    checkNoExtraItems: true,
    checkVisuallyLocatable: true,
    geStatus,
    notes: 'Final readiness check: verify load is fully prepared for pickup',
  };
}

/**
 * Determine if a sanity check can be requested for this load
 */
export function canRequestSanityCheck(load: LoadMetadata): boolean {
  // Can't request for delivered loads
  if (load.status === 'delivered') return false;

  // Must have items
  if (!load.ge_units || load.ge_units === '0') return false;

  // If already requested and not completed, can't request again
  if (load.sanity_check_requested && !load.sanity_completed_at) {
    return false;
  }

  // Otherwise, can request
  return true;
}

/**
 * Determine what stage of sanity check this should be
 */
export function getSanityCheckStage(load: LoadMetadata): 'early' | 'final' {
  const geStatus = load.ge_source_status?.toLowerCase() || '';
  const isSold = geStatus.includes('sold');
  const isShipped = geStatus.includes('shipped');
  const isPicked = geStatus.includes('picked');

  // If shipped, sold, or picked, this is a final check
  if (isShipped || isSold || isPicked) {
    return 'final';
  }

  // Otherwise, early stage
  return 'early';
}

/**
 * Format sanity check parameters for display
 */
export function formatSanityCheckParameters(params: SanityCheckParameters): string[] {
  const checks: string[] = [];

  if (params.checkGrouping) {
    checks.push('✓ All items grouped together');
  }
  if (params.checkWrapping) {
    checks.push('✓ All items wrapped properly');
  }
  if (params.checkTagging) {
    checks.push('✓ All items tagged');
  }
  if (params.checkEndCapMarkers) {
    checks.push('✓ End cap markers in place');
  }
  if (params.checkNoExtraItems) {
    checks.push('✓ No out-of-place items in group');
  }
  if (params.checkVisuallyLocatable) {
    checks.push('✓ Load can be visually located');
  }

  return checks;
}
