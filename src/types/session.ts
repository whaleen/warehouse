import type { InventoryItem, InventoryType } from './inventory';

export type SessionStatus = 'draft' | 'active' | 'closed';
export type SessionSource = 'manual' | 'ge_sync' | 'system';

export interface ScanningSession {
  id: string;
  name: string;
  inventoryType: InventoryType;
  subInventory?: string; // Optional filter (e.g., specific route for Staged)
  status: SessionStatus;
  sessionSource?: SessionSource;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  closedBy?: string;
  items: InventoryItem[]; // Snapshot of items at session start
  scannedItemIds: string[]; // IDs of items scanned in this session
}

export interface SessionSummary {
  id: string;
  name: string;
  inventoryType: InventoryType;
  subInventory?: string;
  status: SessionStatus;
  sessionSource?: SessionSource;
  totalItems: number;
  scannedCount: number;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  createdBy?: string;
}
