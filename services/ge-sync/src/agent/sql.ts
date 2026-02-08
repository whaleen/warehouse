import { getSupabase } from '../db/supabase.js';

export const DATABASE_SCHEMA = `
-- Main inventory table
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY,
  company_id uuid,
  location_id uuid,
  product_fk uuid REFERENCES products(id),
  serial text,
  cso text,
  model text,
  product_type text,
  sub_inventory text,
  inventory_type text,
  status text,
  is_scanned boolean,
  scanned_at timestamptz,
  scanned_by text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
);

-- Products reference table
CREATE TABLE products (
  id uuid PRIMARY KEY,
  model text UNIQUE,
  product_type text,
  brand text,
  description text,
  created_at timestamptz
);

-- Product location history (GPS data from scans)
CREATE TABLE product_location_history (
  id uuid PRIMARY KEY,
  company_id uuid,
  location_id uuid,
  product_id uuid REFERENCES products(id),
  inventory_item_id uuid REFERENCES inventory_items(id),
  scanning_session_id uuid REFERENCES scanning_sessions(id),
  raw_lat numeric,
  raw_lng numeric,
  accuracy numeric,
  scanned_by text,
  product_type text,
  sub_inventory text,
  created_at timestamptz
);

-- Scanning sessions
CREATE TABLE scanning_sessions (
  id uuid PRIMARY KEY,
  company_id uuid,
  location_id uuid,
  name text,
  status text,
  inventory_type text,
  sub_inventory text,
  created_at timestamptz,
  updated_at timestamptz
);
`;

const DANGEROUS_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'TRUNCATE',
  'REPLACE',
  'MERGE',
  'GRANT',
  'REVOKE',
  'EXEC',
  'EXECUTE',
  'CALL',
];

const validateSQLQuery = (query: string): { valid: boolean; error?: string } => {
  const trimmed = query.trim().toUpperCase();

  if (!trimmed.startsWith('SELECT')) {
    return { valid: false, error: 'Query must start with SELECT' };
  }

  for (const keyword of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(trimmed)) {
      return { valid: false, error: `Dangerous keyword not allowed: ${keyword}` };
    }
  }

  const semicolonCount = (query.match(/;/g) || []).length;
  if (semicolonCount > 1 || (semicolonCount === 1 && !query.trim().endsWith(';'))) {
    return { valid: false, error: 'Multiple statements not allowed' };
  }

  return { valid: true };
};

export async function executeSQLQuery(query: string): Promise<{ data: Record<string, unknown>[] | null; error: string | null }> {
  const validation = validateSQLQuery(query);
  if (!validation.valid) {
    return { data: null, error: validation.error || 'Invalid query' };
  }

  try {
    const db = getSupabase();
    const { data, error } = await db.rpc('execute_readonly_query', {
      query_text: query,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query execution failed';
    return { data: null, error: message };
  }
}

export async function findItemByIdentifier(identifier: string) {
  const trimmed = identifier.trim().replace(/'/g, "''"); // Escape quotes for SQL safety

  // Query using actual schema column names
  const query = `SELECT i.id, i.serial, i.cso, i.model, i.product_type, i.sub_inventory, i.status, i.inventory_type, p.description as product_description FROM inventory_items i LEFT JOIN products p ON i.product_fk = p.id WHERE i.serial ILIKE '%${trimmed}%' OR i.cso ILIKE '%${trimmed}%' OR i.model ILIKE '%${trimmed}%' LIMIT 10;`;

  const result = await executeSQLQuery(query);

  if (result.error || !result.data || result.data.length === 0) {
    return result;
  }

  type ItemRow = Record<string, unknown> & { id?: string };
  type LocationRow = Record<string, unknown> & { inventory_item_id?: string };

  // Get GPS data from product_location_history
  const itemIds = (result.data as ItemRow[])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => `'${id.replace(/'/g, "''")}'`)
    .join(',');

  if (!itemIds) {
    return result;
  }
  const locationQuery = `SELECT DISTINCT ON (inventory_item_id) inventory_item_id, raw_lat, raw_lng, created_at as last_scanned_at, scanned_by FROM product_location_history WHERE inventory_item_id IN (${itemIds}) ORDER BY inventory_item_id, created_at DESC;`;

  const locationResult = await executeSQLQuery(locationQuery);

  // Merge location data with item data
  if (locationResult.data) {
    const locationMap = new Map(
      (locationResult.data as LocationRow[])
        .filter((loc) => typeof loc.inventory_item_id === 'string')
        .map((loc) => [loc.inventory_item_id as string, loc])
    );
    result.data = (result.data as ItemRow[]).map((item) => {
      const itemId = item.id;
      return {
        ...item,
        ...(itemId ? (locationMap.get(itemId) || {}) : {}),
      };
    });
  }

  return result;
}
