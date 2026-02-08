import * as XLSX from 'xlsx';
import { getCookieHeader } from '../auth/playwright.js';
import { getSupabase, getLocationConfig, getProductLookup } from '../db/supabase.js';
import { ENDPOINTS, HEADERS, REFERERS } from './endpoints.js';
import type { GEInventoryItem, GEChange, SyncResult, SyncStats } from '../types/index.js';

/**
 * Fetch XLS from GE endpoint and parse to JSON
 */
async function fetchXlsAsJson<T>(
  url: string,
  cookieHeader: string,
  method: 'GET' | 'POST' = 'GET',
  body?: string,
  referer?: string
): Promise<T[]> {
  const options: RequestInit = {
    method,
    headers: {
      ...HEADERS,
      ...(referer ? { Referer: referer } : {}),
      Cookie: cookieHeader,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body } : {}),
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const snippet = errorText.trim().slice(0, 200);
    const details = snippet ? ` Response: ${snippet}` : '';
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}.${details}`);
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<T>(firstSheet);

  return data;
}

/**
 * Get value from row with multiple possible keys
 */
function getRowValue(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null) {
      return String(val);
    }
  }
  return undefined;
}

/**
 * Build synthetic serial for items without real serials
 * Format: {prefix}:{parts joined by _}:{index}
 * Example: FG-NS:MODEL123_STATUS:1
 */
function buildSyntheticSerial(prefix: string, parts: (string | undefined)[], index: number): string {
  const normalizedParts = parts
    .filter((p): p is string => Boolean(p))
    .map((p) => p.trim().replace(/[^a-zA-Z0-9]/g, ''))
    .filter((p) => p.length > 0);

  const joined = normalizedParts.length > 0 ? normalizedParts.join('_') : 'UNKNOWN';
  return `${prefix}:${joined}:${index}`;
}


/**
 * Fetch master inventory from GE ERP system
 */
async function fetchMasterInventory(
  locationId: string,
  invOrg: string,
  inventoryType: 'FG' | 'STA' | 'ASIS',
  cookieHeader: string
): Promise<GEInventoryItem[]> {
  console.log(`[${inventoryType}] Fetching master inventory from ERP...`);

  const subInvLoc = inventoryType; // FG, STA, or ASIS
  const body = new URLSearchParams({
    dmsLoc: invOrg,
    subInvLoc,
    invorg: invOrg,
    erpDataList: '[]',
  }).toString();

  const rawData = await fetchXlsAsJson<Record<string, unknown>>(
    ENDPOINTS.ERP_INVENTORY_SPREADSHEET,
    cookieHeader,
    'POST',
    body,
    REFERERS.ERP_INVENTORY
  );

  console.log(`[${inventoryType}] Master inventory rows: ${rawData.length}`);

  const inventory: GEInventoryItem[] = [];
  let syntheticCount = 0;
  let missingSerials = 0;

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    let serial = getRowValue(row, ['Serial #', 'Serial#', 'Serial', 'SERIALS'])?.trim() || '';
    const model = getRowValue(row, ['Model #', 'Model#', 'Model', 'MODELS'])?.trim();
    const qty = getRowValue(row, ['Inv Qty', 'InvQty', 'Qty', 'QTY'])?.trim();
    const status = getRowValue(row, ['Availability Status', 'AvailabilityStatus', 'Status'])?.trim();
    const message = getRowValue(row, ['Availability Message', 'AvailabilityMessage', 'Message'])?.trim();

    if (!serial) {
      serial = buildSyntheticSerial(`${inventoryType}-NS`, [model, status], i + 1);
      syntheticCount++;
      missingSerials++;
    }

    inventory.push({
      'Serial #': serial,
      'Model #': model || '',
      'Inv Qty': qty || '1',
      'Availability Status': status || '',
      'Availability Message': message || '',
    });
  }

  if (missingSerials > 0) {
    console.log(`[${inventoryType}] Rows missing serials: ${missingSerials}`);
  }

  if (syntheticCount > 0) {
    console.log(`[${inventoryType}] Built ${syntheticCount} synthetic serials`);
  }

  return inventory;
}

/**
 * Log changes to ge_changes table
 */
async function logChange(
  db: ReturnType<typeof getSupabase>,
  companyId: string,
  locationId: string,
  inventoryType: string,
  change: Omit<GEChange, 'company_id' | 'location_id' | 'inventory_type'>
): Promise<void> {
  const { error } = await db.from('ge_changes').insert({
    company_id: companyId,
    location_id: locationId,
    inventory_type: inventoryType,
    ...change,
  });

  if (error) {
    console.error(`Failed to log change:`, error);
  }
}

/**
 * Sync simple inventory (FG or STA) - master inventory export only
 */
export async function syncSimpleInventory(
  locationId: string,
  inventoryType: 'FG' | 'STA'
): Promise<SyncResult> {
  const log: string[] = [];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting ${inventoryType} Sync for location: ${locationId}`);
  console.log(`${'='.repeat(60)}\n`);
  log.push(`Starting ${inventoryType} sync`);

  const startTime = Date.now();
  const changes: GEChange[] = [];

  try {
    // Get database connection and config
    const db = getSupabase();
    const config = await getLocationConfig(locationId);
    const productLookup = await getProductLookup(config.companyId);

    console.log(`Company: ${config.companyId}`);
    console.log(`Location: ${locationId}`);
    log.push(`Company ${config.companyId} • Location ${locationId}`);

    // Get authenticated cookies
    const cookieHeader = await getCookieHeader(locationId);

    // Hardcoded invOrg (TODO: Make configurable per location)
    const invOrg = '9SU';

    // Fetch master inventory
    const inventory = await fetchMasterInventory(locationId, invOrg, inventoryType, cookieHeader);
    log.push(`Fetched ${inventory.length} ERP rows`);
    const debugSerial = process.env.DEBUG_SERIAL?.trim();
    if (debugSerial) {
      const matched = inventory.filter(
        (item) => item['Serial #']?.trim() === debugSerial
      );
      console.log(`[${inventoryType}] DEBUG_SERIAL ${debugSerial} matches: ${matched.length}`);
      if (matched.length > 0) {
        console.log(`[${inventoryType}] DEBUG_SERIAL sample:`, matched[0]);
      }
      log.push(`DEBUG_SERIAL ${debugSerial} matches: ${matched.length}`);
    }

    if (inventory.length === 0) {
      console.log(`[${inventoryType}] No inventory items found`);
      log.push('No inventory items found');
      return {
        success: true,
        message: `No ${inventoryType} inventory found`,
        stats: {
          totalGEItems: 0,
          itemsInLoads: 0,
          unassignedItems: 0,
          newItems: 0,
          updatedItems: 0,
          forSaleLoads: 0,
          pickedLoads: 0,
          changesLogged: 0,
        },
        changes: [],
        log,
      };
    }

    // Fetch existing items from DB
    // For STA sync, also fetch ASIS items to enable ASIS→STA migration (respecting GE as source of truth)
    const inventoryTypesToFetch: string[] = [inventoryType];
    if (inventoryType === 'STA') {
      inventoryTypesToFetch.push('ASIS');
    }

    const { data: existingItems, error: fetchError } = await db
      .from('inventory_items')
      .select('id, serial, model, ge_availability_status, ge_availability_message, ge_inv_qty, inventory_type')
      .eq('company_id', config.companyId)
      .eq('location_id', locationId)
      .in('inventory_type', inventoryTypesToFetch);

    if (fetchError) {
      throw new Error(`Failed to fetch existing items: ${fetchError.message}`);
    }

    console.log(`[${inventoryType}] Existing items in DB: ${existingItems?.length || 0}`);
    log.push(`Existing items in DB: ${existingItems?.length || 0}`);

    // Build maps for comparison
    // For STA sync: prefer existing STA items over ASIS items (in case both exist)
    const existingBySerial = new Map<string, typeof existingItems[0]>();
    for (const item of existingItems || []) {
      const existing = existingBySerial.get(item.serial);
      if (!existing) {
        existingBySerial.set(item.serial, item);
      } else if (inventoryType === 'STA' && item.inventory_type === 'STA') {
        // If importing STA and found existing STA item, use it over ASIS
        existingBySerial.set(item.serial, item);
      }
    }

    const geSerials = new Set<string>();
    const itemsToUpsert: Array<{
      id?: string;
      company_id: string;
      location_id: string;
      inventory_type: string;
      serial: string;
      model: string;
      cso: string;
      product_type: string;
      product_fk: string | null;
      ge_model: string;
      ge_serial: string;
      ge_inv_qty: string;
      ge_availability_status: string;
      ge_availability_message: string;
    }> = [];

    let newItems = 0;
    let updatedItems = 0;

    // Process each inventory item
    for (const item of inventory) {
      const serial = item['Serial #'];
      const model = item['Model #'];
      const qty = item['Inv Qty'];
      const status = item['Availability Status'];
      const message = item['Availability Message'];

      geSerials.add(serial);

      const productInfo = productLookup.get(model);
      const existingItem = existingBySerial.get(serial);

      // Detect changes
      if (existingItem) {
        const statusChanged = existingItem.ge_availability_status !== status;
        const messageChanged = existingItem.ge_availability_message !== message;
        const qtyChanged = String(existingItem.ge_inv_qty) !== qty;

        if (statusChanged || messageChanged || qtyChanged) {
          updatedItems++;

          if (statusChanged) {
            await logChange(db, config.companyId, locationId, inventoryType, {
              serial,
              model,
              change_type: 'item_status_changed',
              field_changed: 'availability_status',
              old_value: existingItem.ge_availability_status || '',
              new_value: status,
              source: 'erp_inventory',
            });
            changes.push({
              serial,
              model,
              change_type: 'item_status_changed',
              field_changed: 'availability_status',
              old_value: existingItem.ge_availability_status || '',
              new_value: status,
              source: 'erp_inventory',
            } as GEChange);
          }

          if (qtyChanged) {
            await logChange(db, config.companyId, locationId, inventoryType, {
              serial,
              model,
              change_type: 'item_qty_changed',
              field_changed: 'inv_qty',
              old_value: String(existingItem.ge_inv_qty),
              new_value: qty,
              source: 'erp_inventory',
            });
            changes.push({
              serial,
              model,
              change_type: 'item_qty_changed',
              field_changed: 'inv_qty',
              old_value: String(existingItem.ge_inv_qty),
              new_value: qty,
              source: 'erp_inventory',
            } as GEChange);
          }
        }
      } else {
        // Check if this is an ASIS→STA migration
        if (inventoryType === 'STA') {
          // Look for ASIS item with this serial in the full existingItems list
          const asisItem = (existingItems || []).find(
            (item) => item.serial === serial && item.inventory_type === 'ASIS'
          );
          if (asisItem) {
            // This is a migration from ASIS to STA
            console.log(`[${inventoryType}] Migrating ${serial} from ASIS to STA`);
            await logChange(db, config.companyId, locationId, inventoryType, {
              serial,
              model,
              change_type: 'item_migrated',
              field_changed: 'inventory_type',
              old_value: 'ASIS',
              new_value: 'STA',
              source: 'erp_inventory',
            });
            changes.push({
              serial,
              model,
              change_type: 'item_migrated',
              field_changed: 'inventory_type',
              old_value: 'ASIS',
              new_value: 'STA',
              source: 'erp_inventory',
            } as GEChange);
          } else {
            // True new item
            newItems++;
            await logChange(db, config.companyId, locationId, inventoryType, {
              serial,
              model,
              change_type: 'item_appeared',
              source: 'erp_inventory',
            });
            changes.push({
              serial,
              model,
              change_type: 'item_appeared',
              source: 'erp_inventory',
            } as GEChange);
          }
        } else {
          // FG or other inventory types
          newItems++;
          await logChange(db, config.companyId, locationId, inventoryType, {
            serial,
            model,
            change_type: 'item_appeared',
            source: 'erp_inventory',
          });
          changes.push({
            serial,
            model,
            change_type: 'item_appeared',
            source: 'erp_inventory',
          } as GEChange);
        }
      }

      // Prepare upsert
      itemsToUpsert.push({
        ...(existingItem?.id ? { id: existingItem.id } : {}),
        company_id: config.companyId,
        location_id: locationId,
        inventory_type: inventoryType,
        serial,
        model,
        cso: '', // No CSO for simple inventory
        product_type: productInfo?.product_type || 'Unknown',
        product_fk: productInfo?.id || null,
        ge_model: model,
        ge_serial: serial,
        ge_inv_qty: qty,
        ge_availability_status: status,
        ge_availability_message: message,
      });
    }

    // Detect disappeared items (orphans)
    for (const [serial, existingItem] of existingBySerial) {
      if (!geSerials.has(serial)) {
        await logChange(db, config.companyId, locationId, inventoryType, {
          serial,
          model: existingItem.model,
          change_type: 'item_disappeared',
          source: 'erp_inventory',
        });
        changes.push({
          serial,
          model: existingItem.model,
          change_type: 'item_disappeared',
          source: 'erp_inventory',
        } as GEChange);
      }
    }

    // Handle ASIS→STA migrations by deleting ASIS items first
    if (inventoryType === 'STA') {
      const serialsToMigrate: string[] = [];
      for (const item of itemsToUpsert) {
        const asisItem = (existingItems || []).find(
          (existing) => existing.serial === item.serial && existing.inventory_type === 'ASIS'
        );
        if (asisItem) {
          serialsToMigrate.push(item.serial);
        }
      }

      if (serialsToMigrate.length > 0) {
        console.log(`[${inventoryType}] Deleting ${serialsToMigrate.length} ASIS items to migrate to STA...`);
        log.push(`Migrating ${serialsToMigrate.length} items from ASIS to STA`);

        const { error: deleteError } = await db
          .from('inventory_items')
          .delete()
          .eq('company_id', config.companyId)
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('serial', serialsToMigrate);

        if (deleteError) {
          console.error(`Failed to delete ASIS items for migration:`, deleteError);
          throw new Error(`Failed to delete ASIS items for migration: ${deleteError.message}`);
        }
      }
    }

    // Upsert items to database
    if (itemsToUpsert.length > 0) {
      console.log(`[${inventoryType}] Upserting ${itemsToUpsert.length} items...`);
      log.push(`Upserting ${itemsToUpsert.length} items`);

      // Deduplicate by unique key (company_id, location_id, serial, inventory_type)
      // to prevent "cannot affect row a second time" error
      const uniqueKey = (item: typeof itemsToUpsert[0]) =>
        `${item.company_id}|${item.location_id}|${item.serial}|${item.inventory_type}`;
      const dedupedMap = new Map<string, typeof itemsToUpsert[0]>();

      for (const item of itemsToUpsert) {
        const key = uniqueKey(item);
        if (dedupedMap.has(key)) {
          console.warn(`⚠️ Duplicate serial detected in GE data: ${item.serial} (inventory_type: ${item.inventory_type})`);
        }
        dedupedMap.set(key, item); // Keep last occurrence
      }

      const dedupedItems = Array.from(dedupedMap.values());
      const duplicatesRemoved = itemsToUpsert.length - dedupedItems.length;

      if (duplicatesRemoved > 0) {
        console.log(`[${inventoryType}] Removed ${duplicatesRemoved} duplicate(s) from upsert payload`);
        log.push(`Removed ${duplicatesRemoved} duplicate(s)`);
      }

      const upsertPayload = dedupedItems.map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = item;
        return rest;
      });

      const { error: upsertError } = await db
        .from('inventory_items')
        .upsert(upsertPayload, {
          onConflict: 'company_id,location_id,serial,inventory_type',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(`Failed to upsert items: ${upsertError.message}`);
      }
    }

    // Delete orphaned items (items in DB but not in GE)
    const orphanedSerials = Array.from(existingBySerial.keys()).filter((s) => !geSerials.has(s));
    if (orphanedSerials.length > 0) {
      console.log(`[${inventoryType}] Deleting ${orphanedSerials.length} orphaned items...`);
      log.push(`Deleting ${orphanedSerials.length} orphaned items`);

      const { error: deleteError } = await db
        .from('inventory_items')
        .delete()
        .eq('company_id', config.companyId)
        .eq('location_id', locationId)
        .eq('inventory_type', inventoryType)
        .in('serial', orphanedSerials);

      if (deleteError) {
        console.error(`Failed to delete orphaned items:`, deleteError);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const stats: SyncStats = {
      totalGEItems: inventory.length,
      itemsInLoads: 0, // N/A for simple inventory
      unassignedItems: 0, // N/A for simple inventory
      newItems,
      updatedItems,
      forSaleLoads: 0, // N/A for simple inventory
      pickedLoads: 0, // N/A for simple inventory
      changesLogged: changes.length,
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${inventoryType} Sync Complete (${duration}s)`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total items from GE: ${stats.totalGEItems}`);
    console.log(`New items: ${stats.newItems}`);
    console.log(`Updated items: ${stats.updatedItems}`);
    console.log(`Changes logged: ${stats.changesLogged}`);
    console.log(`${'='.repeat(60)}\n`);
    log.push(`Total items from GE: ${stats.totalGEItems}`);
    log.push(`New items: ${stats.newItems}`);
    log.push(`Updated items: ${stats.updatedItems}`);
    log.push(`Changes logged: ${stats.changesLogged}`);

    return {
      success: true,
      message: `${inventoryType} sync completed successfully`,
      stats,
      changes,
      log,
    };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`\n${'='.repeat(60)}`);
    console.error(`${inventoryType} Sync Failed (${duration}s)`);
    console.error(`${'='.repeat(60)}`);
    console.error(errorMessage);
    console.error(`${'='.repeat(60)}\n`);

    return {
      success: false,
      message: `${inventoryType} sync failed: ${errorMessage}`,
      stats: {
        totalGEItems: 0,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: changes.length,
      },
      changes,
      error: errorMessage,
      log,
    };
  }
}
