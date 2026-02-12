import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';

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

      // Get delivered load names to exclude their items
      const { data: deliveredLoads } = await supabase
        .from('load_metadata')
        .select('sub_inventory_name')
        .eq('location_id', locationId)
        .eq('ge_cso_status', 'Delivered');

      const deliveredLoadNames = new Set(
        deliveredLoads?.map(l => l.sub_inventory_name) ?? []
      );

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, products(*)')
        .eq('location_id', locationId);

      if (error) throw error;

      // Filter out items from delivered loads
      const activeItems = (data ?? []).filter(
        item => !item.sub_inventory || !deliveredLoadNames.has(item.sub_inventory)
      );

      return activeItems as InventoryItem[];
    },
    staleTime: Infinity, // Never goes stale - updated via Realtime
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    enabled: !!locationId,
  });
}
