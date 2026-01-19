export type DisplayWidget = {
  id: string;
  type:
    | 'loads-summary'
    | 'parts-alerts'
    | 'active-sessions'
    | 'clock'
    | 'text'
    | 'asis-overview'
    | 'asis-loads';
  title?: string;
  config?: Record<string, unknown>;
};

export type DisplayLayout = {
  columns?: number;
  rows?: number;
  widgets: DisplayWidget[];
};

export type LoadBoardConfig = {
  statusFilter?: 'for-sale' | 'sold-picked' | 'both';
  pageSize?: number;
  autoRotate?: boolean;
  rotateIntervalSec?: number;
};

export type DisplayState = {
  layout?: DisplayLayout;
  theme?: 'dark' | 'light';
  refreshInterval?: number;
  title?: string;
  loadBoard?: LoadBoardConfig;
};

export type FloorDisplay = {
  id: string;
  companyId: string;
  locationId: string;
  name: string;
  pairingCode: string;
  paired: boolean;
  stateJson: DisplayState;
  lastHeartbeat?: string;
  createdAt: string;
  updatedAt?: string;
};

export type FloorDisplaySummary = {
  id: string;
  name: string;
  paired: boolean;
  lastHeartbeat?: string;
  createdAt: string;
  stateJson?: DisplayState;
};
