import supabase from '@/lib/supabase';
import { fetchAsisXlsRows } from '@/lib/asisImport';
import type { InventoryItem } from '@/types/inventory';

export type ProductImportSource = {
  fileName: string;
  baseUrl?: string;
  label: string;
  inventoryType: string;
  csoValue: string;
};

export type InventoryImportStats = {
  totalRows: number;
  processedRows: number;
  crossTypeSkipped: number;
};

export type InventoryImportProgress = {
  phase:
    | 'fetch'
    | 'parse'
    | 'lookup'
    | 'conflicts'
    | 'insert'
    | 'upsert'
    | 'orphans'
    | 'complete';
  message: string;
  processed?: number;
  total?: number;
};

type ProductImportRow = {
  'Model #'?: string | null;
  'Serial #'?: string | null;
  'Inv Qty'?: string | number | null;
  'Availability Status'?: string | null;
  'Availability Message'?: string | null;
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const buildProductLookup = async (models: string[]) => {
  const uniqueModels = Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
  const lookup = new Map<string, { id: string; product_type: string }>();

  for (const chunk of chunkArray(uniqueModels, 500)) {
    const { data, error } = await supabase
      .from('products')
      .select('id, model, product_type')
      .in('model', chunk);

    if (error) throw error;

    (data ?? []).forEach((product) => {
      if (product.id && product.product_type) {
        lookup.set(product.model, { id: product.id, product_type: product.product_type });
      }
    });
  }

  return lookup;
};

const findCrossTypeSerials = async (
  serials: string[],
  inventoryType: string,
  locationId: string
) => {
  if (!serials.length) return new Set<string>();
  const conflictSerials = new Set<string>();

  for (const chunk of chunkArray(serials, 500)) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('serial, inventory_type')
      .eq('location_id', locationId)
      .in('serial', chunk)
      .neq('inventory_type', inventoryType);

    if (error) throw error;

    (data ?? []).forEach((row) => {
      if (!row.serial) return;

      // Allow ASIS→STA migration (if importing STA and existing is ASIS, allow it)
      if (inventoryType === 'STA' && row.inventory_type === 'ASIS') {
        return; // Not a conflict - allow migration
      }

      // Block all other cross-type conflicts
      conflictSerials.add(row.serial);
    });
  }

  return conflictSerials;
};

export async function importInventorySnapshot(params: {
  source: ProductImportSource;
  locationId: string;
  companyId: string;
  batchSize?: number;
  onProgress?: (progress: InventoryImportProgress) => void;
}): Promise<InventoryImportStats> {
  const { source, locationId, companyId, batchSize = 500, onProgress } = params;

  onProgress?.({ phase: 'fetch', message: 'Downloading inventory file…' });
  const rows = await fetchAsisXlsRows<ProductImportRow>(source.fileName, source.baseUrl);
  if (!rows.length) {
    return { totalRows: 0, processedRows: 0, crossTypeSkipped: 0 };
  }
  onProgress?.({
    phase: 'parse',
    message: `Parsed ${rows.length} rows.`,
    total: rows.length,
  });

  onProgress?.({ phase: 'lookup', message: 'Resolving product models…' });
  const models = rows
    .map((row) => String(row['Model #'] ?? '').trim())
    .filter(Boolean);
  const productLookup = await buildProductLookup(models);

  onProgress?.({ phase: 'conflicts', message: 'Checking cross-type serials…' });
  const inventoryItems = rows
    .map((row) => {
      const model = String(row['Model #'] ?? '').trim();
      if (!model) return null;
      const serialValue = String(row['Serial #'] ?? '').trim();
      const qtyValue =
        typeof row['Inv Qty'] === 'number'
          ? row['Inv Qty']
          : parseInt(String(row['Inv Qty'] ?? '').trim(), 10);
      const product = productLookup.get(model);
      return {
        cso: source.csoValue,
        model,
        qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
        serial: serialValue || undefined,
        product_type: product?.product_type ?? 'UNKNOWN',
        product_fk: product?.id,
        inventory_type: source.inventoryType,
        is_scanned: false,
        scanned_at: undefined,
        scanned_by: undefined,
        notes: undefined,
        status: undefined,
        ge_model: model || undefined,
        ge_serial: serialValue || undefined,
        ge_inv_qty: Number.isFinite(qtyValue) ? qtyValue : undefined,
        ge_availability_status: String(row['Availability Status'] ?? '').trim() || undefined,
        ge_availability_message: String(row['Availability Message'] ?? '').trim() || undefined,
        ge_orphaned: false,
        ge_orphaned_at: undefined,
      } as InventoryItem;
    })
    .filter(Boolean) as InventoryItem[];

  const incomingSerials = Array.from(
    new Set(inventoryItems.map((item) => item.serial).filter(Boolean))
  ) as string[];
  const crossTypeSerials = await findCrossTypeSerials(
    incomingSerials,
    source.inventoryType,
    locationId
  );

  const filteredItems = inventoryItems.filter(
    (item) => !item.serial || !crossTypeSerials.has(item.serial)
  );

  const uniqueBySerial = new Map<string, InventoryItem>();
  const itemsWithoutSerial: InventoryItem[] = [];
  filteredItems.forEach((item) => {
    if (!item.serial) {
      itemsWithoutSerial.push(item);
      return;
    }
    if (!uniqueBySerial.has(item.serial)) {
      uniqueBySerial.set(item.serial, item);
    }
  });

  const uniqueItems = [...itemsWithoutSerial, ...uniqueBySerial.values()];

  // For STA imports, also fetch ASIS items to allow ASIS→STA migration
  // This respects GE as source of truth: if it's STA in GE, it's STA in our system
  const inventoryTypesToFetch = [source.inventoryType];
  if (source.inventoryType === 'STA') {
    inventoryTypesToFetch.push('ASIS');
  }

  const { data: existingItems, error: existingError } = await supabase
    .from('inventory_items')
    .select('id, serial, inventory_type')
    .eq('location_id', locationId)
    .in('inventory_type', inventoryTypesToFetch);

  if (existingError) throw existingError;

  const existingBySerial = new Map<string, string>();
  const existingIds = new Set<string>();

  (existingItems ?? []).forEach((item) => {
    if (!item.serial || !item.id) return;
    // For STA imports, prefer existing STA items over ASIS items
    // (in case of duplicates, which shouldn't happen but safety first)
    const existing = existingBySerial.get(item.serial);
    if (!existing) {
      existingBySerial.set(item.serial, item.id);
    } else if (source.inventoryType === 'STA' && item.inventory_type === 'STA') {
      // If we're importing STA and found an existing STA item, use it over ASIS
      existingBySerial.set(item.serial, item.id);
    }
    existingIds.add(item.id);
  });

  const matchedIds = new Set<string>();
  const payload = uniqueItems.map((item) => {
    if (!item.serial) {
      return {
        ...item,
        company_id: companyId,
        location_id: locationId,
      };
    }

    const existingId = existingBySerial.get(item.serial);
    if (existingId) {
      matchedIds.add(existingId);
    }

    // Note: If importing STA and existingId is an ASIS item, this will
    // migrate it to STA (update inventory_type). This respects GE as source of truth.
    return {
      ...item,
      id: existingId,
      company_id: companyId,
      location_id: locationId,
    };
  });

  // Deduplicate by id to prevent "cannot affect row a second time" error
  const payloadById = new Map<string, typeof payload[0]>();
  type PayloadWithoutId = Omit<typeof payload[0], 'id'>;
  const payloadWithoutIdArray: PayloadWithoutId[] = [];

  payload.forEach((item) => {
    if (item.id) {
      // Keep last occurrence for each id (in case of duplicates)
      if (payloadById.has(item.id)) {
        console.warn('⚠️ Duplicate ID detected in payload:', {
          id: item.id,
          serial: item.serial,
          inventory_type: item.inventory_type,
        });
      }
      payloadById.set(item.id, item);
    } else {
      const { id: _id, ...rest } = item;
      void _id;
      payloadWithoutIdArray.push(rest);
    }
  });

  const payloadWithId = Array.from(payloadById.values());
  const payloadWithoutId = payloadWithoutIdArray;

  console.log('📊 Payload stats:', {
    total: payload.length,
    withId: payloadWithId.length,
    withoutId: payloadWithoutId.length,
    duplicatesRemoved: payload.filter(p => p.id).length - payloadWithId.length,
  });

  let insertedCount = 0;
  for (const chunk of chunkArray(payloadWithoutId, batchSize)) {
    if (!chunk.length) continue;
    onProgress?.({
      phase: 'insert',
      message: `Inserting ${chunk.length} new items…`,
      processed: insertedCount,
      total: payloadWithoutId.length,
    });
    const { error } = await supabase.from('inventory_items').insert(chunk);
    if (error) throw error;
    insertedCount += chunk.length;
  }

  let upsertedCount = 0;
  for (const chunk of chunkArray(payloadWithId, batchSize)) {
    if (!chunk.length) continue;
    onProgress?.({
      phase: 'upsert',
      message: `Updating ${chunk.length} existing items…`,
      processed: upsertedCount,
      total: payloadWithId.length,
    });
    const { error } = await supabase
      .from('inventory_items')
      .upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
    upsertedCount += chunk.length;
  }

  const orphanIds = Array.from(existingIds).filter((id) => !matchedIds.has(id));
  let orphanedCount = 0;
  for (const chunk of chunkArray(orphanIds, batchSize)) {
    if (!chunk.length) continue;
    onProgress?.({
      phase: 'orphans',
      message: `Marking ${chunk.length} missing items as orphaned…`,
      processed: orphanedCount,
      total: orphanIds.length,
    });
    const { error } = await supabase
      .from('inventory_items')
      .update({ status: 'NOT_IN_GE', ge_orphaned: true, ge_orphaned_at: new Date().toISOString() })
      .in('id', chunk);
    if (error) throw error;
    orphanedCount += chunk.length;
  }

  onProgress?.({
    phase: 'complete',
    message: 'Inventory import complete.',
    processed: payload.length,
    total: payload.length,
  });

  return {
    totalRows: rows.length,
    processedRows: inventoryItems.length,
    crossTypeSkipped: crossTypeSerials.size,
  };
}
