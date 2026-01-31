import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteDisplay,
  getAllDisplays,
  pairDisplay,
  updateDisplayName,
  updateDisplayState,
} from '@/lib/displayManager';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';
import type { DisplayState, FloorDisplaySummary } from '@/types/display';

export function useDisplays() {
  const { locationId } = getActiveLocationContext();

  return useQuery<FloorDisplaySummary[]>({
    queryKey: queryKeys.displays.all(locationId ?? 'missing'),
    queryFn: async () => {
      const { data, error } = await getAllDisplays();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!locationId,
  });
}

export function usePairDisplay() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async (pairingCode: string) => {
      const { data, error } = await pairDisplay(pairingCode);
      if (error || !data) throw error ?? new Error('Failed to pair display');
      return data;
    },
    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.displays.all(locationId) });
      }
    },
  });
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async ({ displayId, name }: { displayId: string; name: string }) => {
      const { data, error } = await updateDisplayName(displayId, name);
      if (error || !data) throw error ?? new Error('Failed to update display name');
      return data;
    },
    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.displays.all(locationId) });
      }
    },
  });
}

export function useUpdateDisplayState() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async ({ displayId, stateJson }: { displayId: string; stateJson: DisplayState }) => {
      const { data, error } = await updateDisplayState(displayId, stateJson);
      if (error || !data) throw error ?? new Error('Failed to update display state');
      return data;
    },
    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.displays.all(locationId) });
      }
    },
  });
}

export function useDeleteDisplay() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async (displayId: string) => {
      const { success, error } = await deleteDisplay(displayId);
      if (error || !success) throw error ?? new Error('Failed to delete display');
      return displayId;
    },
    onSuccess: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.displays.all(locationId) });
      }
    },
  });
}
