import { AppHeader } from "@/components/Navigation/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, Package, Truck, ClipboardList, Archive, RefreshCw, ChevronLeft, ClipboardCheck } from "lucide-react";
import { PageContainer } from "@/components/Layout/PageContainer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSyncHandler } from "@/hooks/useSyncHandler";
import { SyncCard } from "@/components/Sync";
import type { SyncType } from "@/hooks/useSyncHandler";
import { useState } from "react";

interface GESyncDetailViewProps {
  type: SyncType;
  onMenuClick?: () => void;
}

const SYNC_CONFIG = {
  inventory: {
    title: "Sync All Inventory",
    description: "Unified sync: FG → ASIS → STA (recommended)",
    icon: RefreshCw,
    footer: undefined,
  },
  asis: {
    title: "ASIS Inventory",
    description: "Sync As-Is inventory with load management",
    icon: Package,
    footer: undefined,
  },
  fg: {
    title: "Finished Goods",
    description: "Sync new finished goods inventory",
    icon: Database,
    footer: undefined,
  },
  sta: {
    title: "Staged Inventory",
    description: "Sync staged state from GE",
    icon: Truck,
    footer: undefined,
  },
  inbound: {
    title: "Inbound Receipts",
    description: "Sync inbound receiving reports",
    icon: ClipboardList,
    footer: undefined,
  },
  orders: {
    title: "Orders",
    description: "Sync orders from Order Data",
    icon: ClipboardCheck,
    footer: "Default window: 90 days back, 30 days forward.",
  },
  backhaul: {
    title: "Backhaul Orders",
    description: "Sync open backhaul orders + initial historical snapshot",
    icon: Archive,
    footer: "Includes closed backhauls once, then keeps open orders up to date.",
  },
} as const;

export function GESyncDetailView({ type, onMenuClick }: GESyncDetailViewProps) {
  const isMobile = useIsMobile();
  const { syncStatuses, handleSync, settingsQuery, syncLogsQuery } = useSyncHandler();
  const [orderOptions, setOrderOptions] = useState({
    dmsLoc: '19SU',
    useUiRange: true,
    uiStartDate: '',
    uiDays: 100,
    daysBack: 90,
    daysForward: 30,
    maxDays: 30,
    maxCsos: 200,
    batchSize: 200,
  });

  const navigateToIndex = () => {
    const path = '/settings/gesync';
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('app:locationchange'));
  };

  const config = SYNC_CONFIG[type];
  const status = syncStatuses[type];
  const settings = (settingsQuery.data?.settings ?? {}) as Record<string, string | null | undefined>;
  const timestampKey = `last_sync_${type}_at`;
  const lastSyncAt = settings[timestampKey];
  const storedLog = status.loading ? undefined : syncLogsQuery.data?.[type];

  const orderSyncOptions = {
    dmsLoc: orderOptions.dmsLoc.trim() || '19SU',
    useUiRange: orderOptions.useUiRange,
    uiStartDate: orderOptions.uiStartDate,
    uiDays: orderOptions.uiDays,
    daysBack: orderOptions.daysBack,
    daysForward: orderOptions.daysForward,
    maxDays: orderOptions.maxDays,
    maxCsos: orderOptions.maxCsos,
    batchSize: orderOptions.batchSize,
  };

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader title={`Settings / GE Sync / ${config.title}`} onMenuClick={onMenuClick} />
      )}

      <PageContainer className="py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Breadcrumb and Back Button */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={navigateToIndex}
              className="hover:text-foreground transition-colors"
            >
              Settings
            </button>
            <span>/</span>
            <button
              onClick={navigateToIndex}
              className="hover:text-foreground transition-colors"
            >
              GE Sync
            </button>
            <span>/</span>
            <span className="text-foreground">{config.title}</span>
          </div>

          <Button
            variant="outline"
            onClick={navigateToIndex}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to GE Sync
          </Button>

          {/* Full Sync Card */}
          {type === 'orders' && (
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-4">
              <div className="text-sm font-medium text-foreground">Order Data Parameters</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orders-dms-loc">DMS Location</Label>
                  <Input
                    id="orders-dms-loc"
                    value={orderOptions.dmsLoc}
                    onChange={(event) => setOrderOptions((prev) => ({
                      ...prev,
                      dmsLoc: event.target.value,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orders-max-days">Max Days per Request</Label>
                  <Input
                    id="orders-max-days"
                    type="number"
                    value={orderOptions.maxDays}
                    onChange={(event) => setOrderOptions((prev) => ({
                      ...prev,
                      maxDays: Number.parseInt(event.target.value, 10) || 0,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orders-max-csos">Max CSOs per Chunk</Label>
                  <Input
                    id="orders-max-csos"
                    type="number"
                    value={orderOptions.maxCsos}
                    onChange={(event) => setOrderOptions((prev) => ({
                      ...prev,
                      maxCsos: Number.parseInt(event.target.value, 10) || 0,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orders-batch-size">DB Batch Size</Label>
                  <Input
                    id="orders-batch-size"
                    type="number"
                    value={orderOptions.batchSize}
                    onChange={(event) => setOrderOptions((prev) => ({
                      ...prev,
                      batchSize: Number.parseInt(event.target.value, 10) || 0,
                    }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="orders-use-ui-range"
                  checked={orderOptions.useUiRange}
                  onCheckedChange={(checked) => setOrderOptions((prev) => ({
                    ...prev,
                    useUiRange: checked === true,
                  }))}
                />
                <Label htmlFor="orders-use-ui-range">Use UI date range</Label>
              </div>
              {orderOptions.useUiRange ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orders-ui-date">Orders for Date (MM-DD-YYYY)</Label>
                    <Input
                      id="orders-ui-date"
                      placeholder="02-09-2026"
                      value={orderOptions.uiStartDate}
                      onChange={(event) => setOrderOptions((prev) => ({
                        ...prev,
                        uiStartDate: event.target.value,
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orders-ui-days">More Days</Label>
                    <Input
                      id="orders-ui-days"
                      type="number"
                      value={orderOptions.uiDays}
                      onChange={(event) => setOrderOptions((prev) => ({
                        ...prev,
                        uiDays: Number.parseInt(event.target.value, 10) || 0,
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orders-days-back">Days Back</Label>
                    <Input
                      id="orders-days-back"
                      type="number"
                      value={orderOptions.daysBack}
                      onChange={(event) => setOrderOptions((prev) => ({
                        ...prev,
                        daysBack: Number.parseInt(event.target.value, 10) || 0,
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orders-days-forward">Days Forward</Label>
                    <Input
                      id="orders-days-forward"
                      type="number"
                      value={orderOptions.daysForward}
                      onChange={(event) => setOrderOptions((prev) => ({
                        ...prev,
                        daysForward: Number.parseInt(event.target.value, 10) || 0,
                      }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <SyncCard
            type={type}
            title={config.title}
            description={config.description}
            icon={config.icon}
            footer={config.footer}
            status={status}
            onSync={(syncType) => handleSync(syncType, syncType === 'orders' ? orderSyncOptions : undefined)}
            lastSyncAt={lastSyncAt}
            storedLog={storedLog}
          />
        </div>
      </PageContainer>
    </div>
  );
}
