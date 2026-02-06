import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { PostgrestError } from '@supabase/supabase-js';
import type { InventoryType } from '@/types/inventory';
import type { ScanningSession, SessionSource, SessionStatus, SessionSummary } from '@/types/session';

const SESSION_TABLE = 'scanning_sessions';

type SessionRecord = {
  id: string;
  name: string;
  inventory_type: ScanningSession['inventoryType'];
  sub_inventory: string | null;
  status: SessionStatus;
  session_source?: SessionSource | null;
  created_at: string;
  updated_at?: string | null;
  closed_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  closed_by?: string | null;
  // NO items field - no snapshots
  scanned_item_ids: string[];
};

function toSession(record: SessionRecord): ScanningSession {
  return {
    id: record.id,
    name: record.name,
    inventoryType: record.inventory_type,
    subInventory: record.sub_inventory ?? undefined,
    status: record.status,
    sessionSource: record.session_source ?? undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? undefined,
    closedAt: record.closed_at ?? undefined,
    createdBy: record.created_by ?? undefined,
    updatedBy: record.updated_by ?? undefined,
    closedBy: record.closed_by ?? undefined,
    // NO items - query dynamically when needed
    scannedItemIds: Array.isArray(record.scanned_item_ids) ? record.scanned_item_ids : []
  };
}

function toSummary(record: SessionRecord): SessionSummary {
  const scanned = Array.isArray(record.scanned_item_ids) ? record.scanned_item_ids : [];

  return {
    id: record.id,
    name: record.name,
    inventoryType: record.inventory_type,
    subInventory: record.sub_inventory ?? undefined,
    status: record.status,
    sessionSource: record.session_source ?? undefined,
    scannedCount: scanned.length,
    // NO totalItems - query it dynamically from inventory_items when needed
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? undefined,
    closedAt: record.closed_at ?? undefined,
    createdBy: record.created_by ?? undefined
  };
}

export async function getAllSessions(): Promise<{ data: ScanningSession[] | null; error: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('location_id', locationId)
    .in('session_source', ['ge_sync', 'system'])
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as SessionRecord[]).map(toSession),
    error: null
  };
}

export async function getSessionSummaries(): Promise<{ data: SessionSummary[] | null; error: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('id, name, inventory_type, sub_inventory, status, session_source, created_at, updated_at, closed_at, created_by, scanned_item_ids')
    .eq('location_id', locationId)
    .in('session_source', ['ge_sync', 'system'])
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as SessionRecord[]).map(toSummary),
    error: null
  };
}

export async function getSession(sessionId: string): Promise<{ data: ScanningSession | null; error: PostgrestError | null }> {
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

export async function updateSessionScannedItems(input: {
  sessionId: string;
  scannedItemIds: string[];
  updatedBy?: string;
}): Promise<{ data: ScanningSession | null; error: PostgrestError | null }> {
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
}): Promise<{ data: ScanningSession | null; error: PostgrestError | Error | null }> {
  const { locationId } = getActiveLocationContext();
  const { data: current, error: currentError } = await supabase
    .from(SESSION_TABLE)
    .select('status, scanned_item_ids')
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

  const updates: {
    status: SessionStatus;
    updated_by: string | null;
    updated_at: string;
    closed_at?: string;
    closed_by?: string | null;
  } = {
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

export async function deleteSession(sessionId: string): Promise<{ success: boolean; error?: PostgrestError | null }> {
  const { locationId } = getActiveLocationContext();
  const { error } = await supabase
    .from(SESSION_TABLE)
    .delete()
    .eq('id', sessionId)
    .eq('location_id', locationId);

  return { success: !error, error };
}

function mapGeStatusToSessionStatus(geStatus?: string | null): SessionStatus {
  if (!geStatus) return 'active';
  const normalized = geStatus.trim().toLowerCase();
  return ['delivered', 'completed', 'closed'].includes(normalized) ? 'closed' : 'active';
}

// Deprecated functions removed - sessions now query items dynamically

export async function getOrCreateLoadSession(
  subInventoryName: string,
  geStatus: string,
  friendlyName?: string
): Promise<{ sessionId: string | null; error?: unknown }> {
  const { locationId, companyId } = getActiveLocationContext();

  try {
    const { data: existing, error: findError } = await supabase
      .from(SESSION_TABLE)
      .select('id, status')
      .eq('location_id', locationId)
      .eq('inventory_type', 'ASIS')
      .eq('sub_inventory', subInventoryName)
      .eq('session_source', 'ge_sync')
      .maybeSingle();

    if (findError) {
      return { sessionId: null, error: findError };
    }

    const mappedStatus = mapGeStatusToSessionStatus(geStatus);
    const sessionId = existing?.id ?? null;

    if (sessionId) {
      if (existing && existing.status !== mappedStatus) {
        await supabase
          .from(SESSION_TABLE)
          .update({ status: mappedStatus, updated_at: new Date().toISOString() })
          .eq('id', sessionId)
          .eq('location_id', locationId);
      }

      // NO ownership assignment or snapshot refresh - query dynamically!
      return { sessionId };
    }

    const { data: created, error: createError } = await supabase
      .from(SESSION_TABLE)
      .insert({
        company_id: companyId,
        location_id: locationId,
        name: friendlyName || `Load ${subInventoryName}`,
        inventory_type: 'ASIS',
        sub_inventory: subInventoryName,
        status: mappedStatus,
        session_source: 'ge_sync',
        scanned_item_ids: [],
        created_by: 'system',
        updated_by: 'system',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError || !created) {
      return { sessionId: null, error: createError };
    }

    // NO ownership assignment or snapshot refresh - query dynamically!
    return { sessionId: created.id };
  } catch (err) {
    return { sessionId: null, error: err };
  }
}

export async function getOrCreateInventoryTypeSession(
  inventoryType: InventoryType,
  name?: string
): Promise<{ sessionId: string | null; error?: unknown }> {
  const { locationId, companyId } = getActiveLocationContext();

  try {
    const { data: existing, error: findError } = await supabase
      .from(SESSION_TABLE)
      .select('id, status')
      .eq('location_id', locationId)
      .eq('inventory_type', inventoryType)
      .is('sub_inventory', null)
      .eq('session_source', 'ge_sync')
      .maybeSingle();

    if (findError) {
      return { sessionId: null, error: findError };
    }

    const sessionName = name ?? `${inventoryType} Inventory`;
    const sessionId = existing?.id ?? null;

    if (sessionId) {
      if (existing && existing.status !== 'active') {
        await supabase
          .from(SESSION_TABLE)
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', sessionId)
          .eq('location_id', locationId);
      }

      // NO ownership assignment or snapshot refresh - query dynamically!
      return { sessionId };
    }

    const { data: created, error: createError } = await supabase
      .from(SESSION_TABLE)
      .insert({
        company_id: companyId,
        location_id: locationId,
        name: sessionName,
        inventory_type: inventoryType,
        sub_inventory: null,
        status: 'active',
        session_source: 'ge_sync',
        scanned_item_ids: [],
        created_by: 'system',
        updated_by: 'system',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError || !created) {
      return { sessionId: null, error: createError };
    }

    // NO ownership assignment or snapshot refresh - query dynamically!
    return { sessionId: created.id };
  } catch (err) {
    return { sessionId: null, error: err };
  }
}

type GeSyncSessionType = 'asis' | 'fg' | 'sta';

export async function createSessionsFromSync(type: GeSyncSessionType): Promise<{ success: boolean; error?: unknown }> {
  const { locationId } = getActiveLocationContext();
  if (!locationId) {
    return { success: false, error: new Error('No active location selected') };
  }

  try {
    if (type === 'asis') {
      const { data: loads, error } = await supabase
        .from('load_metadata')
        .select('sub_inventory_name, status, ge_source_status, friendly_name')
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS');

      if (error) {
        return { success: false, error };
      }

      for (const load of loads ?? []) {
        const status = (load as { status?: string | null; ge_source_status?: string | null }).status
          ?? (load as { ge_source_status?: string | null }).ge_source_status
          ?? 'active';
        await getOrCreateLoadSession(
          (load as { sub_inventory_name: string }).sub_inventory_name,
          status,
          (load as { friendly_name?: string | null }).friendly_name ?? undefined
        );
      }

      return { success: true };
    }

    if (type === 'fg') {
      await getOrCreateInventoryTypeSession('FG');
      await getOrCreateInventoryTypeSession('BackHaul');
      return { success: true };
    }

    if (type === 'sta') {
      await getOrCreateInventoryTypeSession('STA');
      return { success: true };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

/**
 * Get or create a permanent session for quick scans
 * These sessions are never closed and are reused for all quick scans
 */
async function getOrCreatePermanentSession(name: string, subInventory: string): Promise<{ sessionId: string | null; error?: unknown }> {
  const { locationId, companyId } = getActiveLocationContext();

  try {
    // Try to find existing session
    const { data: existing, error: findError } = await supabase
      .from(SESSION_TABLE)
      .select('id')
      .eq('location_id', locationId)
      .eq('name', name)
      .eq('session_source', 'system')
      .maybeSingle();

    if (findError) {
      return { sessionId: null, error: findError };
    }

    // If found, return it
    if (existing) {
      return { sessionId: existing.id };
    }

    // Create new permanent session
    const { data: created, error: createError } = await supabase
      .from(SESSION_TABLE)
      .insert({
        company_id: companyId,
        location_id: locationId,
        name,
        inventory_type: 'all',
        sub_inventory: subInventory,
        status: 'active',
        session_source: 'system',
        scanned_item_ids: [],
        created_by: 'system',
        updated_by: 'system',
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createError || !created) {
      return { sessionId: null, error: createError };
    }

    return { sessionId: created.id };
  } catch (err) {
    return { sessionId: null, error: err };
  }
}

/**
 * Get or create the permanent "Ad-hoc Scans" session for test/garbage scans
 */
export async function getOrCreateAdHocSession(): Promise<{ sessionId: string | null; error?: unknown }> {
  return getOrCreatePermanentSession('🧪 Ad-hoc Scans', 'Ad-hoc');
}

/**
 * Get or create the permanent "Fog of War" session for inventory position updates
 */
export async function getOrCreateFogOfWarSession(): Promise<{ sessionId: string | null; error?: unknown }> {
  return getOrCreatePermanentSession('🗺️ Fog of War', 'Fog of War');
}
