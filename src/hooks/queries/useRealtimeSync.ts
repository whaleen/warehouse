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

          queryClient.setQueryData(queryKeys.activity.all(locationId), (old: any) => {
            if (!old?.pages) return old;

            const newPages = [...old.pages];
            newPages[0] = {
              ...newPages[0],
              data: [newEntry, ...newPages[0].data],
            };

            return { ...old, pages: newPages };
          });
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
