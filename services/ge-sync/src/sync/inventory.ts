import * as XLSX from 'xlsx';
import { getCookieHeader } from '../auth/playwright.js';
import { getSupabase, getLocationConfig, getProductLookup } from '../db/supabase.js';
import { ENDPOINTS, HEADERS, REFERERS } from './endpoints.js';
import { reconcileInventoryForSerials } from './reconcileInventory.js';
import type { GEInventoryItem, SyncResult, SyncStats } from '../types/index.js';

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
    const sourceType = inventoryType === 'FG' ? 'ge_fg' : 'ge_sta';

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

    const { data: existingSourceItems, error: fetchError } = await db
      .from('ge_inventory_source_items')
      .select('id, serial, model, qty, inventory_bucket, inventory_state, ge_availability_status, ge_availability_message, ge_inv_qty, sub_inventory, cso')
      .eq('company_id', config.companyId)
      .eq('location_id', locationId)
      .eq('source_type', sourceType);

    if (fetchError) {
      throw new Error(`Failed to fetch existing source items: ${fetchError.message}`);
    }

    console.log(`[${inventoryType}] Existing source items: ${existingSourceItems?.length || 0}`);
    log.push(`Existing source items: ${existingSourceItems?.length || 0}`);

    // Fetch load CSO mappings for STA items
    const loadCsoMap = new Map<string, string>();
    const loadBucketMap = new Map<string, string>();
    const serialCsoMap = new Map<string, string>();
    if (inventoryType === 'STA') {
      const { data: loads, error: loadError } = await db
        .from('load_metadata')
        .select('sub_inventory_name, ge_cso, inventory_type')
        .eq('company_id', config.companyId)
        .eq('location_id', locationId);

      if (loadError) {
        console.warn(`[${inventoryType}] Failed to fetch load CSO mappings: ${loadError.message}`);
      } else if (loads) {
        for (const load of loads) {
          if (load.sub_inventory_name && load.ge_cso) {
            loadCsoMap.set(load.sub_inventory_name, load.ge_cso);
          }
          if (load.sub_inventory_name && load.inventory_type) {
            loadBucketMap.set(load.sub_inventory_name, load.inventory_type);
          }
        }
        console.log(`[${inventoryType}] Loaded ${loadCsoMap.size} load CSO mappings`);
        log.push(`Loaded ${loadCsoMap.size} load CSO mappings`);
      }

      // Fetch serial→CSO mappings from order_lines for STA items without loads
      const { data: orderLines, error: orderError } = await db
        .from('order_lines')
        .select('cso, serials')
        .eq('location_id', locationId)
        .not('cso', 'is', null)
        .neq('cso', '');

      if (orderError) {
        console.warn(`[${inventoryType}] Failed to fetch order line CSO mappings: ${orderError.message}`);
      } else if (orderLines) {
        for (const line of orderLines) {
          if (!line.cso || !line.serials) continue;
          // serials is JSONB array like [{"serial": "ABC123"}]
          const serialsArray = Array.isArray(line.serials) ? line.serials : [];
          for (const serialObj of serialsArray) {
            const serial = typeof serialObj === 'object' && serialObj !== null && 'serial' in serialObj
              ? String(serialObj.serial).trim()
              : '';
            if (serial && serial !== '') {
              serialCsoMap.set(serial, line.cso);
            }
          }
        }
        console.log(`[${inventoryType}] Loaded ${serialCsoMap.size} serial→CSO mappings from order_lines`);
        log.push(`Loaded ${serialCsoMap.size} serial→CSO mappings from order_lines`);
      }
    }

    const existingBySerial = new Map<string, typeof existingSourceItems[0]>();
    for (const item of existingSourceItems || []) {
      if (item.serial) {
        existingBySerial.set(item.serial, item);
      }
    }

    const geSerials = new Set<string>();
    const itemsToUpsert: Array<Record<string, unknown>> = [];

    let newItems = 0;
    let updatedItems = 0;
    const nowIso = new Date().toISOString();

    // Process each inventory item
    for (const item of inventory) {
      const serial = item['Serial #'];
      const model = item['Model #'];
      const qty = item['Inv Qty'];
      const status = item['Availability Status'];
      const message = item['Availability Message'];
      const loadNumber = item['LOAD NUMBER'] || item['Load Number'] || '';

      geSerials.add(serial);

      const existingItem = existingBySerial.get(serial);

      if (existingItem) {
        const statusChanged = (existingItem.ge_availability_status ?? '') !== (status ?? '');
        const messageChanged = (existingItem.ge_availability_message ?? '') !== (message ?? '');
        const qtyChanged = String(existingItem.ge_inv_qty ?? '') !== qty;
        const loadChanged = (existingItem.sub_inventory ?? '') !== (loadNumber ?? '');

        if (statusChanged || messageChanged || qtyChanged || loadChanged) {
          updatedItems++;
        }
      } else {
        newItems++;
      }

      // Determine CSO value for STA items
      let csoValue = '';
      if (inventoryType === 'STA') {
        if (loadNumber) {
          csoValue = loadCsoMap.get(loadNumber) || '';
        }
        if (!csoValue) {
          csoValue = serialCsoMap.get(serial) || '';
        }
      }

      const inventoryBucket = inventoryType === 'FG'
        ? 'FG'
        : loadNumber
          ? loadBucketMap.get(loadNumber) || null
          : null;
      const inventoryState = inventoryType === 'STA' ? 'staged' : 'on_hand';
      const qtyValue = parseInt(qty, 10);

      // Prepare upsert
      itemsToUpsert.push({
        ...(existingItem?.id ? { id: existingItem.id } : {}),
        company_id: config.companyId,
        location_id: locationId,
        source_type: sourceType,
        inventory_bucket: inventoryBucket,
        inventory_state: inventoryState,
        serial,
        model,
        qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
        cso: csoValue || null,
        ...(loadNumber ? { sub_inventory: loadNumber.trim() } : {}),
        ge_availability_status: status || null,
        ge_availability_message: message || null,
        ge_inv_qty: Number.isFinite(qtyValue) ? qtyValue : null,
        raw_payload: item as unknown as Record<string, unknown>,
        last_seen_at: nowIso,
        updated_at: nowIso,
      });
    }
    const orphanedSerials = Array.from(existingBySerial.keys()).filter((s) => !geSerials.has(s));

    if (itemsToUpsert.length > 0) {
      console.log(`[${inventoryType}] Upserting ${itemsToUpsert.length} source items...`);
      log.push(`Upserting ${itemsToUpsert.length} source items`);

      const dedupedMap = new Map<string, Record<string, unknown>>();
      for (const item of itemsToUpsert) {
        const serial = String(item.serial || '');
        if (!serial) continue;
        dedupedMap.set(serial, item);
      }

      const upsertPayload = Array.from(dedupedMap.values()).map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = item;
        return rest;
      });

      const { error: upsertError } = await db
        .from('ge_inventory_source_items')
        .upsert(upsertPayload, { onConflict: 'company_id,location_id,source_type,serial' });

      if (upsertError) {
        throw new Error(`Failed to upsert source items: ${upsertError.message}`);
      }
    }

    if (orphanedSerials.length > 0) {
      console.log(`[${inventoryType}] Deleting ${orphanedSerials.length} orphaned source items...`);
      log.push(`Deleting ${orphanedSerials.length} orphaned source items`);

      const chunkSize = 500;
      for (let i = 0; i < orphanedSerials.length; i += chunkSize) {
        const chunk = orphanedSerials.slice(i, i + chunkSize);
        const { data: orphanedSourceRows, error: orphanedFetchError } = await db
          .from('ge_inventory_source_items')
          .select('id')
          .eq('company_id', config.companyId)
          .eq('location_id', locationId)
          .eq('source_type', sourceType)
          .in('serial', chunk);

        if (orphanedFetchError) {
          throw new Error(`Failed to fetch orphaned source items: ${orphanedFetchError.message}`);
        }

        const orphanedIds = (orphanedSourceRows ?? []).map((row) => row.id).filter(Boolean);
        if (orphanedIds.length > 0) {
          const { error: clearRefError } = await db
            .from('inventory_items')
            .update({ source_id: null })
            .eq('company_id', config.companyId)
            .eq('location_id', locationId)
            .in('source_id', orphanedIds);

          if (clearRefError) {
            throw new Error(`Failed to clear inventory source references: ${clearRefError.message}`);
          }
        }

        const { error: deleteError } = await db
          .from('ge_inventory_source_items')
          .delete()
          .eq('company_id', config.companyId)
          .eq('location_id', locationId)
          .eq('source_type', sourceType)
          .in('serial', chunk);

        if (deleteError) {
          console.error(`Failed to delete orphaned source items:`, deleteError);
        }
      }
    }

    const reconcileSerials = Array.from(new Set([...geSerials, ...orphanedSerials]));
    const reconcileResult = await reconcileInventoryForSerials(
      db,
      config.companyId,
      locationId,
      reconcileSerials,
      productLookup
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const stats: SyncStats = {
      totalGEItems: inventory.length,
      itemsInLoads: 0, // N/A for simple inventory
      unassignedItems: 0, // N/A for simple inventory
      newItems,
      updatedItems,
      forSaleLoads: 0, // N/A for simple inventory
      pickedLoads: 0, // N/A for simple inventory
      changesLogged: reconcileResult.changesLogged,
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
      changes: [],
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
        changesLogged: 0,
      },
      changes: [],
      error: errorMessage,
      log,
    };
  }
}
