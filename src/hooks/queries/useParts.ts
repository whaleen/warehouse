import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrackedParts,
  updatePartCount,
  markAsReordered,
  getReorderAlerts,
  addTrackedPart,
  removeTrackedPart,
  updateThreshold,
  getCountHistoryWithProducts,
} from '@/lib/partsManager';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';

export function useTrackedParts() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.parts.tracked(locationId),
    queryFn: getTrackedParts,
    select: (data) => data.data,
  });
}

export function useReorderAlerts() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.parts.alerts(locationId),
    queryFn: getReorderAlerts,
    select: (data) => data.data,
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
      await queryClient.cancelQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      const previous = queryClient.getQueryData(queryKeys.parts.tracked(locationId));

      queryClient.setQueryData(queryKeys.parts.tracked(locationId), (old: any) => {
        if (!old) return old;
        return old.map((part: any) =>
          part.product_id === productId ? { ...part, current_qty: newQty } : part
        );
      });

      return { previous };
    },

    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.parts.tracked(locationId), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
    },
  });
}

export function useMarkAsReordered() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: (trackedPartId: string) => markAsReordered(trackedPartId),

    onMutate: async (trackedPartId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.parts.alerts(locationId) });
      const previous = queryClient.getQueryData(queryKeys.parts.alerts(locationId));

      queryClient.setQueryData(queryKeys.parts.alerts(locationId), (old: any) => {
        if (!old) return old;
        return old.map((alert: any) =>
          alert.tracked_part_id === trackedPartId
            ? { ...alert, reordered_at: new Date().toISOString() }
            : alert
        );
      });

      return { previous };
    },

    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.parts.alerts(locationId), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
    },
  });
}

export function useRemoveTrackedPart() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: (trackedPartId: string) => removeTrackedPart(trackedPartId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
    },
  });
}

export function usePartsHistory(productId?: string, days: number = 30) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.parts.history(locationId, productId, days),
    queryFn: () => getCountHistoryWithProducts(productId, days),
    select: (data) => data.data,
  });
}
