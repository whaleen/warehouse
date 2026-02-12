#!/usr/bin/env tsx
/**
 * Recalculate scanning progress for all loads
 * Run this after applying the load_work_progress_fields migration
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  console.error('Make sure .env file exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateAllLoadScanningProgress() {
  console.log('Fetching all loads...');

  // Get all loads
  const { data: loads, error: loadsError } = await supabase
    .from('load_metadata')
    .select('inventory_type, sub_inventory_name, location_id');

  if (loadsError) {
    throw new Error(`Failed to fetch loads: ${loadsError.message}`);
  }

  if (!loads || loads.length === 0) {
    console.log('No loads found');
    return;
  }

  console.log(`Found ${loads.length} loads. Calculating scanning progress...`);

  let successCount = 0;
  let errorCount = 0;

  for (const load of loads) {
    try {
      const { data: loadMetadata, error: loadMetaError } = await supabase
        .from('load_metadata')
        .select('ge_units')
        .eq('location_id', load.location_id)
        .eq('sub_inventory_name', load.sub_inventory_name)
        .single();

      if (loadMetaError) {
        console.warn(`Failed to load metadata for ${load.sub_inventory_name}:`, loadMetaError.message);
        errorCount++;
        continue;
      }

      const itemsTotal = loadMetadata?.ge_units || 0;

      const { data: loadItems, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, serial, qty')
        .eq('location_id', load.location_id)
        .eq('sub_inventory', load.sub_inventory_name);

      if (itemsError) {
        console.warn(`Failed to fetch items for ${load.sub_inventory_name}:`, itemsError.message);
        errorCount++;
        continue;
      }

      const itemIds = (loadItems || []).map(item => item.id).filter(Boolean);
      if (itemIds.length === 0) {
        const { error: updateError } = await supabase
          .from('load_metadata')
          .update({
            items_scanned_count: 0,
            items_total_count: itemsTotal,
            scanning_complete: false,
          })
          .eq('location_id', load.location_id)
          .eq('sub_inventory_name', load.sub_inventory_name);

        if (updateError) {
          console.warn(`Failed to update ${load.sub_inventory_name}:`, updateError.message);
          errorCount++;
        } else {
          console.log(`  ✓ ${load.sub_inventory_name}: 0/${itemsTotal} items scanned`);
          successCount++;
        }
        continue;
      }

      const { data: scannedRows, error: scannedError } = await supabase
        .from('product_location_history')
        .select('inventory_item_id')
        .eq('location_id', load.location_id)
        .in('inventory_item_id', itemIds);

      if (scannedError) {
        console.warn(`Failed to count scanned for ${load.sub_inventory_name}:`, scannedError.message);
        errorCount++;
        continue;
      }

      const scannedIds = new Set((scannedRows || []).map(row => row.inventory_item_id));
      const itemsScanned = (loadItems || []).reduce((sum, item) => {
        if (!item.id || !scannedIds.has(item.id)) return sum;
        const isSerialized = Boolean(item.serial && String(item.serial).trim());
        return sum + (isSerialized ? 1 : (item.qty ?? 1));
      }, 0);
      const isComplete = itemsTotal > 0 && itemsScanned >= itemsTotal;

      // Update load metadata
      const { error: updateError } = await supabase
        .from('load_metadata')
        .update({
          items_scanned_count: itemsScanned,
          items_total_count: itemsTotal,
          scanning_complete: isComplete,
        })
        .eq('location_id', load.location_id)
        .eq('inventory_type', load.inventory_type)
        .eq('sub_inventory_name', load.sub_inventory_name);

      if (updateError) {
        console.warn(`Failed to update ${load.sub_inventory_name}:`, updateError.message);
        errorCount++;
        continue;
      }

      console.log(`  ✓ ${load.sub_inventory_name}: ${itemsScanned}/${itemsTotal} items scanned`);
      successCount++;
    } catch (err) {
      console.warn(`Error processing ${load.sub_inventory_name}:`, err);
      errorCount++;
    }
  }

  console.log(`\nComplete! ${successCount} loads updated, ${errorCount} errors`);
}

async function main() {
  console.log('Starting scanning progress recalculation for all loads...');

  try {
    await recalculateAllLoadScanningProgress();
    console.log('✅ Successfully recalculated scanning progress for all loads');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to recalculate scanning progress:', error);
    process.exit(1);
  }
}

main();
