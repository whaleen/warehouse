import { AppHeader } from "@/components/Navigation/AppHeader";
import { Card } from "@/components/ui/card";
import { Database, Package, Truck, ClipboardList, Archive, RefreshCw, ClipboardCheck } from "lucide-react";
import { PageContainer } from "@/components/Layout/PageContainer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSyncHandler } from "@/hooks/useSyncHandler";
import { SyncCardPreview } from "@/components/Sync";
import type { SyncType } from "@/hooks/useSyncHandler";

interface GESyncIndexViewProps {
  onMenuClick?: () => void;
}

export function GESyncIndexView({ onMenuClick }: GESyncIndexViewProps) {
  const isMobile = useIsMobile();
  const geSyncUrl = (import.meta.env.VITE_GE_SYNC_URL as string | undefined) ?? "http://localhost:3001";
  const geSyncKeyConfigured = Boolean(import.meta.env.VITE_GE_SYNC_API_KEY);
  const { syncStatuses, settingsQuery } = useSyncHandler();
  const settings = (settingsQuery.data?.settings ?? {}) as Record<string, string | null | undefined>;

  const navigateToDetail = (type: SyncType) => {
    const path = `/settings/gesync/${type}`;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('app:locationchange'));
  };

  const getLastSyncAt = (type: SyncType) => {
    const timestampKey = `last_sync_${type}_at`;
    return settings[timestampKey];
  };

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader title="Settings / GE Sync" onMenuClick={onMenuClick} />
      )}

      <PageContainer className="py-6 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Overview Card */}
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
                The unified sync runs in the correct order (FG → ASIS → STA) and keeps GE source records intact while deriving a single canonical inventory view.
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
                  <strong>STA:</strong> Staged state reported by GE (items prepared for delivery/pickup)
                </p>
                <p className="text-xs">
                  <strong>Inbound:</strong> Receiving reports (arrival shipments)
                </p>
                <p className="text-xs">
                  <strong>Orders:</strong> Order history and delivery windows
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

          {/* Unified Inventory Sync */}
          <SyncCardPreview
            type="inventory"
            title="Sync All Inventory"
            description="Unified sync: FG → ASIS → STA (recommended)"
            icon={RefreshCw}
            lastSyncAt={getLastSyncAt("inventory")}
            status={syncStatuses.inventory}
            onClick={navigateToDetail}
          />

          {/* Warning Card */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">Individual Syncs</p>
            <p className="text-amber-800 dark:text-amber-200 text-xs mb-3">
              Only use these if you need to sync a specific inventory type. Running in the wrong order may cause data inconsistencies.
            </p>
          </div>

          {/* Individual Sync Types - Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SyncCardPreview
              type="asis"
              title="ASIS Inventory"
              description="Sync As-Is inventory with load management"
              icon={Package}
              lastSyncAt={getLastSyncAt("asis")}
              status={syncStatuses.asis}
              onClick={navigateToDetail}
            />
            <SyncCardPreview
              type="fg"
              title="Finished Goods"
              description="Sync new finished goods inventory"
              icon={Database}
              lastSyncAt={getLastSyncAt("fg")}
              status={syncStatuses.fg}
              onClick={navigateToDetail}
            />
            <SyncCardPreview
              type="sta"
              title="Staged Inventory"
              description="Sync staged items for delivery"
              icon={Truck}
              lastSyncAt={getLastSyncAt("sta")}
              status={syncStatuses.sta}
              onClick={navigateToDetail}
            />
            <SyncCardPreview
              type="inbound"
              title="Inbound Receipts"
              description="Sync inbound receiving reports"
              icon={ClipboardList}
              lastSyncAt={getLastSyncAt("inbound")}
              status={syncStatuses.inbound}
              onClick={navigateToDetail}
            />
            <SyncCardPreview
              type="orders"
              title="Orders"
              description="Sync orders from Order Data"
              icon={ClipboardCheck}
              lastSyncAt={getLastSyncAt("orders")}
              status={syncStatuses.orders}
              onClick={navigateToDetail}
            />
            <SyncCardPreview
              type="backhaul"
              title="Backhaul Orders"
              description="Sync open backhaul orders + historical snapshot"
              icon={Archive}
              lastSyncAt={getLastSyncAt("backhaul")}
              status={syncStatuses.backhaul}
              onClick={navigateToDetail}
            />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
