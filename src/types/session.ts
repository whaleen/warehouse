import type { InventoryType } from './inventory';

export type SessionStatus = 'draft' | 'active' | 'closed';
export type SessionSource = 'manual' | 'ge_sync' | 'system';

export interface ScanningSession {
  id: string;
  name: string;
  inventoryType: InventoryType;
  subInventory?: string; // Which load/bucket to scan
  status: SessionStatus;
  sessionSource?: SessionSource;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  closedBy?: string;
  // NO SNAPSHOTS - query items dynamically from inventory_items by inventoryType + subInventory
  scannedItemIds: string[]; // IDs of items scanned in this session
}

export interface SessionSummary {
  id: string;
  name: string;
  inventoryType: InventoryType;
  subInventory?: string;
  status: SessionStatus;
  sessionSource?: SessionSource;
  scannedCount: number; // Length of scannedItemIds array
  // totalItems removed - query dynamically from inventory_items, don't cache it
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  createdBy?: string;
}
