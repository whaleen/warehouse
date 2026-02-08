import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY; // Use service key for server-side operations

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }

  supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabase;
}

/**
 * Get location config from settings table
 */
export async function getLocationConfig(locationId: string) {
  const db = getSupabase();

  const { data: location, error: locError } = await db
    .from('locations')
    .select('id, company_id, slug, name')
    .eq('id', locationId)
    .single();

  if (locError || !location) {
    throw new Error(`Location not found: ${locationId}`);
  }

  const { data: settings, error: setError } = await db
    .from('settings')
    .select('sso_username, sso_password')
    .eq('location_id', locationId)
    .single();

  if (setError) {
    console.warn(`No settings found for location ${locationId}`);
  }

  return {
    companyId: location.company_id,
    locationId: location.id,
    slug: location.slug,
    name: location.name,
    ssoUsername: settings?.sso_username,
    ssoPassword: settings?.sso_password,
  };
}

/**
 * Get product lookup map for model -> product info
 */
function normalizeModelKey(model: string): string {
  return model.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getProductLookup(_companyId: string) {
  const db = getSupabase();

  // Products are a global catalog - no company_id filtering
  const { data: products, error } = await db
    .from('products')
    .select('id, model, product_type');

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  const lookup = new Map<string, { id: string; product_type: string }>();
  for (const p of products || []) {
    if (p.model) {
      const raw = p.model.trim();
      if (raw) {
        lookup.set(raw, { id: p.id, product_type: p.product_type });
        lookup.set(raw.toUpperCase(), { id: p.id, product_type: p.product_type });
        lookup.set(normalizeModelKey(raw), { id: p.id, product_type: p.product_type });
      }
    }
  }

  return lookup;
}

/**
 * Update last sync timestamp for a specific sync type
 */
export async function updateSyncTimestamp(
  locationId: string,
  syncType: 'asis' | 'fg' | 'sta' | 'inbound' | 'backhaul' | 'inventory'
) {
  const db = getSupabase();
  const columnName = `last_sync_${syncType}_at`;

  const { error } = await db
    .from('settings')
    .update({ [columnName]: new Date().toISOString() })
    .eq('location_id', locationId);

  if (error) {
    console.error(`Failed to update ${columnName}:`, error);
  }
}
