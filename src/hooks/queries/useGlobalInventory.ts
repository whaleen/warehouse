import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';
import { deduplicateAsisStaItems } from '@/lib/sessionScanner';

/**
 * Global inventory query - single source of truth
 * Fetches all inventory items for the active location
 * Other hooks derive from this cached data
 *
 * Updated via Supabase Realtime subscriptions (see RealtimeProvider)
 */
export function useGlobalInventory() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['inventory', 'global', locationId],
    queryFn: async () => {
      if (!locationId) return [];

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, products(*)')
        .eq('location_id', locationId);

      if (error) throw error;

      // Apply ASIS/STA deduplication (STA wins)
      return deduplicateAsisStaItems((data ?? []) as InventoryItem[]);
    },
    staleTime: Infinity, // Never goes stale - updated via Realtime
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    enabled: !!locationId,
  });
}
