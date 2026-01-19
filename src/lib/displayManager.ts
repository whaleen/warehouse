import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import type { FloorDisplay, FloorDisplaySummary, DisplayState } from '@/types/display';

const TABLE = 'floor_displays';

type DisplayRecord = {
  id: string;
  company_id: string;
  location_id: string;
  name: string;
  pairing_code: string;
  paired: boolean;
  state_json: DisplayState;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string | null;
};

function toDisplay(record: DisplayRecord): FloorDisplay {
  return {
    id: record.id,
    companyId: record.company_id,
    locationId: record.location_id,
    name: record.name,
    pairingCode: record.pairing_code,
    paired: record.paired,
    stateJson: record.state_json ?? {},
    lastHeartbeat: record.last_heartbeat ?? undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? undefined,
  };
}

function toSummary(record: DisplayRecord): FloorDisplaySummary {
  return {
    id: record.id,
    name: record.name,
    paired: record.paired,
    lastHeartbeat: record.last_heartbeat ?? undefined,
    createdAt: record.created_at,
    stateJson: record.state_json ?? {},
  };
}

function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const defaultDisplayState: DisplayState = {
  theme: 'light',
  refreshInterval: 30000,
  loadBoard: {
    statusFilter: 'both',
    pageSize: 8,
    autoRotate: false,
    rotateIntervalSec: 12,
  },
  layout: {
    columns: 2,
    rows: 1,
    widgets: [
      { id: '1', type: 'asis-overview', title: 'ASIS Overview' },
      { id: '2', type: 'asis-loads', title: 'ASIS Loads' },
    ],
  },
};

export async function getAllDisplays(): Promise<{ data: FloorDisplaySummary[] | null; error: unknown }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, paired, last_heartbeat, created_at, state_json')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as DisplayRecord[]).map(toSummary),
    error: null,
  };
}

export async function getDisplay(displayId: string): Promise<{ data: FloorDisplay | null; error: unknown }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', displayId)
    .eq('location_id', locationId)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toDisplay(data as DisplayRecord), error: null };
}

export async function getDisplayByCode(pairingCode: string): Promise<{ data: FloorDisplay | null; error: unknown }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('pairing_code', pairingCode)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toDisplay(data as DisplayRecord), error: null };
}

export async function getDisplayByIdPublic(displayId: string): Promise<{ data: FloorDisplay | null; error: unknown }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', displayId)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toDisplay(data as DisplayRecord), error: null };
}

export async function createDisplay(input: {
  name?: string;
}): Promise<{ data: FloorDisplay | null; error: unknown }> {
  const { locationId, companyId } = getActiveLocationContext();
  const pairingCode = generatePairingCode();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      company_id: companyId,
      location_id: locationId,
      name: input.name ?? 'Floor Display',
      pairing_code: pairingCode,
      paired: false,
      state_json: defaultDisplayState,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toDisplay(data as DisplayRecord), error: null };
}

export async function pairDisplay(pairingCode: string): Promise<{ data: FloorDisplay | null; error: unknown }> {
  const { locationId, companyId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      paired: true,
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('pairing_code', pairingCode)
    .eq('location_id', locationId)
    .eq('paired', false)
    .select('*')
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (data) {
    return { data: toDisplay(data as DisplayRecord), error: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from(TABLE)
    .insert({
      company_id: companyId,
      location_id: locationId,
      name: 'Floor Display',
      pairing_code: pairingCode,
      paired: true,
      state_json: defaultDisplayState,
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    return { data: null, error: insertError ?? new Error('Display not found or already paired') };
  }

  return { data: toDisplay(inserted as DisplayRecord), error: null };
}

export async function updateDisplayState(
  displayId: string,
  stateJson: DisplayState
): Promise<{ data: FloorDisplay | null; error: unknown }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      state_json: stateJson,
      updated_at: new Date().toISOString(),
    })
    .eq('id', displayId)
    .eq('location_id', locationId)
    .select('*')
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toDisplay(data as DisplayRecord), error: null };
}

export async function updateDisplayName(
  displayId: string,
  name: string
): Promise<{ data: FloorDisplay | null; error: unknown }> {
  const { locationId } = getActiveLocationContext();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', displayId)
    .eq('location_id', locationId)
    .select('*')
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return { data: toDisplay(data as DisplayRecord), error: null };
}

export async function recordHeartbeat(displayId: string): Promise<{ success: boolean; error?: unknown }> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      last_heartbeat: new Date().toISOString(),
    })
    .eq('id', displayId);

  return { success: !error, error };
}

export async function deleteDisplay(displayId: string): Promise<{ success: boolean; error?: unknown }> {
  const { locationId } = getActiveLocationContext();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', displayId)
    .eq('location_id', locationId);

  return { success: !error, error };
}

export function subscribeToDisplay(
  displayId: string,
  callback: (display: FloorDisplay) => void,
  onStatus?: (status: string) => void
): () => void {
  const channel = supabase
    .channel(`display:${displayId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE,
        filter: `id=eq.${displayId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(toDisplay(payload.new as DisplayRecord));
        }
      }
    )
    .subscribe((status) => {
      onStatus?.(status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
