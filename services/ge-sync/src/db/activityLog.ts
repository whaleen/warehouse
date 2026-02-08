import { getSupabase } from './supabase.js';

interface LogActivityParams {
  locationId: string;
  companyId: string;
  action: 'asis_sync' | 'asis_wipe' | 'fg_sync' | 'sta_sync' | 'inventory_sync' | 'inbound_sync' | 'backhaul_sync';
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}

/**
 * Log GE sync activity to activity_log table
 * Since this is a system action, user_id is set to NULL
 */
export async function logSyncActivity(params: LogActivityParams): Promise<void> {
  const { locationId, companyId, action, success, details, error } = params;

  const db = getSupabase();

  const payload = {
    company_id: companyId,
    location_id: locationId,
    user_id: null, // System action - no user
    actor_name: 'GE Sync Service',
    actor_image: null,
    action,
    entity_type: 'sync',
    entity_id: null,
    details: {
      success,
      ...details,
      ...(error ? { error } : {}),
    },
  };

  const { error: insertError } = await db.from('activity_log').insert(payload);

  if (insertError) {
    console.error('Failed to log sync activity:', insertError);
    // Don't throw - logging failure shouldn't break sync
  }
}
