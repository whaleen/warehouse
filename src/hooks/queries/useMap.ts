import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteProductLocation, getProductLocations } from '@/lib/mapManager';
import { getActiveLocationContext } from '@/lib/tenant';
import supabase from '@/lib/supabase';

export function useProductLocations() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['product-locations', locationId ?? 'none'],
    enabled: !!locationId,
    queryFn: async () => {
      const { data, error } = await getProductLocations();
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteProductLocation() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async (locationIdToDelete: string) => {
      const { error } = await deleteProductLocation(locationIdToDelete);
      if (error) throw error;
      return locationIdToDelete;
    },
    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
      }
    },
  });
}

export function useClearAllScans() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error('Location required');
      const { error } = await supabase
        .from('product_location_history')
        .delete()
        .eq('location_id', locationId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
      }
    },
  });
}

export function useInventoryItemCount() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['inventory-item-count', locationId ?? 'none'],
    enabled: !!locationId,
    queryFn: async () => {
      if (!locationId) return 0;

      const { count, error } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId);

      if (error) throw error;
      return Number(count) || 0;
    },
  });
}

export function useInventoryScanCounts() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['inventory-scan-counts-v5', locationId ?? 'none'], // v5: use load_metadata fields
    enabled: !!locationId,
    staleTime: 0, // Force refetch
    gcTime: 0, // Don't cache
    queryFn: async () => {
      if (!locationId) {
        return { totalByKey: new Map<string, number>(), scannedByKey: new Map<string, number>() };
      }

      // Query load_metadata directly (same as ASIS page)
      const { data: loads, error } = await supabase
        .from('load_metadata')
        .select('sub_inventory_name, items_total_count, items_scanned_count')
        .eq('location_id', locationId);

      if (error) throw error;

      // Convert to Maps with 'load:' prefix
      const totalByKey = new Map<string, number>();
      const scannedByKey = new Map<string, number>();

      for (const load of loads ?? []) {
        const key = `load:${load.sub_inventory_name}`;
        totalByKey.set(key, load.items_total_count || 0);
        scannedByKey.set(key, load.items_scanned_count || 0);
      }

      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, serial, qty, inventory_bucket, inventory_type, sub_inventory')
        .eq('location_id', locationId)
        .limit(50000);

      if (itemsError) throw itemsError;

      const { data: scannedRows, error: scannedError } = await supabase
        .from('product_location_history')
        .select('inventory_item_id')
        .eq('location_id', locationId);

      if (scannedError) throw scannedError;

      const scannedIds = new Set((scannedRows || []).map(row => row.inventory_item_id));

      for (const item of items ?? []) {
        if (item.sub_inventory) continue;
        const bucket = (item.inventory_bucket || item.inventory_type || 'Unknown') as string;
        const key = `bucket:${bucket}`;
        const typeKey = `type:${bucket}`;
        const isSerialized = Boolean(item.serial && String(item.serial).trim());
        const weight = isSerialized ? 1 : (item.qty ?? 1);
        totalByKey.set(key, (totalByKey.get(key) ?? 0) + weight);
        totalByKey.set(typeKey, (totalByKey.get(typeKey) ?? 0) + weight);
        if (item.id && scannedIds.has(item.id)) {
          scannedByKey.set(key, (scannedByKey.get(key) ?? 0) + weight);
          scannedByKey.set(typeKey, (scannedByKey.get(typeKey) ?? 0) + weight);
        }
      }

      return { totalByKey, scannedByKey };
    },
  });
}

export function useDeleteSessionScans() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async (locationIds: string[]) => {
      if (!locationId) throw new Error('Location required');
      if (locationIds.length === 0) return;

      const { error } = await supabase
        .from('product_location_history')
        .delete()
        .eq('location_id', locationId)
        .in('id', locationIds);

      if (error) throw error;
    },
    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
      }
    },
  });
}
