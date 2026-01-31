import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';

export function useDashboardInventoryItems() {
  const { locationId } = getActiveLocationContext();

  return useQuery<InventoryItem[]>({
    queryKey: queryKeys.dashboard.items(locationId ?? 'missing'),
    queryFn: async () => {
      if (!locationId) {
        throw new Error('No active location selected');
      }

      let allItems: InventoryItem[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('location_id', locationId)
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allItems = [...allItems, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allItems;
    },
    enabled: !!locationId,
  });
}

export function useDashboardLoadConflicts() {
  const { locationId } = getActiveLocationContext();

  return useQuery<Map<string, number>>({
    queryKey: queryKeys.dashboard.conflicts(locationId ?? 'missing'),
    queryFn: async () => {
      if (!locationId) {
        throw new Error('No active location selected');
      }

      const { data, error } = await supabase
        .from('load_conflicts')
        .select('load_number')
        .eq('location_id', locationId)
        .eq('status', 'open');

      if (error) throw error;

      const conflictCountMap = new Map<string, number>();
      (data ?? []).forEach((row) => {
        if (!row?.load_number) return;
        conflictCountMap.set(row.load_number, (conflictCountMap.get(row.load_number) ?? 0) + 1);
      });

      return conflictCountMap;
    },
    enabled: !!locationId,
  });
}

export function useRecentActivity(limit: number = 20) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.activity.recent(locationId ?? 'missing', limit),
    queryFn: async () => {
      if (!locationId) {
        throw new Error('No active location selected');
      }

      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action, entity_type, entity_id, details, actor_name, actor_image, created_at')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!locationId,
  });
}
