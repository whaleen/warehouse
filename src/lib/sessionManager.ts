import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { InventoryItem } from '@/types/inventory';
import type { ScanningSession, SessionStatus, SessionSummary } from '@/types/session';

const SESSION_TABLE = 'scanning_sessions';

type SessionRecord = {
  id: string;
  name: string;
  inventory_type: ScanningSession['inventoryType'];
  sub_inventory: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at?: string | null;
  closed_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  closed_by?: string | null;
  items: InventoryItem[];
  scanned_item_ids: string[];
};

function toSession(record: SessionRecord): ScanningSession {
  return {
    id: record.id,
    name: record.name,
    inventoryType: record.inventory_type,
    subInventory: record.sub_inventory ?? undefined,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? undefined,
    closedAt: record.closed_at ?? undefined,
    createdBy: record.created_by ?? undefined,
    updatedBy: record.updated_by ?? undefined,
    closedBy: record.closed_by ?? undefined,
    items: Array.isArray(record.items) ? record.items : [],
    scannedItemIds: Array.isArray(record.scanned_item_ids) ? record.scanned_item_ids : []
  };
}

function toSummary(record: SessionRecord): SessionSummary {
  const items = Array.isArray(record.items) ? record.items : [];
  const scanned = Array.isArray(record.scanned_item_ids) ? record.scanned_item_ids : [];

  return {
    id: record.id,
    name: record.name,
    inventoryType: record.inventory_type,
    subInventory: record.sub_inventory ?? undefined,
    status: record.status,
    totalItems: items.length,
    scannedCount: scanned.length,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? undefined,
    closedAt: record.closed_at ?? undefined,
    createdBy: record.created_by ?? undefined
  };
}

export async function getAllSessions(): Promise<{ data: ScanningSession[] | null; error: any }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as SessionRecord[]).map(toSession),
    error: null
  };
}

export async function getSessionSummaries(): Promise<{ data: SessionSummary[] | null; error: any }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('id, name, inventory_type, sub_inventory, status, created_at, updated_at, closed_at, created_by, items, scanned_item_ids')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as SessionRecord[]).map(toSummary),
    error: null
  };
}

export async function getSession(sessionId: string): Promise<{ data: ScanningSession | null; error: any }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('id', sessionId)
    .eq('location_id', locationId)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toSession(data as SessionRecord), error: null };
}

export async function createSession(input: {
  name: string;
  inventoryType: ScanningSession['inventoryType'];
  subInventory?: string;
  items: InventoryItem[];
  status?: SessionStatus;
  createdBy?: string;
}): Promise<{ data: ScanningSession | null; error: any }> {
  const { locationId, companyId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .insert({
      company_id: companyId,
      location_id: locationId,
      name: input.name,
      inventory_type: input.inventoryType,
      sub_inventory: input.subInventory ?? null,
      status: input.status ?? 'active',
      items: input.items,
      scanned_item_ids: [],
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toSession(data as SessionRecord), error: null };
}

export async function updateSessionScannedItems(input: {
  sessionId: string;
  scannedItemIds: string[];
  updatedBy?: string;
}): Promise<{ data: ScanningSession | null; error: any }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .update({
      scanned_item_ids: input.scannedItemIds,
      updated_by: input.updatedBy ?? null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.sessionId)
    .eq('location_id', locationId)
    .select('*')
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toSession(data as SessionRecord), error: null };
}

export async function updateSessionStatus(input: {
  sessionId: string;
  status: SessionStatus;
  updatedBy?: string;
}): Promise<{ data: ScanningSession | null; error: any }> {
  const { locationId } = getActiveLocationContext();
  const { data: current, error: currentError } = await supabase
    .from(SESSION_TABLE)
    .select('status, items, scanned_item_ids')
    .eq('id', input.sessionId)
    .eq('location_id', locationId)
    .single();

  if (currentError) {
    return { data: null, error: currentError };
  }

  const currentStatus = (current as { status?: SessionStatus } | null)?.status;
  if (currentStatus === 'closed' && input.status !== 'closed') {
    return { data: null, error: new Error('Session is closed and cannot be reopened') };
  }

  const updates: Record<string, any> = {
    status: input.status,
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString()
  };

  if (input.status === 'closed') {
    updates.closed_at = new Date().toISOString();
    updates.closed_by = input.updatedBy ?? null;
  }

  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .update(updates)
    .eq('id', input.sessionId)
    .eq('location_id', locationId)
    .select('*')
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toSession(data as SessionRecord), error: null };
}

export async function deleteSession(sessionId: string): Promise<{ success: boolean; error?: any }> {
  const { locationId } = getActiveLocationContext();
  const { error } = await supabase
    .from(SESSION_TABLE)
    .delete()
    .eq('id', sessionId)
    .eq('location_id', locationId);

  return { success: !error, error };
}
