import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';

export function useActivityRealtime() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`activity-log-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          const newEntry = payload.new;

          type ActivityLogPage = { data: unknown[] };
          type ActivityLogQueryData = {
            pages: ActivityLogPage[];
            pageParams?: unknown[];
          };

          queryClient.setQueryData<ActivityLogQueryData | undefined>(
            queryKeys.activity.all(locationId),
            (old) => {
              if (!old?.pages?.length) return old;

              const newPages = [...old.pages];
              newPages[0] = {
                ...newPages[0],
                data: [newEntry, ...newPages[0].data],
              };

              return { ...old, pages: newPages };
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, queryClient]);
}

export function useInventoryRealtime() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`inventory-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all(locationId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, queryClient]);
}

export function useReorderAlertsRealtime() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`parts-notifications-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracked_parts',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, queryClient]);
}

export function useRecentActivityRealtime(limit: number = 20) {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`activity-recent-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          const entry = payload.new;
          queryClient.setQueryData(queryKeys.activity.recent(locationId, limit), (old: unknown) => {
            const previous = Array.isArray(old) ? old : [];
            if (previous.some((item: { id?: string }) => item.id === entry.id)) {
              return previous;
            }
            return [entry, ...previous].slice(0, limit);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, limit, queryClient]);
}
