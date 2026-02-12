import type { SupabaseClient } from '@supabase/supabase-js';
import type { GEChange } from '../types/index.js';

type ProductInfo = { id: string; product_type: string };

type SourceRow = {
  id: string;
  source_type: string;
  inventory_bucket: string | null;
  inventory_state: string | null;
  serial: string;
  model: string | null;
  qty: number | null;
  cso: string | null;
  sub_inventory: string | null;
  ge_ordc: string | null;
  ge_availability_status: string | null;
  ge_availability_message: string | null;
  ge_inv_qty: number | null;
  raw_payload: Record<string, unknown> | null;
  last_seen_at: string | null;
};

type ExistingItem = {
  id: string;
  serial: string;
  inventory_type: string;
  inventory_bucket: string | null;
  inventory_state: string | null;
  source_type: string | null;
  source_id: string | null;
  model: string | null;
  qty: number | null;
  cso: string | null;
  sub_inventory: string | null;
  ge_availability_status: string | null;
  ge_availability_message: string | null;
  ge_inv_qty: number | null;
  updated_at: string | null;
};

type ReconcileResult = {
  changesLogged: number;
  newItems: number;
  updatedItems: number;
  deletedItems: number;
  conflictCount: number;
};

const SOURCE_TYPE_PRIORITY = [
  'ge_sta',
  'ge_asis',
  'ge_fg',
  'ge_inbound',
  'ge_backhaul',
];

const DEFAULT_BUCKET = 'UNKNOWN';

function normalizeState(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeModel(value?: string | null): string {
  if (!value) return '';
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function compareSourcePriority(a: SourceRow, b: SourceRow): number {
  const aIndex = SOURCE_TYPE_PRIORITY.indexOf(a.source_type);
  const bIndex = SOURCE_TYPE_PRIORITY.indexOf(b.source_type);
  const aPriority = aIndex === -1 ? SOURCE_TYPE_PRIORITY.length : aIndex;
  const bPriority = bIndex === -1 ? SOURCE_TYPE_PRIORITY.length : bIndex;
  if (aPriority !== bPriority) return aPriority - bPriority;

  const aSeen = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
  const bSeen = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
  return bSeen - aSeen;
}

function pickCanonicalSource(rows: SourceRow[]): SourceRow | null {
  if (rows.length === 0) return null;

  const stagedRows = rows.filter((row) => normalizeState(row.inventory_state) === 'staged');
  const candidates = stagedRows.length > 0 ? stagedRows : rows;

  const sorted = [...candidates].sort(compareSourcePriority);
  return sorted[0] ?? null;
}

function buildConflictGroups(rows: SourceRow[]) {
  return rows.map((row) => ({
    source_type: row.source_type,
    inventory_bucket: row.inventory_bucket,
    inventory_state: row.inventory_state,
    serial: row.serial,
    model: row.model,
    qty: row.qty,
    cso: row.cso,
    sub_inventory: row.sub_inventory,
    last_seen_at: row.last_seen_at,
  }));
}

function hasConflict(rows: SourceRow[]): boolean {
  if (rows.length <= 1) return false;

  const modelSet = new Set(rows.map((row) => normalizeModel(row.model)));
  const bucketSet = new Set(
    rows
      .map((row) => row.inventory_bucket || '')
      .filter(Boolean)
      .filter((bucket) => bucket !== 'STA')
  );

  return modelSet.size > 1 || bucketSet.size > 1;
}

function chooseInventoryType(bucket: string | null, state: string | null, sourceType: string): string {
  if (bucket && bucket !== DEFAULT_BUCKET) return bucket;
  if (normalizeState(state) === 'staged') return 'ASIS';
  if (sourceType === 'ge_sta') return 'ASIS';
  return DEFAULT_BUCKET;
}

function deriveCanonicalBucket(rows: SourceRow[]): string {
  const hasAsis = rows.some((row) => row.source_type === 'ge_asis');
  if (hasAsis) return 'ASIS';

  const hasFg = rows.some((row) => row.source_type === 'ge_fg');
  if (hasFg) return 'FG';

  const hasInbound = rows.some((row) => row.source_type === 'ge_inbound');
  if (hasInbound) return 'INBOUND';

  const hasBackhaul = rows.some((row) => row.source_type === 'ge_backhaul');
  if (hasBackhaul) return 'BACKHAUL';

  const hasSta = rows.some((row) => row.source_type === 'ge_sta');
  if (hasSta) return 'STA';

  const fallback = rows.find((row) => row.inventory_bucket)?.inventory_bucket;
  return fallback || DEFAULT_BUCKET;
}

function deriveCanonicalState(rows: SourceRow[]): string | null {
  const hasSta = rows.some((row) => row.source_type === 'ge_sta');
  if (hasSta) return 'staged';

  const asisState = rows.find((row) => row.source_type === 'ge_asis')?.inventory_state;
  if (asisState) return asisState;

  const fallback = rows.find((row) => row.inventory_state)?.inventory_state;
  return fallback ?? null;
}

function mergeFieldFromSources<T>(
  rows: SourceRow[],
  primary: SourceRow,
  selector: (row: SourceRow) => T | null | undefined
): T | null {
  const primaryValue = selector(primary);
  if (primaryValue != null && primaryValue !== '') return primaryValue;

  for (const row of rows) {
    const value = selector(row);
    if (value != null && value !== '') return value;
  }

  return null;
}

export async function reconcileInventoryForSerials(
  db: SupabaseClient,
  companyId: string,
  locationId: string,
  serials: string[],
  productLookup: Map<string, ProductInfo>
): Promise<ReconcileResult> {
  const uniqueSerials = Array.from(new Set(serials.filter(Boolean)));
  if (uniqueSerials.length === 0) {
    return { changesLogged: 0, newItems: 0, updatedItems: 0, deletedItems: 0, conflictCount: 0 };
  }

  const sourceRows: SourceRow[] = [];
  const chunkSize = 500;

  for (let i = 0; i < uniqueSerials.length; i += chunkSize) {
    const chunk = uniqueSerials.slice(i, i + chunkSize);
    const { data, error } = await db
      .from('ge_inventory_source_items')
      .select(
        'id, source_type, inventory_bucket, inventory_state, serial, model, qty, cso, sub_inventory, ge_ordc, ge_availability_status, ge_availability_message, ge_inv_qty, raw_payload, last_seen_at'
      )
      .eq('company_id', companyId)
      .eq('location_id', locationId)
      .in('serial', chunk);

    if (error) {
      throw new Error(`Failed to load source inventory rows: ${error.message}`);
    }

    sourceRows.push(...(data as SourceRow[]));
  }

  const sourceBySerial = new Map<string, SourceRow[]>();
  for (const row of sourceRows) {
    const list = sourceBySerial.get(row.serial) ?? [];
    list.push(row);
    sourceBySerial.set(row.serial, list);
  }

  const existingItems: ExistingItem[] = [];
  for (let i = 0; i < uniqueSerials.length; i += chunkSize) {
    const chunk = uniqueSerials.slice(i, i + chunkSize);
    const { data, error } = await db
      .from('inventory_items')
      .select(
        'id, serial, inventory_type, inventory_bucket, inventory_state, source_type, source_id, model, qty, cso, sub_inventory, ge_availability_status, ge_availability_message, ge_inv_qty, updated_at'
      )
      .eq('company_id', companyId)
      .eq('location_id', locationId)
      .in('serial', chunk);

    if (error) {
      throw new Error(`Failed to load inventory items: ${error.message}`);
    }

    existingItems.push(...(data as ExistingItem[]));
  }

  const existingBySerial = new Map<string, ExistingItem[]>();
  for (const item of existingItems) {
    const list = existingBySerial.get(item.serial) ?? [];
    list.push(item);
    existingBySerial.set(item.serial, list);
  }

  const changes: GEChange[] = [];
  const itemsWithId: Record<string, unknown>[] = [];
  const itemsWithoutId: Record<string, unknown>[] = [];
  const deleteIds: string[] = [];

  let newItems = 0;
  let updatedItems = 0;
  let deletedItems = 0;
  let conflictCount = 0;

  const conflictsToInsert: Array<{ serial: string; groups: unknown }> = [];
  const conflictsToUpdate: Array<{ id: string; groups: unknown }> = [];

  const existingConflicts: Array<{ id: string; serial: string }> = [];
  for (let i = 0; i < uniqueSerials.length; i += chunkSize) {
    const chunk = uniqueSerials.slice(i, i + chunkSize);
    const { data, error } = await db
      .from('inventory_conflicts')
      .select('id, serial')
      .eq('company_id', companyId)
      .eq('location_id', locationId)
      .eq('status', 'open')
      .in('serial', chunk);

    if (error) {
      throw new Error(`Failed to load inventory conflicts: ${error.message}`);
    }

    existingConflicts.push(...(data ?? []));
  }

  const conflictBySerial = new Map<string, { id: string }>();
  for (const conflict of existingConflicts) {
    if (conflict.serial) {
      conflictBySerial.set(conflict.serial, { id: conflict.id });
    }
  }

  for (const serial of uniqueSerials) {
    const rows = sourceBySerial.get(serial) ?? [];

    if (hasConflict(rows)) {
      conflictCount += 1;
      const groups = buildConflictGroups(rows);
      const existingConflict = conflictBySerial.get(serial);
      if (existingConflict) {
        conflictsToUpdate.push({ id: existingConflict.id, groups });
      } else {
        conflictsToInsert.push({ serial, groups });
      }
    }

    if (rows.length === 0) {
      const existing = existingBySerial.get(serial) ?? [];
      if (existing.length > 0) {
        for (const item of existing) {
          deleteIds.push(item.id);
          changes.push({
            company_id: companyId,
            location_id: locationId,
            inventory_type: item.inventory_type,
            inventory_bucket: item.inventory_bucket ?? undefined,
            inventory_state: item.inventory_state ?? undefined,
            source_type: item.source_type ?? undefined,
            source_id: item.source_id ?? undefined,
            serial,
            model: item.model ?? undefined,
            change_type: 'item_disappeared',
            source: 'reconcile',
          });
        }
        deletedItems += existing.length;
      }
      continue;
    }

    const canonicalSource = pickCanonicalSource(rows);
    if (!canonicalSource) continue;

    const desiredBucket = deriveCanonicalBucket(rows);
    const desiredState = deriveCanonicalState(rows);
    const desiredInventoryType = chooseInventoryType(desiredBucket, desiredState, canonicalSource.source_type);

    const mergedModel = mergeFieldFromSources(rows, canonicalSource, (row) => row.model);
    const mergedCso = mergeFieldFromSources(rows, canonicalSource, (row) => row.cso);
    const mergedSubInventory = mergeFieldFromSources(rows, canonicalSource, (row) => row.sub_inventory);

    const asisRow = rows.find((row) => row.source_type === 'ge_asis');
    const mergedAvailabilityStatus = asisRow?.ge_availability_status
      ?? mergeFieldFromSources(rows, canonicalSource, (row) => row.ge_availability_status);
    const mergedAvailabilityMessage = asisRow?.ge_availability_message
      ?? mergeFieldFromSources(rows, canonicalSource, (row) => row.ge_availability_message);
    const mergedInvQty = asisRow?.ge_inv_qty
      ?? mergeFieldFromSources(rows, canonicalSource, (row) => row.ge_inv_qty ?? row.qty);

    const model = mergedModel ?? '';
    const product = productLookup.get(model)
      ?? productLookup.get(model.trim().toUpperCase())
      ?? undefined;

    const existingList = existingBySerial.get(serial) ?? [];
    const existingPrimary = existingList.find((item) => item.inventory_type === desiredInventoryType)
      ?? existingList.sort((a, b) => {
        const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
        const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
        return bTime - aTime;
      })[0];

    if (!existingPrimary) {
      newItems += 1;
      changes.push({
        company_id: companyId,
        location_id: locationId,
        inventory_type: desiredInventoryType,
        inventory_bucket: desiredBucket,
        inventory_state: desiredState ?? undefined,
        source_type: canonicalSource.source_type,
        source_id: canonicalSource.id,
        serial,
        model: model || undefined,
        change_type: 'item_appeared',
        current_state: {
          inventory_bucket: desiredBucket,
          inventory_state: desiredState,
          source_type: canonicalSource.source_type,
        },
        source: 'reconcile',
      });
    } else {
      const bucketChanged = (existingPrimary.inventory_bucket ?? DEFAULT_BUCKET) !== desiredBucket;
      const stateChanged = normalizeState(existingPrimary.inventory_state) !== normalizeState(desiredState);
      const sourceChanged = (existingPrimary.source_type ?? '') !== canonicalSource.source_type;
      const statusChanged = (existingPrimary.ge_availability_status ?? '') !== (mergedAvailabilityStatus ?? '');
      const qtyChanged = String(existingPrimary.ge_inv_qty ?? '') !== String(mergedInvQty ?? '');
      const loadChanged = (existingPrimary.sub_inventory ?? '') !== (mergedSubInventory ?? '');

      if (bucketChanged) {
        changes.push({
          company_id: companyId,
          location_id: locationId,
          inventory_type: desiredInventoryType,
          inventory_bucket: desiredBucket,
          inventory_state: desiredState ?? undefined,
          source_type: canonicalSource.source_type,
          source_id: canonicalSource.id,
          serial,
          model: model || undefined,
          change_type: 'item_bucket_changed',
          field_changed: 'inventory_bucket',
          old_value: existingPrimary.inventory_bucket ?? DEFAULT_BUCKET,
          new_value: desiredBucket,
          source: 'reconcile',
        });
      }

      if (stateChanged) {
        changes.push({
          company_id: companyId,
          location_id: locationId,
          inventory_type: desiredInventoryType,
          inventory_bucket: desiredBucket,
          inventory_state: desiredState ?? undefined,
          source_type: canonicalSource.source_type,
          source_id: canonicalSource.id,
          serial,
          model: model || undefined,
          change_type: 'item_state_changed',
          field_changed: 'inventory_state',
          old_value: existingPrimary.inventory_state ?? '',
          new_value: desiredState ?? '',
          source: 'reconcile',
        });
      }

      if (sourceChanged) {
        changes.push({
          company_id: companyId,
          location_id: locationId,
          inventory_type: desiredInventoryType,
          inventory_bucket: desiredBucket,
          inventory_state: desiredState ?? undefined,
          source_type: canonicalSource.source_type,
          source_id: canonicalSource.id,
          serial,
          model: model || undefined,
          change_type: 'item_source_changed',
          field_changed: 'source_type',
          old_value: existingPrimary.source_type ?? '',
          new_value: canonicalSource.source_type,
          source: 'reconcile',
        });
      }

      if (statusChanged) {
        changes.push({
          company_id: companyId,
          location_id: locationId,
          inventory_type: desiredInventoryType,
          inventory_bucket: desiredBucket,
          inventory_state: desiredState ?? undefined,
          source_type: canonicalSource.source_type,
          source_id: canonicalSource.id,
          serial,
          model: model || undefined,
          change_type: 'item_status_changed',
          field_changed: 'availability_status',
          old_value: existingPrimary.ge_availability_status ?? '',
          new_value: canonicalSource.ge_availability_status ?? '',
          source: 'reconcile',
        });
      }

      if (qtyChanged) {
        changes.push({
          company_id: companyId,
          location_id: locationId,
          inventory_type: desiredInventoryType,
          inventory_bucket: desiredBucket,
          inventory_state: desiredState ?? undefined,
          source_type: canonicalSource.source_type,
          source_id: canonicalSource.id,
          serial,
          model: model || undefined,
          change_type: 'item_qty_changed',
          field_changed: 'inv_qty',
          old_value: String(existingPrimary.ge_inv_qty ?? ''),
          new_value: String(canonicalSource.ge_inv_qty ?? ''),
          source: 'reconcile',
        });
      }

      if (loadChanged) {
        changes.push({
          company_id: companyId,
          location_id: locationId,
          inventory_type: desiredInventoryType,
          inventory_bucket: desiredBucket,
          inventory_state: desiredState ?? undefined,
          source_type: canonicalSource.source_type,
          source_id: canonicalSource.id,
          serial,
          model: model || undefined,
          change_type: 'item_load_changed',
          field_changed: 'sub_inventory',
          old_value: existingPrimary.sub_inventory ?? '',
          new_value: canonicalSource.sub_inventory ?? '',
          source: 'reconcile',
        });
      }

      if (bucketChanged || stateChanged || sourceChanged || statusChanged || qtyChanged || loadChanged) {
        updatedItems += 1;
      }
    }

    const upsertPayload = {
      ...(existingPrimary?.id ? { id: existingPrimary.id } : {}),
      company_id: companyId,
      location_id: locationId,
      serial,
      model: model || null,
      qty: canonicalSource.qty ?? null,
      cso: mergedCso ?? '',
      sub_inventory: mergedSubInventory ?? null,
      product_fk: product?.id ?? null,
      product_type: product?.product_type ?? 'Unknown',
      inventory_type: desiredInventoryType,
      inventory_bucket: desiredBucket,
      inventory_state: desiredState,
      source_type: canonicalSource.source_type,
      source_id: canonicalSource.id,
      source_meta: canonicalSource.raw_payload ?? {},
      last_seen_at: canonicalSource.last_seen_at ?? new Date().toISOString(),
      ge_model: model || null,
      ge_serial: serial || null,
      ge_ordc: canonicalSource.ge_ordc ?? null,
      ge_inv_qty: mergedInvQty ?? null,
      ge_availability_status: mergedAvailabilityStatus ?? null,
      ge_availability_message: mergedAvailabilityMessage ?? null,
    };

    if (existingPrimary?.id) {
      itemsWithId.push(upsertPayload);
    } else {
      itemsWithoutId.push(upsertPayload);
    }

    const duplicateIds = existingList
      .filter((item) => item.id !== existingPrimary?.id)
      .map((item) => item.id);
    if (duplicateIds.length > 0) {
      deleteIds.push(...duplicateIds);
    }
  }

  if (itemsWithoutId.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < itemsWithoutId.length; i += chunkSize) {
      const chunk = itemsWithoutId.slice(i, i + chunkSize);
      const { error } = await db
        .from('inventory_items')
        .upsert(chunk, { onConflict: 'company_id,location_id,serial,inventory_type' });
      if (error) {
        throw new Error(`Failed to upsert inventory items: ${error.message}`);
      }
    }
  }

  if (itemsWithId.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < itemsWithId.length; i += chunkSize) {
      const chunk = itemsWithId.slice(i, i + chunkSize);
      const { error } = await db
        .from('inventory_items')
        .upsert(chunk, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to upsert inventory items by id: ${error.message}`);
      }
    }
  }

  if (deleteIds.length > 0) {
    const uniqueDeleteIds = Array.from(new Set(deleteIds));
    const chunkSize = 500;
    for (let i = 0; i < uniqueDeleteIds.length; i += chunkSize) {
      const chunk = uniqueDeleteIds.slice(i, i + chunkSize);
      const { error } = await db
        .from('inventory_items')
        .delete()
        .in('id', chunk);

      if (error) {
        throw new Error(`Failed to delete duplicate inventory items: ${error.message}`);
      }
    }
  }

  if (conflictsToUpdate.length > 0) {
    for (const update of conflictsToUpdate) {
      const { error } = await db
        .from('inventory_conflicts')
        .update({
          groups: update.groups,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id);
      if (error) {
        throw new Error(`Failed to update inventory conflicts: ${error.message}`);
      }
    }
  }

  if (conflictsToInsert.length > 0) {
    const payload = conflictsToInsert.map((conflict) => ({
      company_id: companyId,
      location_id: locationId,
      serial: conflict.serial,
      groups: conflict.groups,
      source: 'reconcile',
    }));
    const { error } = await db.from('inventory_conflicts').insert(payload);
    if (error) {
      throw new Error(`Failed to insert inventory conflicts: ${error.message}`);
    }
  }

  let changesLogged = 0;
  if (changes.length > 0) {
    const { error } = await db.from('ge_changes').insert(changes);
    if (error) {
      throw new Error(`Failed to log inventory changes: ${error.message}`);
    }
    changesLogged = changes.length;
  }

  return { changesLogged, newItems, updatedItems, deletedItems, conflictCount };
}
