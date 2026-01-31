import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteDisplay,
  getAllDisplays,
  getDisplayByCode,
  getDisplayByIdPublic,
  pairDisplay,
  recordHeartbeat,
  updateDisplayName,
  updateDisplayState,
} from '@/lib/displayManager';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';
import type { DisplayState, FloorDisplay, FloorDisplaySummary } from '@/types/display';
import supabase from '@/lib/supabase';

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

export function usePublicDisplay(displayId?: string | null) {
  return useQuery<FloorDisplay>({
    queryKey: queryKeys.displays.public(displayId ?? 'missing'),
    queryFn: async () => {
      if (!displayId) {
        throw new Error('Missing display id');
      }
      const { data, error } = await getDisplayByIdPublic(displayId);
      if (error || !data) throw error ?? new Error('Display not found');
      return data;
    },
    enabled: !!displayId,
  });
}

export function useDisplayByCode(pairingCode?: string | null, refetchIntervalMs?: number) {
  return useQuery<FloorDisplay | null>({
    queryKey: queryKeys.displays.byCode(pairingCode ?? 'missing'),
    queryFn: async () => {
      if (!pairingCode) return null;
      const { data, error } = await getDisplayByCode(pairingCode);
      if (error || !data) return null;
      return data;
    },
    enabled: !!pairingCode,
    refetchInterval: pairingCode ? refetchIntervalMs : false,
  });
}

export function useRecordDisplayHeartbeat() {
  return useMutation({
    mutationFn: async (displayId: string) => {
      const { error } = await recordHeartbeat(displayId);
      if (error) throw error;
      return displayId;
    },
  });
}

export function useDisplayLocationLabel(locationId?: string | null) {
  return useQuery<{ locationName: string; companyName?: string | null } | null>({
    queryKey: queryKeys.locations.detail(locationId ?? 'missing'),
    queryFn: async () => {
      if (!locationId) return null;

      const { data, error } = await supabase
        .from('locations')
        .select('name, companies:company_id (name)')
        .eq('id', locationId)
        .maybeSingle();

      if (error || !data) return null;

      const company = Array.isArray(data.companies) ? data.companies[0] : data.companies;
      return {
        locationName: data.name,
        companyName: company?.name ?? null,
      };
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
