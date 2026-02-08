/**
 * Unified Load Data Hook
 * Uses TanStack Query as single source of truth
 * Realtime updates via query invalidation (100-300ms latency is acceptable)
 */

import { useLoads } from '@/hooks/queries/useLoads';
import type { InventoryType, LoadMetadata } from '@/types/inventory';

interface UseLoadDataOptions {
  inventoryType?: InventoryType;
  includeDelivered?: boolean;
}

export function useLoadData(options: UseLoadDataOptions = {}) {
  const { inventoryType, includeDelivered = false } = options;

  // Single source of truth: TanStack Query
  const { data, isLoading, error } = useLoads(inventoryType, includeDelivered);
  const serverLoads = (data ?? []) as LoadMetadata[];

  // Create map for easy lookups
  const loadsMap = new Map(serverLoads.map(l => [l.sub_inventory_name, l]));

  return {
    loads: serverLoads,
    loadsMap,
    isLoading,
    error,
  };
}

/**
 * Get a single load by name
 */
export function useLoadByName(loadName: string | undefined) {
  const { loads, isLoading } = useLoadData();

  const load = loadName
    ? loads.find(l => l.sub_inventory_name === loadName)
    : undefined;

  return {
    load,
    isLoading,
  };
}

/**
 * Get multiple loads by names
 */
export function useLoadsByNames(loadNames: string[]) {
  const { loadsMap, isLoading } = useLoadData();

  const loads = loadNames
    .map(name => loadsMap.get(name))
    .filter((load): load is LoadMetadata => load !== undefined);

  return {
    loads,
    loadsMap: new Map(loads.map(l => [l.sub_inventory_name, l])),
    isLoading,
  };
}
