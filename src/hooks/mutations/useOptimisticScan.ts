import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logProductLocation } from '@/lib/mapManager';
import { getActiveLocationContext } from '@/lib/tenant';
import type { ProductLocationForMap } from '@/types/map';

interface ScanParams {
  product_id?: string;
  inventory_item_id?: string;
  raw_lat: number;
  raw_lng: number;
  accuracy: number;
  scanned_by?: string;
  product_type?: string;
  sub_inventory?: string;
}

/**
 * Optimistic scan mutation
 * Marker appears instantly, then server confirms
 */
export function useOptimisticScan() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async (params: ScanParams) => {
      const result = await logProductLocation(params);
      if (!result.success) throw result.error;
      return result;
    },

    // Optimistic update - add marker immediately
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['product-locations', locationId],
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<ProductLocationForMap[]>([
        'product-locations',
        locationId,
      ]);

      // Optimistically add new marker
      queryClient.setQueryData<ProductLocationForMap[]>(
        ['product-locations', locationId],
        (old = []) => [
          ...old,
          {
            id: `temp-${Date.now()}`, // Temporary ID
            position_x: 0,
            position_y: 0,
            raw_lat: params.raw_lat,
            raw_lng: params.raw_lng,
            accuracy: params.accuracy,
            product_type: params.product_type || 'Unknown',
            sub_inventory: params.sub_inventory,
            inventory_type: null,
            scanned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            scanned_by: params.scanned_by || 'Unknown',
            product_id: params.product_id || null,
            inventory_item_id: params.inventory_item_id || null,
            load_color: '',
          } as ProductLocationForMap,
        ]
      );

      // Load scanning progress will update via Realtime → query invalidation
      return { previous };
    },

    // Rollback on error
    onError: (_err, _params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['product-locations', locationId],
          context.previous
        );
      }
    },

    // Refetch to get real data from server
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['product-locations', locationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['inventory-scan-counts-v4', locationId],
      });
      // Invalidate loads to update scan counts (Realtime will also do this, but this ensures consistency)
      queryClient.invalidateQueries({
        queryKey: ['loads', locationId],
      });
    },
  });
}
