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
  scrapCount: number;
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

      // Get all ASIS loads with their colors and categories
      const { data: loads, error: loadsError } = await supabase
        .from('load_metadata')
        .select('sub_inventory_name, friendly_name, primary_color, category')
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS')
        .eq('status', 'active');

      if (loadsError) throw loadsError;

      // Get item counts for each load
      const { data: itemCounts, error: countsError } = await supabase
        .from('inventory_items')
        .select('sub_inventory, inventory_type')
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

      // Get scrap count
      const scrapLoads = loads?.filter(l => l.category === 'Scrap').map(l => l.sub_inventory_name) || [];
      let scrapCount = 0;

      if (scrapLoads.length > 0) {
        const { count, error: scrapError } = await supabase
          .from('inventory_items')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('sub_inventory', scrapLoads);

        if (!scrapError) {
          scrapCount = count || 0;
        }
      }

      // Get inventory type counts (for non-ASIS types)
      const inventoryTypeCounts: InventoryTypeCounts[] = [];

      // Count by inventory type
      const typeCountMap = new Map<string, number>();
      itemCounts?.forEach((item) => {
        const type = item.inventory_type;
        if (type && type !== 'ASIS') {
          typeCountMap.set(type, (typeCountMap.get(type) || 0) + 1);
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
        scrapCount,
        inventoryTypeCounts,
        allLoadColors,
      };
    },
  });
}
