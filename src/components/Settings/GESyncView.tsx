import { GESyncIndexView } from "./GESyncIndexView";
import { GESyncDetailView } from "./GESyncDetailView";
import type { SyncType } from "@/hooks/useSyncHandler";

interface GESyncViewProps {
  onMenuClick?: () => void;
}

function getSyncTypeFromUrl(): SyncType | null {
  const path = window.location.pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);
  // segments: ['settings', 'gesync', 'asis']
  const type = segments[2];
  const validTypes: SyncType[] = ['asis', 'fg', 'sta', 'inbound', 'backhaul', 'inventory'];
  return validTypes.includes(type as SyncType) ? (type as SyncType) : null;
}

export function GESyncView({ onMenuClick }: GESyncViewProps) {
  const syncType = getSyncTypeFromUrl();

  if (syncType) {
    return <GESyncDetailView type={syncType} onMenuClick={onMenuClick} />;
  }

  return <GESyncIndexView onMenuClick={onMenuClick} />;
}
