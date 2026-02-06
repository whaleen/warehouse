import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';

interface RealtimeContextValue {
  connected: boolean; // Future: track connection status
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  useEffect(() => {
    if (!locationId) return;

    console.log('🔴 Realtime: Subscribing to changes for location:', locationId);

    // Subscribe to inventory_items changes
    const inventoryChannel = supabase
      .channel(`inventory:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'inventory_items',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('📦 Inventory change:', payload.eventType, payload.new || payload.old);

          // Invalidate global inventory
          queryClient.invalidateQueries({
            queryKey: ['inventory', 'global', locationId],
          });

          // Invalidate related queries
          queryClient.invalidateQueries({
            queryKey: ['inventory-scan-counts-v4', locationId],
          });

          queryClient.invalidateQueries({
            queryKey: ['data-quality'],
          });

          // Invalidate ASIS overview stats (dashboard)
          queryClient.invalidateQueries({
            queryKey: ['inventory', locationId, 'asis-overview'],
          });
        }
      )
      .subscribe((status) => {
        console.log('📦 Inventory channel status:', status);
      });

    // Subscribe to product_location_history (scan events)
    const scanChannel = supabase
      .channel(`scans:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'product_location_history',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('📍 New scan:', payload.new);

          // Invalidate map locations
          queryClient.invalidateQueries({
            queryKey: ['product-locations', locationId],
          });

          // Invalidate scan counts
          queryClient.invalidateQueries({
            queryKey: ['inventory-scan-counts-v4', locationId],
          });
        }
      )
      .subscribe((status) => {
        console.log('📍 Scan channel status:', status);
      });

    // Subscribe to scanning_sessions changes
    const sessionChannel = supabase
      .channel(`sessions:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scanning_sessions',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('🎯 Session change:', payload.eventType, payload.new || payload.old);

          queryClient.invalidateQueries({
            queryKey: ['sessions'],
          });
        }
      )
      .subscribe((status) => {
        console.log('🎯 Session channel status:', status);
      });

    // Subscribe to load_metadata changes
    const loadChannel = supabase
      .channel(`loads:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'load_metadata',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('🚚 Load metadata change:', payload.eventType, payload.new || payload.old);

          queryClient.invalidateQueries({
            queryKey: ['loads'],
          });

          queryClient.invalidateQueries({
            queryKey: ['map-metadata'],
          });

          // Invalidate product-locations because getProductLocations()
          // fetches load_metadata.primary_color and friendly_name
          queryClient.invalidateQueries({
            queryKey: ['product-locations', locationId],
          });
        }
      )
      .subscribe((status) => {
        console.log('🚚 Load channel status:', status);
      });

    // Cleanup on unmount or location change
    return () => {
      console.log('🔴 Realtime: Unsubscribing from all channels');
      inventoryChannel.unsubscribe();
      scanChannel.unsubscribe();
      sessionChannel.unsubscribe();
      loadChannel.unsubscribe();
    };
  }, [locationId, queryClient]);

  return (
    <RealtimeContext.Provider value={{ connected: true }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return ctx;
}
