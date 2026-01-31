import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';

export function useSessionMetadata(sessionIds: string[]) {
  const { locationId } = getActiveLocationContext();

  return useQuery<Map<string, { name: string; created_at: string }>>({
    queryKey: queryKeys.map.sessionMetadata(locationId ?? 'missing', sessionIds),
    queryFn: async () => {
      if (!locationId || sessionIds.length === 0) {
        return new Map();
      }

      const { data, error } = await supabase
        .from('scanning_sessions')
        .select('id, name, created_at')
        .eq('location_id', locationId)
        .in('id', sessionIds);

      if (error) throw error;

      const metadata = new Map<string, { name: string; created_at: string }>();
      (data ?? []).forEach((session: { id: string; name: string; created_at: string }) => {
        metadata.set(session.id, { name: session.name, created_at: session.created_at });
      });

      return metadata;
    },
    enabled: !!locationId && sessionIds.length > 0,
  });
}

export function useLoadMetadata(loadNames: string[]) {
  const { locationId } = getActiveLocationContext();

  return useQuery<Map<string, { friendly_name: string | null; ge_cso: string | null }>>({
    queryKey: queryKeys.map.loadMetadata(locationId ?? 'missing', loadNames),
    queryFn: async () => {
      if (!locationId || loadNames.length === 0) {
        return new Map();
      }

      const { data, error } = await supabase
        .from('load_metadata')
        .select('sub_inventory_name, friendly_name, ge_cso')
        .eq('location_id', locationId)
        .in('sub_inventory_name', loadNames);

      if (error) throw error;

      const metadata = new Map<string, { friendly_name: string | null; ge_cso: string | null }>();
      (data ?? []).forEach((load: { sub_inventory_name: string; friendly_name: string | null; ge_cso: string | null }) => {
        metadata.set(load.sub_inventory_name, {
          friendly_name: load.friendly_name,
          ge_cso: load.ge_cso,
        });
      });

      return metadata;
    },
    enabled: !!locationId && loadNames.length > 0,
  });
}
