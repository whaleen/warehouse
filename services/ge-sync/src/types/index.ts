/**
 * Shared types for GE Sync Service
 * These mirror the types in the main app but are kept separate for service isolation
 */

export type InventoryType =
  | 'ASIS'
  | 'BackHaul'
  | 'Staged'
  | 'STA'
  | 'Inbound'
  | 'WillCall'
  | 'FG'
  | 'LocalStock'
  | 'Parts'
  | 'UNKNOWN'
  | (string & {});

export type GEChangeType =
  | 'item_appeared'
  | 'item_disappeared'
  | 'item_status_changed'
  | 'item_reserved'
  | 'item_load_changed'
  | 'item_qty_changed'
  | 'item_bucket_changed'
  | 'item_state_changed'
  | 'item_source_changed'
  | 'item_migrated'
  | 'load_appeared'
  | 'load_disappeared'
  | 'load_sold'
  | 'load_cso_assigned'
  | 'load_cso_status_changed'
  | 'load_units_changed';

export interface GEChange {
  company_id: string;
  location_id: string;
  inventory_type: InventoryType;
  inventory_bucket?: string;
  inventory_state?: string;
  source_type?: string;
  source_id?: string;
  serial?: string;
  model?: string;
  load_number?: string;
  cso?: string;
  change_type: GEChangeType;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  previous_state?: Record<string, unknown>;
  current_state?: Record<string, unknown>;
  source: string;
}

export interface GEInventoryItem {
  'Model #': string;
  'Serial #': string;
  'Inv Qty': string;
  'Availability Status': string;
  'Availability Message': string;
  'LOAD NUMBER'?: string;
  'Load Number'?: string;
}

export interface GELoadMetadata {
  'Load Number': string;
  Units: string;
  Notes: string;
  'Scanned Date/Time': string;
  Status: string;
}

export interface GELoadItem {
  ORDC: string;
  MODELS: string;
  SERIALS: string;
  QTY: string;
  'LOAD NUMBER': string;
}

export interface GEReportHistoryItem {
  'Inv Org': string;
  'Load Number': string;
  'Submitted Date': string;
  CSO: string;
  Status: string;
  Pricing: string;
  'CSO Status': string;
  Units: string;
}

export interface GELoadInfo {
  loadNumber: string;
  status: string;
  csoStatus: string;
  units: number;
  notes?: string;
  submittedDate?: string;
  cso?: string;
}

export interface SyncStats {
  totalGEItems: number;
  itemsInLoads: number;
  unassignedItems: number;
  newItems: number;
  updatedItems: number;
  forSaleLoads: number;
  pickedLoads: number;
  changesLogged: number;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  stats: SyncStats;
  changes?: GEChange[];
  log?: string[];
  error?: string;
  duration?: number;
  details?: Record<string, SyncResult | null>; // For unified sync results
}

export interface AuthStatus {
  authenticated: boolean;
  cookiesValid: boolean;
  lastAuthAt?: string;
  expiresAt?: string;
}

export interface LocationConfig {
  companyId: string;
  locationId: string;
  invOrg: string; // e.g., "9SU"
}
