import XLSX from 'xlsx';
import { getCookieHeader } from '../auth/playwright.js';
import { getSupabase, getLocationConfig } from '../db/supabase.js';
import { GE_DMS_BASE, HEADERS } from './endpoints.js';
import type { SyncResult } from '../types/index.js';

const BACKHAUL_BASE = `${GE_DMS_BASE}/dms/backhaul`;

type BackhaulListRow = {
  'Inv Org'?: string;
  ISO?: string;
  'Start Date'?: string;
  'End Date'?: string;
  'Backhaul Status'?: string;
  Cancel?: string;
  'Total Units'?: string | number;
  'Total Points'?: string | number;
  Type?: string;
  'Sub Inventory'?: string;
  ADC?: string;
  SCAC?: string;
};

type PickListRow = {
  'Inv Org'?: string;
  ISO?: string;
  'ISO Line #'?: string;
  'Model #'?: string;
  'Serial #'?: string;
  'Acc Qty'?: string | number;
  'ISO Line Status'?: string;
  Cancel?: string;
  Confirm?: string;
};

type BackhaulSyncOptions = {
  includeClosed?: boolean;
  maxOrders?: number;
};

const toText = (value: unknown) => (value == null ? '' : String(value).trim());
const toNumber = (value: unknown) => {
  const raw = toText(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const fetchBackhaulHtml = async (cookieHeader: string, invOrg: string, notComplete: boolean) => {
  const params = new URLSearchParams();
  params.set('dmsLoc', invOrg);
  params.set('searchYear', String(new Date().getFullYear()));
  params.set('notComplete', notComplete ? 'Y' : 'N');

  const response = await fetch(BACKHAUL_BASE, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: BACKHAUL_BASE,
      Cookie: cookieHeader,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const snippet = (await response.text().catch(() => '')).trim().slice(0, 200);
    throw new Error(`Backhaul HTML fetch failed: ${response.status} ${response.statusText}. ${snippet}`);
  }

  return response.text();
};

const extractIsoIdMap = (html: string) => {
  const map = new Map<string, string>();
  const regex = /href="\/dms\/backhaul\/iso\?id=(\d+)"[^>]*>(\d+)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const isoId = match[1];
    const iso = match[2];
    if (isoId && iso) {
      map.set(iso, isoId);
    }
  }
  return map;
};

const fetchBackhaulSpreadsheet = async (
  cookieHeader: string,
  invOrg: string,
  notComplete: boolean
): Promise<{ rows: BackhaulListRow[]; message?: string }> => {
  const params = new URLSearchParams();
  params.set('dmsLoc', invOrg);
  params.set('searchYear', String(new Date().getFullYear()));
  params.set('notComplete', notComplete ? 'Y' : 'N');

  const response = await fetch(`${BACKHAUL_BASE}/downloadBackhaulSpreadsheet?notComplete=${notComplete ? 'Y' : 'N'}`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      Referer: BACKHAUL_BASE,
      Cookie: cookieHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const snippet = (await response.text().catch(() => '')).trim().slice(0, 200);
    throw new Error(`Backhaul export failed: ${response.status} ${response.statusText}. ${snippet}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const html = await response.text();
    if (/no open orders/i.test(html)) {
      return { rows: [], message: 'No open orders at this time.' };
    }
    return { rows: [], message: 'Backhaul export returned HTML instead of spreadsheet.' };
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<BackhaulListRow>(sheet);
  return { rows };
};

const fetchPickListSpreadsheet = async (
  cookieHeader: string,
  invOrg: string,
  isoId: string,
  iso: string
): Promise<PickListRow[]> => {
  const url = `${GE_DMS_BASE}/dms/backhaul/downloadIsoSpreadsheet?id=${isoId}&invOrg=${invOrg}&iso=${iso}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...HEADERS,
      Referer: `${GE_DMS_BASE}/dms/backhaul/iso?id=${isoId}`,
      Cookie: cookieHeader,
    },
  });

  if (!response.ok) {
    const snippet = (await response.text().catch(() => '')).trim().slice(0, 200);
    throw new Error(`Pick list export failed for ISO ${iso}: ${response.status} ${response.statusText}. ${snippet}`);
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<PickListRow>(sheet);
};

const normalizeBackhaulRows = (
  rows: BackhaulListRow[],
  companyId: string,
  locationId: string,
  isoIdMap: Map<string, string>,
  isOpen: boolean
) => {
  return rows
    .map((row) => {
      const iso = toText(row.ISO);
      if (!iso) return null;
      return {
        iso,
        iso_id: isoIdMap.get(iso) || null,
        company_id: companyId,
        location_id: locationId,
        inv_org: toText(row['Inv Org']),
        start_date: toText(row['Start Date']) || null,
        end_date: toText(row['End Date']) || null,
        backhaul_status: toText(row['Backhaul Status']),
        cancel: toText(row.Cancel),
        total_units: toNumber(row['Total Units']),
        total_points: toNumber(row['Total Points']),
        type: toText(row.Type),
        sub_inventory: toText(row['Sub Inventory']),
        adc: toText(row.ADC),
        scac: toText(row.SCAC),
        is_open: isOpen,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
};

const normalizePickListRows = (
  rows: PickListRow[],
  companyId: string,
  locationId: string,
  iso: string
) => {
  return rows
    .map((row) => {
      const lineNumber = toText(row['ISO Line #']);
      if (!lineNumber) return null;
      return {
        iso,
        iso_line_number: lineNumber,
        company_id: companyId,
        location_id: locationId,
        model: toText(row['Model #']),
        serial: toText(row['Serial #']),
        acc_qty: toNumber(row['Acc Qty']),
        line_status: toText(row['ISO Line Status']),
        cancel: toText(row.Cancel),
        confirm: toText(row.Confirm),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
};

export async function syncBackhaul(locationId: string, options: BackhaulSyncOptions = {}): Promise<SyncResult> {
  const startTime = Date.now();
  const log: string[] = [];

  try {
    const db = getSupabase();
    const config = await getLocationConfig(locationId);
    const invOrg = process.env.BACKHAUL_INV_ORG ?? '9SU';
    const maxOrders = Number.parseInt(process.env.BACKHAUL_MAX_ORDERS || String(options.maxOrders ?? 0), 10);
    const cookieHeader = await getCookieHeader(locationId);

    log.push('Starting backhaul sync');
    log.push(`Company ${config.companyId} • Location ${locationId}`);
    log.push(`Inv Org: ${invOrg}`);

    const { data: existingClosed } = await db
      .from('backhaul_orders')
      .select('iso')
      .eq('location_id', locationId)
      .eq('is_open', false)
      .limit(1);

    const includeClosed = options.includeClosed
      ?? !(existingClosed && existingClosed.length > 0);

    const openHtml = await fetchBackhaulHtml(cookieHeader, invOrg, true);
    const openIsoMap = extractIsoIdMap(openHtml);
    const openList = await fetchBackhaulSpreadsheet(cookieHeader, invOrg, true);
    if (openList.message) {
      log.push(openList.message);
    }

    const closedHtml = includeClosed ? await fetchBackhaulHtml(cookieHeader, invOrg, false) : '';
    const closedIsoMap = includeClosed ? extractIsoIdMap(closedHtml) : new Map<string, string>();
    const closedList = includeClosed ? await fetchBackhaulSpreadsheet(cookieHeader, invOrg, false) : { rows: [] as BackhaulListRow[] };

    const openRows = normalizeBackhaulRows(openList.rows, config.companyId, locationId, openIsoMap, true);
    const closedRows = includeClosed
      ? normalizeBackhaulRows(closedList.rows, config.companyId, locationId, closedIsoMap, false)
      : [];

    const allRows = [...openRows, ...closedRows];
    const rowsToUpsert = maxOrders && maxOrders > 0 ? allRows.slice(0, maxOrders) : allRows;

    if (rowsToUpsert.length) {
      const { error } = await db
        .from('backhaul_orders')
        .upsert(rowsToUpsert, { onConflict: 'iso,location_id' });

      if (error) {
        throw new Error(`Failed to upsert backhaul orders: ${error.message}`);
      }
    }

    const openIsoSet = new Set(openRows.map((row) => row.iso));
    const updatedAt = new Date().toISOString();

    if (openIsoSet.size > 0) {
      await db
        .from('backhaul_orders')
        .update({ is_open: false, updated_at: updatedAt })
        .eq('location_id', locationId)
        .eq('is_open', true)
        .not('iso', 'in', `(${Array.from(openIsoSet).map((iso) => `'${iso}'`).join(',')})`);
    } else {
      await db
        .from('backhaul_orders')
        .update({ is_open: false, updated_at: updatedAt })
        .eq('location_id', locationId)
        .eq('is_open', true);
    }

    const pickListRows: Array<ReturnType<typeof normalizePickListRows>[number]> = [];
    for (const order of rowsToUpsert) {
      const isoId = order.iso_id;
      if (!isoId) {
        log.push(`Missing iso_id for ISO ${order.iso}, skipping pick list.`);
        continue;
      }
      const pickList = await fetchPickListSpreadsheet(cookieHeader, invOrg, isoId, order.iso);
      pickListRows.push(
        ...normalizePickListRows(pickList, config.companyId, locationId, order.iso)
      );
    }

    if (pickListRows.length) {
      const { error } = await db
        .from('backhaul_order_lines')
        .upsert(pickListRows, { onConflict: 'iso,iso_line_number,location_id' });

      if (error) {
        throw new Error(`Failed to upsert backhaul lines: ${error.message}`);
      }
    }

    return {
      success: true,
      stats: {
        totalGEItems: rowsToUpsert.length,
        itemsInLoads: 0,
        unassignedItems: 0,
        newItems: 0,
        updatedItems: 0,
        forSaleLoads: 0,
        pickedLoads: 0,
        changesLogged: 0,
      },
      message: `Backhaul sync completed. Open: ${openRows.length}, Closed: ${closedRows.length}, Lines: ${pickListRows.length}`,
      duration: Date.now() - startTime,
      log,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
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
      error: message,
      duration: Date.now() - startTime,
      log: [message],
    };
  }
}
