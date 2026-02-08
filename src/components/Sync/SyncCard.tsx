import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { SyncStatsBox } from "./SyncStatsBox";
import { SyncLogViewer } from "./SyncLogViewer";
import { SyncStatusMessage } from "./SyncStatusMessage";
import { formatRelativeTime } from "@/lib/timeUtils";
import type { SyncType, SyncStatus } from "@/hooks/useSyncHandler";
import type { LucideIcon } from "lucide-react";

interface SyncCardProps {
  type: SyncType;
  title: string;
  description: string;
  icon: LucideIcon;
  footer?: string;
  status: SyncStatus;
  onSync: (type: SyncType) => void;
  lastSyncAt?: string | null;
  storedLog?: {
    details?: {
      stats?: {
        totalGEItems?: number;
        newItems?: number;
        updatedItems?: number;
        changesLogged?: number;
      };
      log?: string[];
    };
  };
}

export function SyncCard({
  type,
  title,
  description,
  icon: Icon,
  footer,
  status,
  onSync,
  lastSyncAt,
  storedLog,
}: SyncCardProps) {
  const lastSyncText = formatRelativeTime(lastSyncAt);
  const displayStats = status.stats || storedLog?.details?.stats;
  const displayLog = status.log || storedLog?.details?.log;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last synced: {lastSyncText}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {displayStats && <SyncStatsBox stats={displayStats} />}

        {footer && (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
            {footer}
          </div>
        )}

        {displayLog && displayLog.length > 0 && (
          <SyncLogViewer logs={displayLog} loading={status.loading} />
        )}

        {status.error && (
          <SyncStatusMessage type="error" message={status.error} />
        )}

        {status.success && !status.error && (
          <SyncStatusMessage type="success" message="Sync completed successfully" />
        )}

        <Button
          onClick={() => onSync(type)}
          disabled={status.loading}
          className="w-full"
        >
          {status.loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync {title}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
