import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, CheckCircle2, Database, ArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/timeUtils";
import { useLocationSettings } from "@/hooks/queries/useSettings";
import { getActiveLocationContext } from "@/lib/tenant";
import { getPathForView } from "@/lib/routes";
import type { AppView } from "@/lib/routes";

interface SyncStatusCardProps {
  onViewChange?: (view: AppView) => void;
}

type SyncType = 'inventory' | 'asis' | 'fg' | 'sta' | 'inbound' | 'backhaul';

const SYNC_LABELS: Record<SyncType, string> = {
  inventory: 'All Inventory',
  asis: 'ASIS',
  fg: 'FG',
  sta: 'STA',
  inbound: 'Inbound',
  backhaul: 'Backhaul',
};

const SYNC_DISPLAY_ORDER: SyncType[] = ['inventory', 'asis', 'fg', 'sta', 'inbound', 'backhaul'];

export function SyncStatusCard({ onViewChange }: SyncStatusCardProps) {
  const { locationId } = getActiveLocationContext();
  const settingsQuery = useLocationSettings(locationId ?? null);

  const navigateToSync = () => {
    const path = getPathForView('settings-gesync');
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('app:locationchange'));
    onViewChange?.('settings-gesync');
  };

  const getStatusIcon = (timestamp: string | null | undefined) => {
    if (!timestamp) {
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    }

    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const hoursSince = (now - then) / (1000 * 60 * 60);

    // Green if synced within last 24 hours
    if (hoursSince < 24) {
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
    }
    // Amber if 24-168 hours (1-7 days)
    if (hoursSince < 168) {
      return <Clock className="h-3.5 w-3.5 text-amber-600" />;
    }
    // Red if older than 7 days
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  };

  const getMostOutdated = () => {
    let oldestTime: number | null = null;
    let oldestType: SyncType | null = null;

    SYNC_DISPLAY_ORDER.forEach((type) => {
      const timestampKey = `last_sync_${type}_at` as keyof typeof settingsQuery.data.settings;
      const timestamp = settingsQuery.data?.settings?.[timestampKey] as string | null | undefined;

      if (!timestamp) {
        oldestType = type;
        oldestTime = 0;
        return;
      }

      const time = new Date(timestamp).getTime();
      if (oldestTime === null || time < oldestTime) {
        oldestTime = time;
        oldestType = type;
      }
    });

    return oldestType;
  };

  const mostOutdatedType = getMostOutdated();
  const hasOutdatedSyncs = SYNC_DISPLAY_ORDER.some((type) => {
    const timestampKey = `last_sync_${type}_at` as keyof typeof settingsQuery.data.settings;
    const timestamp = settingsQuery.data?.settings?.[timestampKey] as string | null | undefined;

    if (!timestamp) return true;

    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const hoursSince = (now - then) / (1000 * 60 * 60);

    return hoursSince >= 24;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Sync Status</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToSync}
          className="h-8"
        >
          Manage
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {/* Warning banner if syncs are outdated */}
          {hasOutdatedSyncs && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Data may be outdated
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                    Some syncs haven't run in over 24 hours
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sync status list */}
          <div className="space-y-2">
            {SYNC_DISPLAY_ORDER.map((type) => {
              const timestampKey = `last_sync_${type}_at` as keyof typeof settingsQuery.data.settings;
              const timestamp = settingsQuery.data?.settings?.[timestampKey] as string | null | undefined;
              const relativeTime = formatRelativeTime(timestamp);
              const isOutdated = type === mostOutdatedType;

              return (
                <div
                  key={type}
                  className={`flex items-center justify-between text-xs py-2 border-b border-border/50 last:border-0 ${
                    isOutdated && hasOutdatedSyncs ? 'opacity-100' : 'opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(timestamp)}
                    <span className="font-medium">{SYNC_LABELS[type]}</span>
                  </div>
                  <span className="text-muted-foreground text-[11px] ml-2 flex-shrink-0">
                    {relativeTime}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer with icon and link */}
          <div className="pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={navigateToSync}
              className="w-full text-xs h-8"
            >
              <Database className="mr-2 h-3.5 w-3.5" />
              Go to GE Sync
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
