import { useState } from 'react';
import { toast } from 'sonner';
import { useGeSync } from '@/hooks/queries/useGeSync';
import { useLocationSettings } from '@/hooks/queries/useSettings';
import { useRecentSyncLogs } from '@/hooks/queries/useSyncLogs';
import { getActiveLocationContext } from '@/lib/tenant';
import { syncBackhaul } from '@/lib/geSync';

export type SyncType = "asis" | "fg" | "sta" | "inbound" | "inventory" | "backhaul";

export interface SyncStatus {
  type: SyncType;
  loading: boolean;
  success: boolean | null;
  error: string | null;
  stats?: {
    totalGEItems: number;
    newItems: number;
    updatedItems: number;
    changesLogged: number;
  };
  log?: string[];
}

export function useSyncHandler() {
  const { locationId } = getActiveLocationContext();
  const geSyncMutation = useGeSync();
  const settingsQuery = useLocationSettings(locationId ?? null);
  const syncLogsQuery = useRecentSyncLogs();

  const [syncStatuses, setSyncStatuses] = useState<Record<SyncType, SyncStatus>>({
    inventory: { type: "inventory", loading: false, success: null, error: null },
    asis: { type: "asis", loading: false, success: null, error: null },
    fg: { type: "fg", loading: false, success: null, error: null },
    sta: { type: "sta", loading: false, success: null, error: null },
    inbound: { type: "inbound", loading: false, success: null, error: null },
    backhaul: { type: "backhaul", loading: false, success: null, error: null },
  });

  const navigateToSyncDetail = (type: SyncType) => {
    const path = `/settings/gesync/${type}`;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('app:locationchange'));
  };

  const handleSync = async (type: SyncType) => {
    const { locationId } = getActiveLocationContext();

    if (!locationId) {
      toast.error("No active location selected");
      return;
    }

    // Mark as loading
    setSyncStatuses((prev) => ({
      ...prev,
      [type]: { ...prev[type], loading: true, success: null, error: null, stats: undefined, log: undefined },
    }));

    // Show toast that sync started
    toast.info(`${type.toUpperCase()} sync started`, {
      description: "You can navigate away - we'll notify you when it completes"
    });

    // Fire sync in background
    try {
      const result = type === "backhaul"
        ? await syncBackhaul(locationId, { includeClosed: true })
        : await geSyncMutation.mutateAsync({ type, locationId });

      setSyncStatuses((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          loading: false,
          success: true,
          error: null,
          stats: result.stats,
          log: result.log,
        },
      }));

      // Refresh settings and logs to get new data
      settingsQuery.refetch();
      syncLogsQuery.refetch();

      // Show success toast with action to view details
      toast.success(`${type.toUpperCase()} sync completed`, {
        description: result.stats
          ? `${result.stats.newItems} new, ${result.stats.updatedItems} updated`
          : undefined,
        action: {
          label: 'View details',
          onClick: () => navigateToSyncDetail(type)
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSyncStatuses((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          loading: false,
          success: false,
          error: message,
          stats: undefined,
          log: undefined,
        },
      }));

      // Show error toast
      toast.error(`${type.toUpperCase()} sync failed`, {
        description: message
      });
    }
  };

  return {
    syncStatuses,
    handleSync,
    settingsQuery,
    syncLogsQuery,
  };
}
