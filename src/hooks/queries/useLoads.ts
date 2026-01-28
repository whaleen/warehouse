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
      ? queryKeys.loads.byType(locationId, inventoryType)
      : queryKeys.loads.all(locationId),
    queryFn: () => getAllLoads(inventoryType),
    select: (data) => data.data,
  });
}

export function useLoadDetail(inventoryType: InventoryType, subInventoryName: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.detail(locationId, inventoryType, subInventoryName),
    queryFn: () => getLoadWithItems(inventoryType, subInventoryName),
    select: (data) => data.data,
    enabled: !!subInventoryName,
  });
}

export function useLoadItemCount(inventoryType: InventoryType, subInventoryName: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.count(locationId, inventoryType, subInventoryName),
    queryFn: () => getLoadItemCount(inventoryType, subInventoryName),
    select: (data) => data.count,
    enabled: !!subInventoryName,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loads.all(locationId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loads.all(locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all(locationId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loads.all(locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all(locationId) });
    },
  });
}

export function useLoadConflicts(inventoryType: InventoryType, loadNumber: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.conflicts(locationId, inventoryType, loadNumber),
    queryFn: () => getLoadConflicts(inventoryType, loadNumber),
    select: (data) => data.data,
    enabled: !!loadNumber,
  });
}
