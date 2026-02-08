import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';

type SyncType = 'asis' | 'fg' | 'sta' | 'inbound' | 'backhaul' | 'inventory';

type SyncLogEntry = {
  id: string;
  action: string;
  created_at: string;
  details: {
    success: boolean;
    duration_ms: number;
    stats?: {
      totalGEItems?: number;
      newItems?: number;
      updatedItems?: number;
      changesLogged?: number;
    };
    log?: string[];
    error?: string;
  };
};

export function useRecentSyncLogs() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['sync-logs', locationId],
    queryFn: async () => {
      if (!locationId) return null;

      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action, created_at, details')
        .eq('location_id', locationId)
        .in('action', ['asis_sync', 'fg_sync', 'sta_sync', 'inbound_sync', 'backhaul_sync', 'inventory_sync'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Group by sync type, taking most recent for each
      const logsByType: Record<string, SyncLogEntry> = {};

      for (const entry of (data || []) as SyncLogEntry[]) {
        const syncType = entry.action.replace('_sync', '') as SyncType;
        if (!logsByType[syncType]) {
          logsByType[syncType] = entry;
        }
      }

      return logsByType;
    },
    enabled: !!locationId,
    refetchInterval: false, // Don't auto-refetch, only on demand
  });
}
