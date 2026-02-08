import { AppHeader } from "@/components/Navigation/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Package, Truck, ClipboardList, Archive } from "lucide-react";
import { useState } from "react";
import { PageContainer } from "@/components/Layout/PageContainer";
import { getActiveLocationContext } from "@/lib/tenant";
import { useGeSync } from "@/hooks/queries/useGeSync";
import { syncBackhaul } from "@/lib/geSync";
import { useIsMobile } from "@/hooks/use-mobile";

interface GESyncViewProps {
  onMenuClick?: () => void;
}

type SyncType = "asis" | "fg" | "sta" | "inbound" | "inventory" | "backhaul";

interface SyncStatus {
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

export function GESyncView({ onMenuClick }: GESyncViewProps) {
  const isMobile = useIsMobile();
  const geSyncUrl = (import.meta.env.VITE_GE_SYNC_URL as string | undefined) ?? "http://localhost:3001";
  const geSyncKeyConfigured = Boolean(import.meta.env.VITE_GE_SYNC_API_KEY);
  const [syncStatuses, setSyncStatuses] = useState<Record<SyncType, SyncStatus>>({
    inventory: { type: "inventory", loading: false, success: null, error: null },
    asis: { type: "asis", loading: false, success: null, error: null },
    fg: { type: "fg", loading: false, success: null, error: null },
    sta: { type: "sta", loading: false, success: null, error: null },
    inbound: { type: "inbound", loading: false, success: null, error: null },
    backhaul: { type: "backhaul", loading: false, success: null, error: null },
  });
  const geSyncMutation = useGeSync();

  const handleSync = async (type: SyncType) => {
    const { locationId } = getActiveLocationContext();

    if (!locationId) {
      setSyncStatuses((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          loading: false,
          success: false,
          error: "No active location selected",
        },
      }));
      return;
    }

    setSyncStatuses((prev) => ({
      ...prev,
      [type]: { ...prev[type], loading: true, success: null, error: null, stats: undefined, log: undefined },
    }));

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
    }
  };

  const renderSyncCard = (
    type: SyncType,
    title: string,
    description: string,
    icon: typeof Database,
    footer?: string
  ) => {
    const status = syncStatuses[type];
    const Icon = icon;

    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="space-y-3">
          {status.stats && (
            <div className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="font-medium">{status.stats.totalGEItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Items:</span>
                <span className="font-medium text-emerald-600">{status.stats.newItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated Items:</span>
                <span className="font-medium text-blue-600">{status.stats.updatedItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Changes Logged:</span>
                <span className="font-medium">{status.stats.changesLogged}</span>
              </div>
            </div>
          )}

          {footer && (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
              {footer}
            </div>
          )}

          {status.log && status.log.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-2">Sync log</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {status.log.map((line, index) => (
                  <div key={`${status.type}-log-${index}`}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {status.error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {status.error}
            </div>
          )}

          {status.success && !status.error && (
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600">
              Sync completed successfully
            </div>
          )}

          <Button
            onClick={() => handleSync(type)}
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
  };

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader title="Settings / GE Sync" onMenuClick={onMenuClick} />
      )}

      <PageContainer className="py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">GE DMS Sync</h2>
                <p className="text-sm text-muted-foreground">
                  Sync inventory data from GE Dealer Management System
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground space-y-2">
              <p className="text-foreground">
                <strong>💡 Recommended:</strong> Use "Sync All Inventory" below for best results.
              </p>
              <p className="text-xs">
                The unified sync runs in the correct order (FG → ASIS → STA) and handles ASIS→STA migrations automatically.
              </p>
              <div className="border-t border-border/40 my-3 pt-3">
                <p className="text-xs font-medium text-foreground mb-1">Inventory Types:</p>
                <p className="text-xs">
                  <strong>FG:</strong> Finished Goods (new, ready-to-sell appliances)
                </p>
                <p className="text-xs">
                  <strong>ASIS:</strong> As-Is inventory (open-box, damaged, discounted items)
                </p>
                <p className="text-xs">
                  <strong>STA:</strong> Staged inventory (items prepared for delivery/pickup)
                </p>
                <p className="text-xs">
                  <strong>Inbound:</strong> Receiving reports (arrival shipments)
                </p>
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                Endpoint: {geSyncUrl}
              </div>
              <div className="text-xs text-muted-foreground">
                API Key: {geSyncKeyConfigured ? "configured" : "missing"}
              </div>
            </div>
          </Card>

          {renderSyncCard(
            "inventory",
            "Sync All Inventory",
            "Unified sync: FG → ASIS → STA (recommended)",
            RefreshCw
          )}

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">Individual Syncs</p>
            <p className="text-amber-800 dark:text-amber-200 text-xs mb-3">
              Only use these if you need to sync a specific inventory type. Running in the wrong order may cause data inconsistencies.
            </p>
          </div>

          {renderSyncCard(
            "asis",
            "ASIS Inventory",
            "Sync As-Is inventory with load management",
            Package
          )}

          {renderSyncCard("fg", "Finished Goods", "Sync new finished goods inventory", Database)}

          {renderSyncCard("sta", "Staged Inventory", "Sync staged items for delivery", Truck)}

          {renderSyncCard("inbound", "Inbound Receipts", "Sync inbound receiving reports", ClipboardList)}

          {renderSyncCard(
            "backhaul",
            "Backhaul Orders",
            "Sync open backhaul orders + initial historical snapshot",
            Archive,
            "Includes closed backhauls once, then keeps open orders up to date."
          )}
        </div>
      </PageContainer>
    </div>
  );
}
