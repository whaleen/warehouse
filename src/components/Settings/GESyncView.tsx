import { AppHeader } from "@/components/Navigation/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Package, Truck } from "lucide-react";
import { useState } from "react";
import { PageContainer } from "@/components/Layout/PageContainer";
import { getActiveLocationContext } from "@/lib/tenant";
import { useGeSync } from "@/hooks/queries/useGeSync";
import { useIsMobile } from "@/hooks/use-mobile";

interface GESyncViewProps {
  onMenuClick?: () => void;
}

type SyncType = "asis" | "fg" | "sta";

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
}

export function GESyncView({ onMenuClick }: GESyncViewProps) {
  const isMobile = useIsMobile();
  const geSyncUrl = (import.meta.env.VITE_GE_SYNC_URL as string | undefined) ?? "http://localhost:3001";
  const geSyncKeyConfigured = Boolean(import.meta.env.VITE_GE_SYNC_API_KEY);
  const [syncStatuses, setSyncStatuses] = useState<Record<SyncType, SyncStatus>>({
    asis: { type: "asis", loading: false, success: null, error: null },
    fg: { type: "fg", loading: false, success: null, error: null },
    sta: { type: "sta", loading: false, success: null, error: null },
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
      [type]: { ...prev[type], loading: true, success: null, error: null, stats: undefined },
    }));

    try {
      const result = await geSyncMutation.mutateAsync({ type, locationId });
      setSyncStatuses((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          loading: false,
          success: true,
          error: null,
          stats: result.stats,
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
        },
      }));
    }
  };

  const renderSyncCard = (
    type: SyncType,
    title: string,
    description: string,
    icon: typeof Database
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
              <p>
                <strong>ASIS:</strong> As-Is inventory (open-box, damaged, discounted items)
              </p>
              <p>
                <strong>FG:</strong> Finished Goods (new, ready-to-sell appliances)
              </p>
              <p>
                <strong>STA:</strong> Staged inventory (items prepared for delivery/pickup)
              </p>
              <div className="pt-2 text-xs text-muted-foreground">
                Endpoint: {geSyncUrl}
              </div>
              <div className="text-xs text-muted-foreground">
                API Key: {geSyncKeyConfigured ? "configured" : "missing"}
              </div>
            </div>
          </Card>

          {renderSyncCard(
            "asis",
            "ASIS Inventory",
            "Sync As-Is inventory with load management",
            Package
          )}

          {renderSyncCard("fg", "Finished Goods", "Sync new finished goods inventory", Database)}

          {renderSyncCard("sta", "Staged Inventory", "Sync staged items for delivery", Truck)}
        </div>
      </PageContainer>
    </div>
  );
}
