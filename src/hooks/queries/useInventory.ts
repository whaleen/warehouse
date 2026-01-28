import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';

export function useInventoryItemDetail(itemId: string, enabled: boolean = true) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['inventory-item', locationId, itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          products:product_fk (
            id,
            model,
            product_type,
            brand,
            description,
            dimensions,
            image_url,
            product_url,
            price,
            msrp,
            color
          )
        `)
        .eq('id', itemId)
        .eq('location_id', locationId)
        .single();

      if (error) throw error;
      return data as InventoryItem;
    },
    enabled: enabled && !!itemId && !!locationId,
  });
}
