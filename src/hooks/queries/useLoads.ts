import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllLoads,
  getLoadWithItems,
  getLoadItemCount,
  updateLoadStatus,
  mergeLoads,
  deleteLoad,
  getLoadConflicts,
} from '@/lib/loadManager';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryType, LoadStatus } from '@/types/inventory';

export function useLoads(inventoryType?: InventoryType) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: inventoryType
      ? queryKeys.loads.byType(locationId ?? 'none', inventoryType)
      : queryKeys.loads.all(locationId ?? 'none'),
    queryFn: () => getAllLoads(inventoryType),
    select: (data) => data.data,
    enabled: !!locationId,
  });
}

export function useLoadDetail(inventoryType: InventoryType, subInventoryName: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.detail(locationId ?? 'none', inventoryType, subInventoryName),
    queryFn: () => getLoadWithItems(inventoryType, subInventoryName),
    select: (data) => data.data,
    enabled: !!locationId && !!subInventoryName,
  });
}

export function useLoadItemCount(inventoryType: InventoryType, subInventoryName: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.count(locationId ?? 'none', inventoryType, subInventoryName),
    queryFn: () => getLoadItemCount(inventoryType, subInventoryName),
    select: (data) => data.count,
    enabled: !!locationId && !!subInventoryName,
  });
}

export function useUpdateLoadStatus() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: ({
      inventoryType,
      subInventoryName,
      newStatus,
    }: {
      inventoryType: InventoryType;
      subInventoryName: string;
      newStatus: LoadStatus;
    }) => updateLoadStatus(inventoryType, subInventoryName, newStatus),

    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loads.all(locationId) });
      }
    },
  });
}

export function useMergeLoads() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: ({
      inventoryType,
      sourceNames,
      targetName,
    }: {
      inventoryType: InventoryType;
      sourceNames: string[];
      targetName: string;
    }) => mergeLoads(inventoryType, sourceNames, targetName),

    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loads.all(locationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all(locationId) });
      }
    },
  });
}

export function useDeleteLoad() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: ({
      inventoryType,
      subInventoryName,
      clearItems,
    }: {
      inventoryType: InventoryType;
      subInventoryName: string;
      clearItems?: boolean;
    }) => deleteLoad(inventoryType, subInventoryName, clearItems),

    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loads.all(locationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all(locationId) });
      }
    },
  });
}

export function useLoadConflicts(inventoryType: InventoryType, loadNumber: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.conflicts(locationId ?? 'none', inventoryType, loadNumber),
    queryFn: () => getLoadConflicts(inventoryType, loadNumber),
    select: (data) => data.data,
    enabled: !!loadNumber,
  });
}
