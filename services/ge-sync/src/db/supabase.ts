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

export async function getProductLookup(companyId: string) {
  const db = getSupabase();

  const { data: products, error } = await db
    .from('products')
    .select('id, model, product_type')
    .eq('company_id', companyId);

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
