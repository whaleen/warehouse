import { getSupabase } from '../db/supabase.js';

export const DATABASE_SCHEMA = `
-- Main inventory table
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY,
  location_id uuid REFERENCES locations(id),
  product_fk uuid REFERENCES products(id),
  serial_number text,
  cso_number text,
  model text,
  product_type text,
  sub_inventory text,
  description text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
);

-- Products reference table
CREATE TABLE products (
  id uuid PRIMARY KEY,
  location_id uuid REFERENCES locations(id),
  product_type text,
  model text,
  description text,
  created_at timestamptz
);

-- Product locations (GPS data from scans)
CREATE TABLE product_locations (
  id uuid PRIMARY KEY,
  location_id uuid REFERENCES locations(id),
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
  location_id uuid REFERENCES locations(id),
  name text,
  status text, -- 'open', 'closed'
  session_type text,
  inventory_type text,
  sub_inventory text,
  created_at timestamptz,
  updated_at timestamptz
);

-- Session items (what was scanned in each session)
CREATE TABLE session_items (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES scanning_sessions(id),
  inventory_item_id uuid REFERENCES inventory_items(id),
  scanned_at timestamptz
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
