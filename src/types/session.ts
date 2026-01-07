import type { InventoryItem, InventoryType } from './inventory';

export interface ScanningSession {
  id: string;
  name: string;
  inventoryType: InventoryType;
  subInventory?: string; // Optional filter (e.g., specific route for Staged)
  createdAt: string;
  items: InventoryItem[]; // Snapshot of items at session start
  scannedItemIds: string[]; // IDs of items scanned in this session
}

export interface SessionSummary {
  id: string;
  name: string;
  inventoryType: InventoryType;
  totalItems: number;
  scannedCount: number;
  createdAt: string;
}
