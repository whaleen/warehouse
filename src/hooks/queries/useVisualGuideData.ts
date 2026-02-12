import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';

export interface AsisLoadColor {
  sub_inventory_name: string;
  friendly_name: string | null;
  primary_color: string | null;
  category: string | null;
  item_count: number;
}

export interface InventoryTypeCounts {
  inventory_type: string;
  count: number;
}

export interface VisualGuideData {
  regularLoads: AsisLoadColor[];
  salvageLoads: AsisLoadColor[];
  looseAsisCount: number;
  inventoryTypeCounts: InventoryTypeCounts[];
  allLoadColors: { color: string; name: string }[];
}

export function useVisualGuideData() {
  const { locationId } = getActiveLocationContext();

  return useQuery<VisualGuideData>({
    queryKey: ['visual-guide-data', locationId],
    enabled: !!locationId,
    queryFn: async () => {
      if (!locationId) {
        throw new Error('No active location');
      }

      // Get all ASIS loads with their colors and categories (exclude delivered)
      const { data: loads, error: loadsError } = await supabase
        .from('load_metadata')
        .select('sub_inventory_name, friendly_name, primary_color, category')
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS')
        .eq('status', 'active')
        .or('ge_cso_status.is.null,ge_cso_status.neq.Delivered');

      if (loadsError) throw loadsError;

      // Get item counts for each load
      const { data: itemCounts, error: countsError } = await supabase
        .from('inventory_items')
        .select('sub_inventory, inventory_type, inventory_bucket')
        .eq('location_id', locationId)
        .not('sub_inventory', 'is', null);

      if (countsError) throw countsError;

      // Build count map
      const countMap = new Map<string, number>();
      itemCounts?.forEach((item) => {
        if (item.sub_inventory) {
          countMap.set(item.sub_inventory, (countMap.get(item.sub_inventory) || 0) + 1);
        }
      });

      // Separate loads by category
      const regularLoads: AsisLoadColor[] = [];
      const salvageLoads: AsisLoadColor[] = [];

      loads?.forEach((load) => {
        const loadData = {
          sub_inventory_name: load.sub_inventory_name,
          friendly_name: load.friendly_name,
          primary_color: load.primary_color,
          category: load.category,
          item_count: countMap.get(load.sub_inventory_name) || 0,
        };

        if (load.category === 'Salvage') {
          salvageLoads.push(loadData);
        } else if (load.category !== 'Scrap') {
          // Regular loads (not Salvage, not Scrap)
          regularLoads.push(loadData);
        }
      });

      // Get loose ASIS count (no load)
      let looseAsisCount = 0;
      const { count: looseCount, error: looseError } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .is('sub_inventory', null)
        .or('inventory_bucket.eq.ASIS,inventory_type.eq.ASIS');

      if (!looseError) {
        looseAsisCount = looseCount || 0;
      }

      // Get inventory type counts (for non-ASIS types)
      const inventoryTypeCounts: InventoryTypeCounts[] = [];

      // Count by inventory type
      const typeCountMap = new Map<string, number>();
      itemCounts?.forEach((item) => {
        const bucket = item.inventory_bucket || item.inventory_type;
        if (bucket && bucket !== 'ASIS') {
          typeCountMap.set(bucket, (typeCountMap.get(bucket) || 0) + 1);
        }
      });

      typeCountMap.forEach((count, type) => {
        inventoryTypeCounts.push({ inventory_type: type, count });
      });

      // Extract unique colors from loads
      const colorSet = new Set<string>();
      regularLoads.forEach((load) => {
        if (load.primary_color) {
          colorSet.add(load.primary_color);
        }
      });

      const allLoadColors = Array.from(colorSet).map((color) => ({
        color,
        name: regularLoads.find(l => l.primary_color === color)?.friendly_name || 'Unknown',
      }));

      return {
        regularLoads,
        salvageLoads,
        looseAsisCount,
        inventoryTypeCounts,
        allLoadColors,
      };
    },
  });
}
