import * as XLSX from 'xlsx';
import { getCookieHeader } from '../auth/playwright.js';
import { getSupabase, getLocationConfig, getProductLookup } from '../db/supabase.js';
import { ENDPOINTS, HEADERS, REFERERS, GE_DMS_BASE, buildLoadDetailUrl } from './endpoints.js';
import type {
  GEInventoryItem,
  GELoadMetadata,
  GELoadItem,
  GEReportHistoryItem,
  GELoadInfo,
  GEChange,
  SyncResult,
  SyncStats,
} from '../types/index.js';

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
      ...(referer ? { 'Referer': referer } : {}),
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
 * Fetch CSV from GE endpoint and parse to JSON
 */
async function fetchCsvAsJson<T>(
  url: string,
  cookieHeader: string,
  body?: string,
  referer?: string
): Promise<T[]> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...HEADERS,
      ...(referer ? { 'Referer': referer } : {}),
      Cookie: cookieHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body || 'hCsvView=CSV',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const snippet = errorText.trim().slice(0, 200);
    const details = snippet ? ` Response: ${snippet}` : '';
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}.${details}`);
  }

  const text = await response.text();

  // Check if we got HTML (auth redirect) instead of CSV
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    throw new Error('Received HTML instead of CSV - authentication may have expired');
  }

  // Parse CSV manually (simple implementation)
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const data: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    data.push(row as T);
  }

  return data;
}

/**
 * Simple CSV line parser (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Fetch all ASIS data from GE DMS
 */
type SerialDetail = {
  loadNumber: string;
  model: string;
  qty: string;
  ordc?: string;
  isSynthetic?: boolean;
};

const normalizeModelKey = (model: string) =>
  model.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const getModelVariants = (model: string): string[] => {
  const raw = model.trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const base = raw.split(/[\\s/(-]/)[0] ?? raw;
  const baseUpper = base.toUpperCase();
  const normalized = normalizeModelKey(raw);
  const normalizedBase = normalizeModelKey(base);
  return Array.from(new Set([raw, upper, base, baseUpper, normalized, normalizedBase])).filter(Boolean);
};

const getProductForModel = (
  model: string,
  productLookup: Map<string, { id: string; product_type: string }>
) => {
  for (const key of getModelVariants(model)) {
    const product = productLookup.get(key);
    if (product) return product;
  }
  return undefined;
};

async function backfillInventoryProductLinks(
  db: ReturnType<typeof getSupabase>,
  companyId: string,
  locationId: string,
  productLookup: Map<string, { id: string; product_type: string }>
) {
  const { data, error } = await db
    .from('inventory_items')
    .select('id, model, product_type')
    .eq('company_id', companyId)
    .eq('location_id', locationId)
    .eq('inventory_type', 'ASIS')
    .is('product_fk', null);

  if (error) {
    console.error('Failed to load inventory items for product backfill:', error.message);
    return 0;
  }

  const updates: Array<{ id: string; product_fk: string; product_type?: string }> = [];

  for (const item of data ?? []) {
    if (!item?.id || !item?.model) continue;
    const product = getProductForModel(item.model, productLookup);
    if (!product) continue;
    updates.push({
      id: item.id,
      product_fk: product.id,
      product_type: item.product_type && item.product_type !== 'UNKNOWN'
        ? item.product_type
        : product.product_type,
    });
  }

  if (updates.length === 0) return 0;

  const chunkSize = 500;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error: upsertError } = await db
      .from('inventory_items')
      .upsert(chunk, { onConflict: 'id' });
    if (upsertError) {
      console.error('Failed to backfill inventory product links:', upsertError.message);
      return i;
    }
  }

  return updates.length;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getRowValue(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (key in row) {
      const value = row[key];
      if (value != null) return String(value);
    }
  }

  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(normalizeKey(key), value == null ? '' : String(value));
  }

  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
    if (value != null) return value;
  }

  return undefined;
}

function normalizeToken(value?: string): string {
  if (!value) return '';
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 24);
}

function buildSyntheticSerial(prefix: string, parts: Array<string | undefined>, index: number): string {
  const cleaned = parts.map(normalizeToken).filter(Boolean).join('_');
  return `${prefix}:${cleaned}:${index}`;
}

function isSyntheticSerial(serial: string): boolean {
  return serial.startsWith('ASIS-NS:') || serial.startsWith('ASIS-INV-NS:');
}

async function fetchASISData(locationId: string, invOrg: string) {
  const cookieHeader = await getCookieHeader(locationId);

  console.log('Fetching ASIS load list...');
  const loadList = await fetchXlsAsJson<GELoadMetadata>(
    ENDPOINTS.ASIS_LOAD_LIST,
    cookieHeader,
    'POST',
    `request=ASIS&dmsLoc=${invOrg}`,
    REFERERS.ASIS_LOAD_LIST
  );
  console.log(`  Got ${loadList.length} loads`);

  console.log('Fetching ASIS report history...');
  const reportHistory = await fetchXlsAsJson<GEReportHistoryItem>(
    ENDPOINTS.ASIS_REPORT_HISTORY,
    cookieHeader,
    'POST',
    `dmsLoc=${invOrg}`,
    REFERERS.ASIS_REPORT_HISTORY
  );
  console.log(`  Got ${reportHistory.length} history entries`);

  const mergedLoadData = mergeLoadSources(loadList, reportHistory);

  // Build load info from report history
  const loadInfoMap = new Map<string, GELoadInfo>();
  for (const load of reportHistory) {
    loadInfoMap.set(load['Load Number'], {
      loadNumber: load['Load Number'],
      status: load.Status,
      csoStatus: load['CSO Status'],
      units: parseInt(load.Units, 10) || 0,
      submittedDate: load['Submitted Date'] || undefined,
      cso: load.CSO || undefined,
    });
  }

  // Merge notes from load list
  for (const load of loadList) {
    const existing = loadInfoMap.get(load['Load Number']);
    if (existing) {
      existing.notes = load.Notes;
    }
  }

  const loadInfo = Array.from(loadInfoMap.values());

  console.log(`Fetching details for ${loadInfo.length} loads from report history...`);

  // Fetch per-load items
  const serialToLoad = new Map<string, string>();
  const serialDetails = new Map<string, SerialDetail>();
  const inventoryFromLoads: GEInventoryItem[] = [];
  const seenSerials = new Set<string>();
  let syntheticSerials = 0;
  let duplicateSerials = 0;
  let loadsFetched = 0;
  let loadsFailed = 0;
  const failedLoads: string[] = [];
  const loadNoSerialIndex = new Map<string, number>();

  for (const load of loadInfo) {
    try {
      const url = buildLoadDetailUrl(load.loadNumber);
      const items = await fetchCsvAsJson<GELoadItem>(url, cookieHeader, 'hCsvView=CSV', REFERERS.ASIS_LOAD_DETAIL);
      loadsFetched += 1;

      for (const item of items) {
        let serial = item.SERIALS?.trim() || '';
        const model = item.MODELS?.trim() || '';
        const qty = item.QTY?.trim() || '1';
        const loadNumber = item['LOAD NUMBER']?.trim() || load.loadNumber;
        const ordc = item.ORDC?.trim();

        if (!serial) {
          const idx = (loadNoSerialIndex.get(loadNumber) ?? 0) + 1;
          loadNoSerialIndex.set(loadNumber, idx);
          serial = buildSyntheticSerial('ASIS-NS', [loadNumber, model, ordc], idx);
          syntheticSerials += 1;
        }

        if (seenSerials.has(serial)) {
          duplicateSerials += 1;
          continue;
        }

        seenSerials.add(serial);
        serialToLoad.set(serial, loadNumber);
        serialDetails.set(serial, { loadNumber, model, qty, ordc, isSynthetic: isSyntheticSerial(serial) });
        inventoryFromLoads.push({
          'Serial #': serial,
          'Model #': model,
          'Inv Qty': qty,
          'Availability Status': '',
          'Availability Message': '',
        });
      }
    } catch (error) {
      loadsFailed += 1;
      failedLoads.push(load.loadNumber);
      console.warn(`  Failed to fetch load ${load.loadNumber}:`, error);
    }
  }

  console.log(`  Mapped ${serialToLoad.size} serials to loads`);
  if (syntheticSerials > 0 || duplicateSerials > 0) {
    console.log(`  Built ${syntheticSerials} synthetic serials, ${duplicateSerials} duplicate serials`);
  }
  console.log(`  Load fetch summary: total=${loadInfo.length}, fetched=${loadsFetched}, failed=${loadsFailed}`);
  if (failedLoads.length > 0) {
    console.log(`  Failed loads (first 5): ${failedLoads.slice(0, 5).join(', ')}`);
  }

  // Fetch master ASIS inventory (ASIS.csv equivalent) for unassigned items.
  let masterInventory: GEInventoryItem[] | null = null;
  try {
    console.log('Fetching ASIS master inventory...');
    masterInventory = await fetchAsisInventory(cookieHeader, invOrg);
    console.log(`  Got ${masterInventory.length} master inventory items`);
  } catch (error) {
    console.warn('Failed to fetch ASIS master inventory (continuing without it):', error);
  }

  return {
    inventoryFromLoads,
    masterInventory,
    serialDetails,
    loadInfo,
    serialToLoad,
    mergedLoadData,
  };
}

type NormalizedLoad = {
  loadNumber: string;
  source: 'ASISLoadData' | 'ASISReportHistoryData';
  ge_source_status: string;
  ge_cso_status: string;
  ge_inv_org: string;
  ge_units: number;
  ge_submitted_date: string;
  ge_cso: string;
  ge_pricing: string;
  ge_notes: string;
  ge_scanned_at: string;
};

type MergedLoad = {
  loadNumber: string;
  ge_source_status: string | null;
  ge_cso_status: string | null;
  ge_inv_org: string | null;
  ge_units: number | null;
  ge_submitted_date: string | null;
  ge_cso: string | null;
  ge_pricing: string | null;
  ge_notes: string | null;
  ge_scanned_at: string | null;
};

function mergeLoadSources(loadList: GELoadMetadata[], reportHistory: GEReportHistoryItem[]): MergedLoad[] {
  const normalizeUnits = (value: string | number | undefined) => {
    const n = typeof value === 'number' ? value : parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizedFromLoadList: NormalizedLoad[] = (loadList ?? [])
    .map(row => {
      const loadNumber = String(row['Load Number'] ?? '').trim();
      if (!loadNumber) return null;
      return {
        loadNumber,
        source: 'ASISLoadData',
        ge_source_status: String(row.Status ?? '').trim(),
        ge_cso_status: '',
        ge_inv_org: '',
        ge_units: normalizeUnits(row.Units),
        ge_submitted_date: '',
        ge_cso: '',
        ge_pricing: '',
        ge_notes: String(row.Notes ?? '').trim(),
        ge_scanned_at: String(row['Scanned Date/Time'] ?? '').trim(),
      } satisfies NormalizedLoad;
    })
    .filter(Boolean) as NormalizedLoad[];

  const normalizedFromHistory: NormalizedLoad[] = (reportHistory ?? [])
    .map(row => {
      const loadNumber = String(row['Load Number'] ?? '').trim();
      if (!loadNumber) return null;
      return {
        loadNumber,
        source: 'ASISReportHistoryData',
        ge_source_status: String(row.Status ?? '').trim(),
        ge_cso_status: String(row['CSO Status'] ?? '').trim(),
        ge_inv_org: String(row['Inv Org'] ?? '').trim(),
        ge_units: normalizeUnits(row.Units),
        ge_submitted_date: String(row['Submitted Date'] ?? '').trim(),
        ge_cso: String(row.CSO ?? '').trim(),
        ge_pricing: String(row.Pricing ?? '').trim(),
        ge_notes: '',
        ge_scanned_at: '',
      } satisfies NormalizedLoad;
    })
    .filter(Boolean) as NormalizedLoad[];

  const normalizedLoads: NormalizedLoad[] = [...normalizedFromLoadList, ...normalizedFromHistory];

  const bestByLoadNumber = new Map<string, NormalizedLoad>();
  const historyDataByLoadNumber = new Map<string, NormalizedLoad>();

  for (const l of normalizedLoads) {
    if (l.source === 'ASISReportHistoryData') {
      historyDataByLoadNumber.set(l.loadNumber, l);
    }

    const existing = bestByLoadNumber.get(l.loadNumber);
    if (!existing) {
      bestByLoadNumber.set(l.loadNumber, l);
      continue;
    }

    if (existing.source !== 'ASISLoadData' && l.source === 'ASISLoadData') {
      bestByLoadNumber.set(l.loadNumber, l);
    }
  }

  const merged: MergedLoad[] = [];
  for (const loadNumber of bestByLoadNumber.keys()) {
    const loadData = bestByLoadNumber.get(loadNumber);
    if (!loadData) continue;
    const historyData = historyDataByLoadNumber.get(loadNumber);
    merged.push({
      loadNumber,
      ge_notes: loadData.ge_notes || historyData?.ge_notes || null,
      ge_scanned_at: loadData.ge_scanned_at || historyData?.ge_scanned_at || null,
      ge_source_status: historyData?.ge_source_status || loadData.ge_source_status || null,
      ge_cso_status: historyData?.ge_cso_status || null,
      ge_inv_org: historyData?.ge_inv_org || null,
      ge_units: historyData?.ge_units ?? loadData.ge_units ?? null,
      ge_submitted_date: historyData?.ge_submitted_date || null,
      ge_cso: historyData?.ge_cso || null,
      ge_pricing: historyData?.ge_pricing || null,
    });
  }

  return merged;
}

function deriveFriendlyNameFromNotes(notes?: string | null, status?: string | null): string | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase();
  const statusValue = status?.toUpperCase().trim() ?? '';
  if (statusValue && statusValue !== 'FOR SALE') return null;

  const letterMatch = normalized.match(/\bLETTER\s+([A-Z]{1,2})\b/);
  if (letterMatch?.[1]) return letterMatch[1];

  const firstToken = normalized.split(/[\s-]+/).find(Boolean);
  if (firstToken && /^[A-Z]{1,2}$/.test(firstToken)) return firstToken;

  const dateMatch = normalized.match(/\b(\d{1,2}\/\d{1,2})\b/);
  if (dateMatch?.[1]) return dateMatch[1];

  const dayMatch = normalized.match(/\b(\d{1,2}(?:ST|ND|RD|TH))\b/);
  if (dayMatch?.[1]) return dayMatch[1];

  return null;
}

async function fetchAsisInventory(cookieHeader: string, invOrg: string): Promise<GEInventoryItem[]> {
  // ERP Check Inventory export filtered by ASIS subinventory.
  try {
    const body = new URLSearchParams({
      dmsLoc: invOrg,
      subInvLoc: 'ASIS',
      invorg: invOrg,
      erpDataList: '[]',
    }).toString();

    const inventoryXls = await fetchXlsAsJson<GEInventoryItem>(
      ENDPOINTS.ERP_INVENTORY_SPREADSHEET,
      cookieHeader,
      'POST',
      body,
      REFERERS.ERP_INVENTORY
    );

    if (inventoryXls.length > 0) {
      return inventoryXls;
    }
  } catch (error) {
    console.warn('ERP inventory spreadsheet attempt failed:', error);
  }

  const attempts: Array<{
    method: 'GET' | 'POST';
    body?: string;
    referer: string;
    url?: string;
  }> = [
    { method: 'GET', referer: REFERERS.ASIS_INVENTORY },
    { method: 'GET', referer: REFERERS.ASIS_INVENTORY_ALT },
    { method: 'GET', referer: REFERERS.ASIS_INVENTORY, url: `${ENDPOINTS.ASIS_INVENTORY}?dmsLoc=${invOrg}` },
    { method: 'GET', referer: REFERERS.ASIS_INVENTORY, url: `${ENDPOINTS.ASIS_INVENTORY}?invOrg=${invOrg}` },
    { method: 'POST', body: `dmsLoc=${invOrg}`, referer: REFERERS.ASIS_INVENTORY },
    { method: 'POST', body: `request=ASIS&dmsLoc=${invOrg}`, referer: REFERERS.ASIS_INVENTORY },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const targetUrl = attempt.url ?? ENDPOINTS.ASIS_INVENTORY;
      return await fetchXlsAsJson<GEInventoryItem>(
        targetUrl,
        cookieHeader,
        attempt.method,
        attempt.body,
        attempt.referer
      );
    } catch (error) {
      lastError = error;
      console.warn(
        `ASIS inventory attempt failed (${attempt.method} ${attempt.referer} ${attempt.body ?? ''}):`,
        error
      );
    }
  }

  const discovered = await discoverInventoryDownloadUrl(cookieHeader);
  if (discovered) {
    console.log(`Discovered inventory download URL from /dms/asis: ${discovered}`);
    try {
      return await fetchXlsAsJson<GEInventoryItem>(
        discovered,
        cookieHeader,
        'GET',
        undefined,
        REFERERS.ASIS_INVENTORY
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `ASIS inventory download failed after ${attempts.length} attempts` +
      (discovered ? ' plus discovered URL attempt' : '') +
      `. Last error: ${String(lastError)}`
  );
}

async function discoverInventoryDownloadUrl(cookieHeader: string): Promise<string | null> {
  const pageUrl = `${GE_DMS_BASE}/dms/asis`;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        ...HEADERS,
        Referer: REFERERS.ASIS_INVENTORY_ALT,
        Cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to load /dms/asis page: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      console.log(`Loaded /dms/asis page title: ${titleMatch[1].trim()}`);
    }

    const matches = new Set<string>();
    const patterns = [
      /https?:\/\/[^"'\\s>]+/g,
      /\/dms\/[a-z0-9/_-]*download[a-z0-9/_-]*/gi,
      /action\s*=\s*["']([^"']+)["']/gi,
      /['"]([^'"]{4,200})['"]/g,
    ];

    for (const pattern of patterns) {
      const found = [...html.matchAll(pattern)];
      for (const match of found) {
        const url = match[1] ?? match[0];
        const lower = url.toLowerCase();
        if (
          lower.includes('download') ||
          lower.includes('spreadsheet') ||
          lower.includes('.xls') ||
          lower.includes('.xlsx') ||
          lower.includes('export')
        ) {
          matches.add(url);
        }
      }
    }

    const candidates = Array.from(matches)
      .map(raw => {
        if (raw.startsWith('http')) return raw;
        if (raw.startsWith('/')) return `${GE_DMS_BASE}${raw}`;
        if (raw.startsWith('dms/')) return `${GE_DMS_BASE}/${raw}`;
        return `${GE_DMS_BASE}/dms/asis/${raw}`;
      })
      .filter(url => url.includes('/dms/'));

    if (candidates.length === 0) {
      console.warn('No download URLs discovered on /dms/asis page');
      console.warn(`ASIS page snippet: ${html.slice(0, 300).replace(/\s+/g, ' ')}`);
      return null;
    }

    // Prefer known Excel spreadsheet downloads
    const preferred =
      candidates.find(url => url.includes('downloadExcelSpreadsheet')) ??
      candidates.find(url => url.toLowerCase().includes('spreadsheet')) ??
      candidates.find(url => url.toLowerCase().includes('download')) ??
      candidates[0];
    console.log(`Discovered ${candidates.length} download URLs on /dms/asis`);
    return preferred;
  } catch (error) {
    console.warn('Failed to discover inventory download URL:', error);
    return null;
  }
}

/**
 * Main ASIS sync function
 */
export async function syncASIS(locationId: string): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    const config = await getLocationConfig(locationId);
    const db = getSupabase();
    const productLookup = await getProductLookup(config.companyId);

    // Determine invOrg from location slug or config
    // For now, hardcode to 9SU - should be configurable per location
    const invOrg = '9SU'; // TODO: Make this configurable

    // Fetch from GE
    const { inventoryFromLoads, masterInventory, serialDetails, loadInfo, serialToLoad, mergedLoadData } =
      await fetchASISData(locationId, invOrg);

    // Sync load metadata (notes/status/etc.)
    await syncLoadMetadata(db, config.companyId, locationId, mergedLoadData);

    const loadCsoByLoadNumber = new Map<string, string>();
    for (const load of mergedLoadData) {
      if (load.ge_cso) {
        loadCsoByLoadNumber.set(load.loadNumber, load.ge_cso);
      }
    }

    // Build final inventory list.
    const inventory: GEInventoryItem[] = [];
    const serialsInMaster = new Set<string>();

    let masterSyntheticSerials = 0;
    if (masterInventory && masterInventory.length > 0) {
      let masterIndex = 0;
      let masterMissingSerials = 0;
      for (const item of masterInventory) {
        masterIndex += 1;
        let serial =
          getRowValue(item as unknown as Record<string, unknown>, ['Serial #', 'Serial#', 'Serial', 'SERIALS'])?.trim() || '';
        const modelValue = getRowValue(item as unknown as Record<string, unknown>, ['Model #', 'Model#', 'Model', 'MODELS'])?.trim();
        const qtyValue = getRowValue(item as unknown as Record<string, unknown>, ['Inv Qty', 'InvQty', 'Qty', 'QTY'])?.trim();
        const statusValue = getRowValue(item as unknown as Record<string, unknown>, ['Availability Status', 'AvailabilityStatus', 'Status'])?.trim();
        const messageValue = getRowValue(item as unknown as Record<string, unknown>, ['Availability Message', 'AvailabilityMessage', 'Message'])?.trim();

        if (!serial) {
          serial = buildSyntheticSerial('ASIS-INV-NS', [modelValue, statusValue], masterIndex);
          masterSyntheticSerials += 1;
          masterMissingSerials += 1;
        }

        serialsInMaster.add(serial);

        const detail = serialDetails.get(serial);
        if (detail) {
          inventory.push({
            'Serial #': serial,
            'Model #': modelValue || detail.model,
            'Inv Qty': qtyValue || detail.qty,
            'Availability Status': statusValue || '',
            'Availability Message': messageValue || '',
          });
        } else {
          inventory.push({
            'Serial #': serial,
            'Model #': modelValue || '',
            'Inv Qty': qtyValue || '1',
            'Availability Status': statusValue || '',
            'Availability Message': messageValue || '',
          });
        }
      }

      // Include any load serials not present in master inventory.
      for (const [serial, detail] of serialDetails) {
        if (!serialsInMaster.has(serial)) {
          inventory.push({
            'Serial #': serial,
            'Model #': detail.model,
            'Inv Qty': detail.qty,
            'Availability Status': '',
            'Availability Message': '',
          });
        }
      }

      if (masterMissingSerials > 0) {
        console.log(`  Master inventory rows missing serials: ${masterMissingSerials}`);
      }
    } else {
      inventory.push(...inventoryFromLoads);
    }

    if (inventory.length === 0 && masterInventory && masterInventory.length > 0) {
      const sample = masterInventory[0] as unknown as Record<string, unknown>;
      console.log('Master inventory header keys (sample row):', Object.keys(sample));
    }

    if (masterSyntheticSerials > 0) {
      console.log(`  Built ${masterSyntheticSerials} synthetic serials for master inventory rows with no serial`);
    }

    // Fetch existing items from DB
    const { data: existingItems, error: fetchError } = await db
      .from('inventory_items')
      .select('id, serial, model, sub_inventory, ge_availability_status, ge_availability_message, ge_inv_qty, ge_orphaned')
      .eq('company_id', config.companyId)
      .eq('location_id', locationId)
      .eq('inventory_type', 'ASIS');

    if (fetchError) {
      throw new Error(`Failed to fetch existing items: ${fetchError.message}`);
    }

    // Build existing items map
    interface ExistingItem {
      id: string;
      serial: string;
      model?: string;
      sub_inventory?: string;
      ge_availability_status?: string;
      ge_availability_message?: string;
      ge_inv_qty?: number;
      ge_orphaned?: boolean;
    }

    const existingBySerial = new Map<string, ExistingItem>();

    for (const item of existingItems || []) {
      if (!item.serial || !item.id) continue;
      if (!existingBySerial.has(item.serial)) {
        existingBySerial.set(item.serial, item as ExistingItem);
      }
    }

    // Process inventory and detect changes
    const changes: GEChange[] = [];
    const itemsToUpsert: Record<string, unknown>[] = [];
    let newItems = 0;
    let updatedItems = 0;
    let itemsInLoads = 0;

    for (const geItem of inventory) {
      const serial = geItem['Serial #']?.trim();
      if (!serial) continue;

      const model = geItem['Model #']?.trim() || '';
      const product = getProductForModel(model, productLookup);
      const detail = serialDetails.get(serial);
      const ordcValue = detail?.ordc?.trim() || undefined;
      const loadNumber = serialToLoad.get(serial);
      const loadCso = loadNumber ? loadCsoByLoadNumber.get(loadNumber) : undefined;
      const csoValue = loadCso?.trim() || '';
      const existing = existingBySerial.get(serial);

      if (loadNumber) itemsInLoads++;

      const qtyValue = parseInt(geItem['Inv Qty'], 10);
      const newAvailabilityStatus = geItem['Availability Status']?.trim() || undefined;
      const newAvailabilityMessage = geItem['Availability Message']?.trim() || undefined;

      if (existing) {
        updatedItems++;

        // Detect changes
        if (existing.ge_availability_status !== newAvailabilityStatus) {
          changes.push({
            company_id: config.companyId,
            location_id: locationId,
            inventory_type: 'ASIS',
            serial,
            model,
            load_number: loadNumber,
            change_type: newAvailabilityStatus === 'Reserved' ? 'item_reserved' : 'item_status_changed',
            field_changed: 'availability_status',
            old_value: existing.ge_availability_status,
            new_value: newAvailabilityStatus,
            source: 'ASIS',
          });
        }

        if (existing.sub_inventory !== loadNumber) {
          changes.push({
            company_id: config.companyId,
            location_id: locationId,
            inventory_type: 'ASIS',
            serial,
            model,
            load_number: loadNumber,
            change_type: 'item_load_changed',
            field_changed: 'sub_inventory',
            old_value: existing.sub_inventory,
            new_value: loadNumber,
            source: 'ASISLoadDetail',
          });
        }

        if (existing.ge_orphaned === true) {
          changes.push({
            company_id: config.companyId,
            location_id: locationId,
            inventory_type: 'ASIS',
            serial,
            model,
            load_number: loadNumber,
            change_type: 'item_appeared',
            field_changed: 'ge_orphaned',
            old_value: 'true',
            new_value: 'false',
            source: 'ASIS',
          });
        }
      } else {
        newItems++;
        changes.push({
          company_id: config.companyId,
          location_id: locationId,
          inventory_type: 'ASIS',
          serial,
          model,
          load_number: loadNumber,
          change_type: 'item_appeared',
          current_state: {
            availability_status: newAvailabilityStatus,
            inv_qty: qtyValue,
            load_number: loadNumber,
          },
          source: 'ASIS',
        });
      }

      itemsToUpsert.push({
        id: existing?.id,
        company_id: config.companyId,
        location_id: locationId,
        serial,
        model,
        cso: csoValue ?? '',
        qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
        product_type: product?.product_type ?? 'UNKNOWN',
        product_fk: product?.id,
        inventory_type: 'ASIS',
        sub_inventory: loadNumber || null,
        ge_model: model || null,
        ge_serial: isSyntheticSerial(serial) ? null : serial,
        ge_inv_qty: Number.isFinite(qtyValue) ? qtyValue : null,
        ge_ordc: ordcValue ?? null,
        ge_orphaned: false,
        ge_orphaned_at: null,
        ge_availability_status: newAvailabilityStatus || null,
        ge_availability_message: newAvailabilityMessage || null,
      });
    }

    // Log changes to ge_changes table
    let changesLogged = 0;
    if (changes.length > 0) {
      const { error: changeError } = await db.from('ge_changes').insert(changes);
      if (changeError) {
        console.error('Failed to log changes:', changeError.message);
      } else {
        changesLogged = changes.length;
      }
    }

    // Upsert items (dedupe by id/serial to avoid ON CONFLICT hitting same row twice)
    const itemsWithIdMap = new Map<string, Record<string, unknown>>();
    const itemsWithoutIdMap = new Map<string, Record<string, unknown>>();

    for (const item of itemsToUpsert) {
      const id = typeof item.id === 'string' ? item.id : undefined;
      const serial = typeof item.serial === 'string' ? item.serial : undefined;

      if (id) {
        itemsWithIdMap.set(id, item);
        continue;
      }

      if (serial) {
        itemsWithoutIdMap.set(serial, item);
      } else {
        itemsWithoutIdMap.set(`__row_${itemsWithoutIdMap.size}`, item);
      }
    }

    const itemsWithId = Array.from(itemsWithIdMap.values());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const itemsWithoutId = Array.from(itemsWithoutIdMap.values()).map(({ id: _id, ...rest }) => rest);
    const itemsWithoutIdWithSerial = itemsWithoutId.filter(
      (item) => typeof item.serial === 'string' && item.serial.trim().length > 0
    );
    const itemsWithoutIdWithoutSerial = itemsWithoutId.filter(
      (item) => !item.serial || (typeof item.serial === 'string' && item.serial.trim().length === 0)
    );

    const upsertChunkSize = 500;

    if (itemsWithoutIdWithoutSerial.length > 0) {
      for (let i = 0; i < itemsWithoutIdWithoutSerial.length; i += upsertChunkSize) {
        const chunk = itemsWithoutIdWithoutSerial.slice(i, i + upsertChunkSize);
        const { error: insertError } = await db
          .from('inventory_items')
          .insert(chunk);
        if (insertError) {
          throw new Error(`Failed to insert new items: ${insertError.message}`);
        }
      }
    }

    if (itemsWithoutIdWithSerial.length > 0) {
      for (let i = 0; i < itemsWithoutIdWithSerial.length; i += upsertChunkSize) {
        const chunk = itemsWithoutIdWithSerial.slice(i, i + upsertChunkSize);
        const { error: upsertSerialError } = await db
          .from('inventory_items')
          .upsert(chunk, { onConflict: 'company_id,location_id,serial' });
        if (upsertSerialError) {
          throw new Error(`Failed to upsert serial items: ${upsertSerialError.message}`);
        }
      }
    }

    if (itemsWithId.length > 0) {
      for (let i = 0; i < itemsWithId.length; i += upsertChunkSize) {
        const chunk = itemsWithId.slice(i, i + upsertChunkSize);
        const { error: upsertError } = await db
          .from('inventory_items')
          .upsert(chunk, { onConflict: 'id' });
        if (upsertError) {
          throw new Error(`Failed to upsert items: ${upsertError.message}`);
        }
      }
    }

    const backfilledCount = await backfillInventoryProductLinks(
      db,
      config.companyId,
      locationId,
      productLookup
    );
    if (backfilledCount > 0) {
      console.log(`Backfilled ${backfilledCount} ASIS items with product links.`);
    }

    // Orphans are not a concept for ASIS-only syncs; clear any stale flags.
    const { error: clearOrphansError } = await db
      .from('inventory_items')
      .update({ ge_orphaned: false, ge_orphaned_at: null })
      .eq('company_id', config.companyId)
      .eq('location_id', locationId)
      .eq('inventory_type', 'ASIS')
      .eq('ge_orphaned', true);

    if (clearOrphansError) {
      console.error('Failed to clear orphan flags:', clearOrphansError.message);
    }
    const stats: SyncStats = {
      totalGEItems: inventory.length,
      itemsInLoads,
      unassignedItems: masterInventory ? inventory.length - itemsInLoads : 0,
      newItems,
      updatedItems,
      forSaleLoads: loadInfo.filter(l => l.status === 'FOR SALE').length,
      pickedLoads: loadInfo.filter(l => l.status === 'SOLD' && l.csoStatus === 'Picked').length,
      changesLogged,
    };

    return {
      success: true,
      stats,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: message,
      duration: Date.now() - startTime,
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
    };
  }
}

async function syncLoadMetadata(
  db: ReturnType<typeof getSupabase>,
  companyId: string,
  locationId: string,
  mergedLoads: MergedLoad[]
): Promise<void> {
  if (!mergedLoads.length) return;

  const uniqueLoadNumbers = Array.from(new Set(mergedLoads.map(l => l.loadNumber)));

  type ExistingLoad = {
    sub_inventory_name: string;
    friendly_name?: string | null;
    ge_source_status?: string | null;
    ge_cso_status?: string | null;
    ge_inv_org?: string | null;
    ge_units?: number | null;
    ge_submitted_date?: string | null;
    ge_cso?: string | null;
    ge_pricing?: string | null;
    ge_notes?: string | null;
    ge_scanned_at?: string | null;
  };

  const existingLoadMap = new Map<string, ExistingLoad>();
  const existingLoadNumbers = new Set<string>();
  const chunkSize = 200;

  for (let i = 0; i < uniqueLoadNumbers.length; i += chunkSize) {
    const chunk = uniqueLoadNumbers.slice(i, i + chunkSize);
    const { data, error } = await db
      .from('load_metadata')
      .select(
        'sub_inventory_name, friendly_name, ge_source_status, ge_cso_status, ge_inv_org, ge_units, ge_submitted_date, ge_cso, ge_pricing, ge_notes, ge_scanned_at'
      )
      .eq('location_id', locationId)
      .eq('inventory_type', 'ASIS')
      .in('sub_inventory_name', chunk);

    if (error) {
      throw new Error(`Failed to fetch load metadata: ${error.message}`);
    }

    for (const load of data ?? []) {
      existingLoadNumbers.add(load.sub_inventory_name);
      existingLoadMap.set(load.sub_inventory_name, load as ExistingLoad);
    }
  }

  const newLoads = mergedLoads
    .filter(load => !existingLoadNumbers.has(load.loadNumber))
    .map(load => {
      const derivedFriendlyName = deriveFriendlyNameFromNotes(load.ge_notes, load.ge_source_status);
      return ({
      company_id: companyId,
      location_id: locationId,
      inventory_type: 'ASIS',
      sub_inventory_name: load.loadNumber,
      status: 'active',
      friendly_name: derivedFriendlyName ?? null,
      ge_source_status: load.ge_source_status,
      ge_cso_status: load.ge_cso_status,
      ge_inv_org: load.ge_inv_org,
      ge_units: load.ge_units,
      ge_submitted_date: load.ge_submitted_date,
      ge_cso: load.ge_cso,
      ge_pricing: load.ge_pricing,
      ge_notes: load.ge_notes,
      ge_scanned_at: load.ge_scanned_at,
      });
    });

  if (newLoads.length) {
    for (let i = 0; i < newLoads.length; i += chunkSize) {
      const chunk = newLoads.slice(i, i + chunkSize);
      const { error } = await db.from('load_metadata').insert(chunk);
      if (error) {
        throw new Error(`Failed to insert load metadata: ${error.message}`);
      }
    }
  }

  let updatedLoadsCount = 0;
  for (const load of mergedLoads) {
    if (!existingLoadNumbers.has(load.loadNumber)) continue;
    const existing = existingLoadMap.get(load.loadNumber);
    if (!existing) continue;

    const updates: Record<string, string | number | null> = {};
    const derivedFriendlyName = deriveFriendlyNameFromNotes(load.ge_notes, load.ge_source_status);

    if (load.ge_source_status && load.ge_source_status !== existing.ge_source_status) {
      updates.ge_source_status = load.ge_source_status;
    }
    if (load.ge_cso_status && load.ge_cso_status !== existing.ge_cso_status) {
      updates.ge_cso_status = load.ge_cso_status;
    }
    if (load.ge_inv_org && load.ge_inv_org !== existing.ge_inv_org) {
      updates.ge_inv_org = load.ge_inv_org;
    }
    if (load.ge_units != null && load.ge_units !== existing.ge_units) {
      updates.ge_units = load.ge_units;
    }
    if (load.ge_submitted_date && load.ge_submitted_date !== existing.ge_submitted_date) {
      updates.ge_submitted_date = load.ge_submitted_date;
    }
    if (load.ge_cso && load.ge_cso !== existing.ge_cso) {
      updates.ge_cso = load.ge_cso;
    }
    if (load.ge_pricing && load.ge_pricing !== existing.ge_pricing) {
      updates.ge_pricing = load.ge_pricing;
    }
    if (load.ge_notes && load.ge_notes !== existing.ge_notes) {
      updates.ge_notes = load.ge_notes;
    }
    if (load.ge_scanned_at && load.ge_scanned_at !== existing.ge_scanned_at) {
      updates.ge_scanned_at = load.ge_scanned_at;
    }
    if (derivedFriendlyName && (!existing.friendly_name || !existing.friendly_name.trim())) {
      updates.friendly_name = derivedFriendlyName;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await db
        .from('load_metadata')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS')
        .eq('sub_inventory_name', load.loadNumber);

      if (error) {
        throw new Error(`Failed to update load metadata: ${error.message}`);
      }
      updatedLoadsCount += 1;
    }
  }

  if (newLoads.length || updatedLoadsCount > 0) {
    console.log(`Load metadata synced (new: ${newLoads.length}, updated: ${updatedLoadsCount})`);
  }
}
