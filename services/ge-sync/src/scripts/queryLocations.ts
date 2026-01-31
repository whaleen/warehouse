#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabase } from '../db/supabase.js';

async function main() {
  const db = getSupabase();

  const { data, error } = await db
    .from('locations')
    .select('id, name, slug');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('\nAvailable Locations:\n');
  data?.forEach((loc) => {
    console.log(`  ${loc.name} (${loc.slug})`);
    console.log(`    ID: ${loc.id}\n`);
  });
}

main();
