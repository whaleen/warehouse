import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReorderAlert, TrackedPartWithDetails } from '@/types/inventory';
import {
  getTrackedParts,
  updatePartCount,
  markAsReordered,
  getReorderAlerts,
  addTrackedPart,
  removeTrackedPart,
  updateThreshold,
  getCountHistoryWithProducts,
  getAvailablePartsToTrack,
} from '@/lib/partsManager';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';

export function useTrackedParts() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.parts.tracked(locationId ?? 'none'),
    queryFn: getTrackedParts,
    enabled: !!locationId,
  });
}

export function useReorderAlerts() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.parts.alerts(locationId ?? 'none'),
    queryFn: getReorderAlerts,
    enabled: !!locationId,
  });
}

export function useUpdatePartCount() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: ({
      productId,
      newQty,
      countedBy,
      notes,
      reason,
    }: {
      productId: string;
      newQty: number;
      countedBy?: string;
      notes?: string;
      reason?: 'usage' | 'return' | 'restock';
    }) => updatePartCount(productId, newQty, countedBy, notes, reason),

    onMutate: async ({ productId, newQty }) => {
      if (!locationId) return {};
      await queryClient.cancelQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      const previous = queryClient.getQueryData<TrackedPartWithDetails[]>(queryKeys.parts.tracked(locationId));

      queryClient.setQueryData<TrackedPartWithDetails[] | undefined>(
        queryKeys.parts.tracked(locationId),
        (old) => {
          if (!old) return old;
          return old.map((part) =>
          part.product_id === productId ? { ...part, current_qty: newQty } : part
          );
        }
      );

      return { previous };
    },

    onError: (_err, _variables, context) => {
      if (context?.previous && locationId) {
        queryClient.setQueryData(queryKeys.parts.tracked(locationId), context.previous);
      }
    },

    onSettled: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
      }
    },
  });
}

export function useMarkAsReordered() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: (trackedPartId: string) => markAsReordered(trackedPartId),

    onMutate: async (trackedPartId) => {
      if (!locationId) return {};
      await queryClient.cancelQueries({ queryKey: queryKeys.parts.alerts(locationId) });
      const previous = queryClient.getQueryData<ReorderAlert[]>(queryKeys.parts.alerts(locationId));

      queryClient.setQueryData<ReorderAlert[] | undefined>(
        queryKeys.parts.alerts(locationId),
        (old) => {
          if (!old) return old;
          return old.map((alert) =>
            alert.tracked_part_id === trackedPartId
              ? { ...alert, reordered_at: new Date().toISOString() }
              : alert
          );
        }
      );

      return { previous };
    },

    onError: (_err, _variables, context) => {
      if (context?.previous && locationId) {
        queryClient.setQueryData(queryKeys.parts.alerts(locationId), context.previous);
      }
    },

    onSettled: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
      }
    },
  });
}

export function useAddTrackedPart() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: ({
      productId,
      reorderThreshold,
      createdBy,
    }: {
      productId: string;
      reorderThreshold?: number;
      createdBy?: string;
    }) => addTrackedPart(productId, reorderThreshold, createdBy),

    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
      }
    },
  });
}

export function useRemoveTrackedPart() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: (trackedPartId: string) => removeTrackedPart(trackedPartId),

    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
      }
    },
  });
}

export function useUpdateThreshold() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: ({
      trackedPartId,
      threshold,
    }: {
      trackedPartId: string;
      threshold: number;
    }) => updateThreshold(trackedPartId, threshold),

    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
      }
    },
  });
}

export function usePartsHistory(productId?: string, days: number = 30) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.parts.history(locationId ?? 'none', productId, days),
    queryFn: () => getCountHistoryWithProducts(productId, days),
    enabled: !!locationId,
  });
}

export function useAvailablePartsToTrack(searchTerm?: string, enabled: boolean = true) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.parts.available(locationId ?? 'none', searchTerm),
    queryFn: () =>
      getAvailablePartsToTrack({
        searchTerm: searchTerm?.trim() ? searchTerm.trim() : undefined,
        limit: 1000,
      }),
    enabled: enabled && !!locationId,
  });
}
