import { AppHeader } from "@/components/Navigation/AppHeader";
import { Button } from "@/components/ui/button";
import { Database, Package, Truck, ClipboardList, Archive, RefreshCw, ChevronLeft } from "lucide-react";
import { PageContainer } from "@/components/Layout/PageContainer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSyncHandler } from "@/hooks/useSyncHandler";
import { SyncCard } from "@/components/Sync";
import type { SyncType } from "@/hooks/useSyncHandler";

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
    description: "Sync staged items for delivery",
    icon: Truck,
    footer: undefined,
  },
  inbound: {
    title: "Inbound Receipts",
    description: "Sync inbound receiving reports",
    icon: ClipboardList,
    footer: undefined,
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
          <SyncCard
            type={type}
            title={config.title}
            description={config.description}
            icon={config.icon}
            footer={config.footer}
            status={status}
            onSync={handleSync}
            lastSyncAt={lastSyncAt}
            storedLog={storedLog}
          />
        </div>
      </PageContainer>
    </div>
  );
}
