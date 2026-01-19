import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Upload, ArrowLeft } from 'lucide-react';
import { getAllLoads, getLoadItemCount, getLoadConflictCount, deleteLoad } from '@/lib/loadManager';
import type { LoadMetadata, InventoryItem } from '@/types/inventory';
import { RenameLoadDialog } from './RenameLoadDialog';
import { LoadDetailPanel } from './LoadDetailPanel';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { PageContainer } from '@/components/Layout/PageContainer';
import supabase from '@/lib/supabase';
import { fetchAsisCsvRows, fetchAsisXlsRows } from '@/lib/asisImport';
import { getActiveLocationContext } from '@/lib/tenant';
import type { AppView } from '@/lib/routes';

interface LoadWithCount extends LoadMetadata {
  item_count: number;
  conflict_count: number;
}

type AsisLoadRow = {
  'Load Number': string;
  Units: string | number;
  Notes?: string;
  'Scanned Date/Time'?: string;
  Status?: string;
};

type AsisReportHistoryRow = {
  'Inv Org'?: string;
  'Load Number': string;
  'Submitted Date'?: string;
  CSO?: string | number;
  Status?: string;
  Pricing?: string;
  'CSO Status'?: string;
  Units?: string | number;
};

type AsisLoadItemRow = {
  ORDC: string;
  MODELS: string;
  SERIALS: string;
  QTY: string | number;
  'LOAD NUMBER': string;
};

type GeLoadSource = 'ASISLoadData' | 'ASISReportHistoryData';

type NormalizedAsisLoad = {
  loadNumber: string;
  source: GeLoadSource;
  // GE fields
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


const IMPORT_BATCH_SIZE = 500;

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const parseAsisTimestamp = (value: string) => {
  if (!value) return 0;
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
};

interface LoadManagementViewProps {
  onViewChange: (view: AppView) => void;
  onMenuClick?: () => void;
}

export function LoadManagementView({ onViewChange, onMenuClick }: LoadManagementViewProps) {
  const { locationId, companyId } = getActiveLocationContext();
  const { toast } = useToast();
  const [loads, setLoads] = useState<LoadWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingLoads, setImportingLoads] = useState(false);

  // Filter state
  type LoadFilter = 'all' | 'for_sale' | 'picked' | 'shipped' | 'delivered';
  const [loadFilter, setLoadFilter] = useState<LoadFilter>('all');

  // Dialog states
  const [selectedLoadForDetail, setSelectedLoadForDetail] = useState<LoadMetadata | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedLoadForRename, setSelectedLoadForRename] = useState<LoadMetadata | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadPendingDelete, setLoadPendingDelete] = useState<LoadMetadata | null>(null);

  const buildProductLookup = useCallback(async (models: string[]) => {
    const uniqueModels = Array.from(new Set(models.map(model => model.trim()).filter(Boolean)));
    const lookup = new Map<string, { id?: string; product_type?: string }>();
    for (const chunk of chunkArray(uniqueModels, 500)) {
      const { data, error } = await supabase
        .from('products')
        .select('id, model, product_type')
        .in('model', chunk);
      if (error) throw error;
      (data ?? []).forEach(product => {
        lookup.set(product.model, { id: product.id, product_type: product.product_type });
      });
    }
    return lookup;
  }, []);

  const fetchLoads = async () => {
    setLoading(true);
    const { data, error } = await getAllLoads();

    if (!error && data) {
      // Fetch item counts for each load
      const loadsWithCounts = await Promise.all(
        data.map(async (load) => {
          const [{ count: itemCount }, { count: conflictCount }] = await Promise.all([
            getLoadItemCount(load.inventory_type, load.sub_inventory_name),
            getLoadConflictCount(load.inventory_type, load.sub_inventory_name),
          ]);
          return { ...load, item_count: itemCount, conflict_count: conflictCount };
        })
      );
      setLoads(loadsWithCounts);
    }

    setLoading(false);
  };

  const handleImportLoads = async () => {
    if (importingLoads) return;
    setImportingLoads(true);
  
    try {
      // 1) Read both top-level CSVs (snapshot files in public/ASIS)
      const [loadListRows, reportHistoryRows] = await Promise.all([
        fetchAsisCsvRows<AsisLoadRow>('ASISLoadData.csv'),
        fetchAsisCsvRows<AsisReportHistoryRow>('ASISReportHistoryData.csv'),
      ]);
  
      const normalizeUnits = (value: string | number | undefined) => {
        const n = typeof value === 'number' ? value : parseInt(String(value ?? '').trim(), 10);
        return Number.isFinite(n) ? n : 0;
      };
  
      const normalizedFromLoadList: NormalizedAsisLoad[] = (loadListRows ?? [])
        .map((row) => {
          const loadNumber = String(row['Load Number'] ?? '').trim();
          if (!loadNumber) return null;
          return {
            loadNumber,
            source: 'ASISLoadData',
            ge_source_status: String(row.Status ?? '').trim(),
            ge_cso_status: '', // ASISLoadData doesn't have CSO Status
            ge_inv_org: '', // ASISLoadData doesn't have Inv Org
            ge_units: normalizeUnits(row.Units),
            ge_submitted_date: '', // ASISLoadData doesn't have Submitted Date
            ge_cso: '', // ASISLoadData doesn't have CSO
            ge_pricing: '', // ASISLoadData doesn't have Pricing
            ge_notes: String(row.Notes ?? '').trim(),
            ge_scanned_at: String(row['Scanned Date/Time'] ?? '').trim(),
          } satisfies NormalizedAsisLoad;
        })
        .filter(Boolean) as NormalizedAsisLoad[];

      const normalizedFromHistory: NormalizedAsisLoad[] = (reportHistoryRows ?? [])
        .map((row) => {
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
            ge_notes: '', // ASISReportHistoryData doesn't have Notes
            ge_scanned_at: '', // ASISReportHistoryData doesn't have Scanned Date/Time
          } satisfies NormalizedAsisLoad;
        })
        .filter(Boolean) as NormalizedAsisLoad[];
  
      // Combine both datasets (we intentionally allow duplicates here)
      const normalizedLoads: NormalizedAsisLoad[] = [...normalizedFromLoadList, ...normalizedFromHistory];
  
      if (!normalizedLoads.length) {
        toast({
          title: 'No ASIS loads found',
          message: 'ASISLoadData.csv and ASISReportHistoryData.csv did not return any rows.',
        });
        return;
      }
  
      // Useful sets
      const loadNumbersAll = normalizedLoads.map((l) => l.loadNumber);
      const uniqueLoadNumbers = Array.from(new Set(loadNumbersAll));
  
      // 2) Fetch existing load_metadata for these load numbers (unique)
      let existingLoadNumbers = new Set<string>();
      type ExistingLoadData = {
        notes?: string | null;
        category?: string | null;
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
      const existingLoadMap = new Map<string, ExistingLoadData>();

      if (uniqueLoadNumbers.length) {
        const { data, error } = await supabase
          .from('load_metadata')
          .select('sub_inventory_name, notes, category, ge_source_status, ge_cso_status, ge_inv_org, ge_units, ge_submitted_date, ge_cso, ge_pricing, ge_notes, ge_scanned_at')
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('sub_inventory_name', uniqueLoadNumbers);

        if (error) throw error;

        existingLoadNumbers = new Set((data ?? []).map((load) => load.sub_inventory_name));
        (data ?? []).forEach((load) => {
          existingLoadMap.set(load.sub_inventory_name, {
            notes: load.notes,
            category: load.category,
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
      }

      // 3) Insert load_metadata for new loads (unique by loadNumber)
      // Merge data from both sources: ASISLoadData has ge_notes/ge_scanned_at, ASISReportHistoryData has other GE fields
      const bestByLoadNumber = new Map<string, NormalizedAsisLoad>();
      // Store fields that come from ASISReportHistoryData (the richer source)
      const historyDataByLoadNumber = new Map<string, NormalizedAsisLoad>();

      for (const l of normalizedLoads) {
        // Capture data from history source (has more GE fields)
        if (l.source === 'ASISReportHistoryData') {
          historyDataByLoadNumber.set(l.loadNumber, l);
        }

        const existing = bestByLoadNumber.get(l.loadNumber);
        if (!existing) {
          bestByLoadNumber.set(l.loadNumber, l);
          continue;
        }
        // Prefer ASISLoadData over history for ge_notes/ge_scanned_at
        if (existing.source !== 'ASISLoadData' && l.source === 'ASISLoadData') {
          bestByLoadNumber.set(l.loadNumber, l);
        }
      }

      // Helper to merge data from both sources
      const getMergedLoadData = (loadNumber: string) => {
        const loadData = bestByLoadNumber.get(loadNumber);
        const historyData = historyDataByLoadNumber.get(loadNumber);
        if (!loadData) return null;

        return {
          loadNumber,
          // From ASISLoadData (preferred for notes/scanned_at)
          ge_notes: loadData.ge_notes || historyData?.ge_notes || null,
          ge_scanned_at: loadData.ge_scanned_at || historyData?.ge_scanned_at || null,
          // From ASISReportHistoryData (preferred for other fields)
          ge_source_status: historyData?.ge_source_status || loadData.ge_source_status || null,
          ge_cso_status: historyData?.ge_cso_status || null,
          ge_inv_org: historyData?.ge_inv_org || null,
          ge_units: historyData?.ge_units ?? loadData.ge_units ?? null,
          ge_submitted_date: historyData?.ge_submitted_date || null,
          ge_cso: historyData?.ge_cso || null,
          ge_pricing: historyData?.ge_pricing || null,
        };
      };

      const newLoads = Array.from(bestByLoadNumber.keys())
        .filter((loadNumber) => !existingLoadNumbers.has(loadNumber))
        .map((loadNumber) => {
          const merged = getMergedLoadData(loadNumber)!;
          return {
            company_id: companyId,
            location_id: locationId,
            inventory_type: 'ASIS',
            sub_inventory_name: loadNumber,
            status: 'active',
            // All GE fields
            ge_source_status: merged.ge_source_status,
            ge_cso_status: merged.ge_cso_status,
            ge_inv_org: merged.ge_inv_org,
            ge_units: merged.ge_units,
            ge_submitted_date: merged.ge_submitted_date,
            ge_cso: merged.ge_cso,
            ge_pricing: merged.ge_pricing,
            ge_notes: merged.ge_notes,
            ge_scanned_at: merged.ge_scanned_at,
          };
        });
  
      if (newLoads.length) {
        const { error } = await supabase.from('load_metadata').insert(newLoads);
        if (error) throw error;
      }
  
      // 4) Update existing load_metadata with all GE fields
      let updatedLoadsCount = 0;

      if (existingLoadNumbers.size > 0) {
        for (const loadNumber of existingLoadNumbers) {
          const merged = getMergedLoadData(loadNumber);
          if (!merged) continue;

          const existing = existingLoadMap.get(loadNumber);
          const updates: Record<string, string | number | null> = {};

          // Update all GE fields if they've changed
          if (merged.ge_source_status && merged.ge_source_status !== existing?.ge_source_status) {
            updates.ge_source_status = merged.ge_source_status;
          }
          if (merged.ge_cso_status && merged.ge_cso_status !== existing?.ge_cso_status) {
            updates.ge_cso_status = merged.ge_cso_status;
          }
          if (merged.ge_inv_org && merged.ge_inv_org !== existing?.ge_inv_org) {
            updates.ge_inv_org = merged.ge_inv_org;
          }
          if (merged.ge_units != null && merged.ge_units !== existing?.ge_units) {
            updates.ge_units = merged.ge_units;
          }
          if (merged.ge_submitted_date && merged.ge_submitted_date !== existing?.ge_submitted_date) {
            updates.ge_submitted_date = merged.ge_submitted_date;
          }
          if (merged.ge_cso && merged.ge_cso !== existing?.ge_cso) {
            updates.ge_cso = merged.ge_cso;
          }
          if (merged.ge_pricing && merged.ge_pricing !== existing?.ge_pricing) {
            updates.ge_pricing = merged.ge_pricing;
          }
          if (merged.ge_notes && merged.ge_notes !== existing?.ge_notes) {
            updates.ge_notes = merged.ge_notes;
          }
          if (merged.ge_scanned_at && merged.ge_scanned_at !== existing?.ge_scanned_at) {
            updates.ge_scanned_at = merged.ge_scanned_at;
          }

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('load_metadata')
              .update({ ...updates, updated_at: new Date().toISOString() })
              .eq('location_id', locationId)
              .eq('inventory_type', 'ASIS')
              .eq('sub_inventory_name', loadNumber);

            if (updateError) throw updateError;
            updatedLoadsCount += 1;
          }
        }
      }
  
      // 5) Unassign inventory items currently pointing at any of these loads (unique)
      if (uniqueLoadNumbers.length) {
        const { error: unassignError } = await supabase
          .from('inventory_items')
          .update({ sub_inventory: null, updated_at: new Date().toISOString() })
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('sub_inventory', uniqueLoadNumbers);
  
        if (unassignError) throw unassignError;
      }
  
      // 6) Load all per-load CSVs (from the new folder structure)
      const loadItemRows: Array<{ row: AsisLoadItemRow; load: NormalizedAsisLoad }> = [];
      const loadErrors: string[] = [];
  
      const loadIndexByNumber = new Map<string, number>();
      const loadTimestampByNumber = new Map<string, number>();
      normalizedLoads.forEach((load, index) => {
        loadIndexByNumber.set(load.loadNumber, index);
        loadTimestampByNumber.set(load.loadNumber, parseAsisTimestamp(load.scannedAt));
      });
  
      for (const load of normalizedLoads) {
        try {
          const candidatePaths = [
            `${load.source}/${load.loadNumber}.csv`,
            `ASISLoadData/${load.loadNumber}.csv`,
            `ASISReportHistoryData/${load.loadNumber}.csv`,
          ];
  
          let rows: AsisLoadItemRow[] | null = null;
          for (const p of candidatePaths) {
            try {
              rows = await fetchAsisCsvRows<AsisLoadItemRow>(p);
              break;
            } catch {
              // try next path
            }
          }
  
          if (!rows) {
            throw new Error('Per-load CSV not found in expected ASIS folders.');
          }
  
          rows.forEach((row) => loadItemRows.push({ row, load }));
        } catch (err) {
          loadErrors.push(`${load.loadNumber}: ${err instanceof Error ? err.message : 'Failed to load CSV.'}`);
        }
      }
  
      // 7) Build product lookup
      const loadModels = loadItemRows
        .map((item) => String(item.row.MODELS ?? '').trim())
        .filter(Boolean);

      const productLookup = await buildProductLookup(loadModels);

      // 8) Build inventory items & detect conflicts (canonical per serial)
      const asisMasterRows = await fetchAsisCsvRows<{ 'Serial #': string }>('ASIS.csv');
      const asisSerials = new Set(
        asisMasterRows.map(row => String(row['Serial #'] ?? '').trim()).filter(Boolean)
      );

      const serialCandidates = new Map<
        string,
        Array<{
          item: InventoryItem;
          loadNumber: string;
          loadIndex: number;
          loadTimestamp: number;
        }>
      >();

      const conflictRows: Array<{ serial: string; loadNumber: string; conflictingLoad: string }> = [];
      const itemsWithoutSerial: InventoryItem[] = [];

      loadItemRows.forEach(({ row, load }) => {
        const model = String(row.MODELS ?? '').trim();
        if (!model) return;
  
        const serialValue = String(row.SERIALS ?? '').trim();
        const qtyValue = typeof row.QTY === 'number' ? row.QTY : parseInt(String(row.QTY).trim(), 10);
        const ordcValue = String(row.ORDC ?? '').trim();
        const product = productLookup.get(model);
  
        const isOrphaned = !asisSerials.has(serialValue);
        const item: InventoryItem = {
          cso: ordcValue || 'ASIS',
          model,
          qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
          serial: serialValue || undefined,
          product_type: product?.product_type ?? 'UNKNOWN',
          product_fk: product?.id,
          notes: null,
          inventory_type: 'ASIS',
          sub_inventory: load.loadNumber,
          is_scanned: false,
          scanned_at: null,
          scanned_by: null,
          ge_model: model || undefined,
          ge_serial: serialValue || undefined,
          ge_inv_qty: Number.isFinite(qtyValue) ? qtyValue : undefined,
          ge_ordc: ordcValue || undefined,
          ge_orphaned: isOrphaned,
          ge_orphaned_at: isOrphaned ? new Date().toISOString() : null,
        };

        if (!serialValue) {
          itemsWithoutSerial.push(item);
          return;
        }

        const candidates = serialCandidates.get(serialValue) ?? [];
        candidates.push({
          item,
          loadNumber: load.loadNumber,
          loadIndex: loadIndexByNumber.get(load.loadNumber) ?? 0,
          loadTimestamp: loadTimestampByNumber.get(load.loadNumber) ?? 0,
        });
        serialCandidates.set(serialValue, candidates);
      });

      const canonicalItems: InventoryItem[] = [...itemsWithoutSerial];

      serialCandidates.forEach((candidates, serial) => {
        let canonical = candidates[0];

        candidates.forEach((candidate) => {
          if (candidate.loadTimestamp > canonical.loadTimestamp) {
            canonical = candidate;
            return;
          }
          if (candidate.loadTimestamp === canonical.loadTimestamp && candidate.loadIndex > canonical.loadIndex) {
            canonical = candidate;
          }
        });

        canonicalItems.push(canonical.item);

        const uniqueLoads = new Set(candidates.map((c) => c.loadNumber));
        if (uniqueLoads.size > 1) {
          candidates.forEach((candidate) => {
            if (candidate.loadNumber !== canonical.loadNumber) {
              conflictRows.push({
                serial,
                loadNumber: candidate.loadNumber,
                conflictingLoad: canonical.loadNumber,
              });
            }
          });
        }
      });

      const serialsInLoads = Array.from(serialCandidates.keys());
      const blockedSerials = new Set<string>();
      if (serialsInLoads.length > 0) {
        for (const chunk of chunkArray(serialsInLoads, 500)) {
          const { data: existingOther, error } = await supabase
            .from('inventory_items')
            .select('serial, inventory_type')
            .eq('location_id', locationId)
            .in('serial', chunk)
            .neq('inventory_type', 'ASIS');
          if (error) throw error;
          (existingOther ?? []).forEach((row) => {
            if (row.serial) {
              blockedSerials.add(row.serial);
            }
          });
        }
      }

      // Cross-type serials are blocked from ASIS but no longer logged as inventory conflicts.

      const filteredItems = canonicalItems.filter(
        (item) => !item.serial || !blockedSerials.has(item.serial)
      );

      let existingItems: any[] = [];
      if (serialsInLoads.length > 0) {
        const { data, error: existingError } = await supabase
          .from('inventory_items')
          .select('id, serial, ge_availability_status, ge_availability_message, ge_model, ge_serial, ge_inv_qty, ge_orphaned, ge_orphaned_at')
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('serial', serialsInLoads);
        if (existingError) throw existingError;
        existingItems = data ?? [];
      }

      const existingBySerial = new Map<string, any>();
      const existingIds = new Set<string>();
      (existingItems ?? []).forEach((item) => {
        if (!item.serial || !item.id) return;
        if (!existingBySerial.has(item.serial)) {
          existingBySerial.set(item.serial, item);
        }
        existingIds.add(item.id);
      });

      const matchedIds = new Set<string>();
      const payload = filteredItems.map((item) => {
        if (!item.serial) {
          return {
            ...item,
            company_id: companyId,
            location_id: locationId,
          };
        }
        const existing = existingBySerial.get(item.serial);
        if (existing?.id) {
          matchedIds.add(existing.id);
        }
        return {
          ...item,
          id: existing?.id,
          company_id: companyId,
          location_id: locationId,
          ge_availability_status: existing?.ge_availability_status ?? item.ge_availability_status,
          ge_availability_message: existing?.ge_availability_message ?? item.ge_availability_message,
          ge_model: existing?.ge_model ?? item.ge_model,
          ge_serial: existing?.ge_serial ?? item.ge_serial,
          ge_inv_qty: existing?.ge_inv_qty ?? item.ge_inv_qty,
          ge_orphaned: item.ge_orphaned ?? existing?.ge_orphaned ?? false,
          ge_orphaned_at: item.ge_orphaned_at ?? existing?.ge_orphaned_at ?? null,
          status: null,
          notes: null,
        };
      });
  
      const payloadWithId = payload.filter((item) => item.id);
      const payloadWithoutId = payload
        .filter((item) => !item.id)
        .map(({ id, ...rest }) => rest);

      for (const chunk of chunkArray(payloadWithoutId, IMPORT_BATCH_SIZE)) {
        if (chunk.length === 0) continue;
        const { error } = await supabase.from('inventory_items').insert(chunk);
        if (error) throw error;
      }

      for (const chunk of chunkArray(payloadWithId, IMPORT_BATCH_SIZE)) {
        if (chunk.length === 0) continue;
        const { error } = await supabase.from('inventory_items').upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
      }
  
      const orphanIds = Array.from(existingIds).filter((id) => !matchedIds.has(id));
      for (const chunk of chunkArray(orphanIds, IMPORT_BATCH_SIZE)) {
        if (chunk.length === 0) continue;
        const { error } = await supabase
          .from('inventory_items')
          .update({ sub_inventory: null, updated_at: new Date().toISOString() })
          .in('id', chunk);
        if (error) throw error;
      }
  
      // 10) Clear existing conflicts for these loads (unique list)
      if (uniqueLoadNumbers.length) {
        const { error } = await supabase
          .from('load_conflicts')
          .delete()
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('load_number', uniqueLoadNumbers);
  
        if (error) throw error;
      }
  
      // 11) Insert conflicts (deduplicated by load_number + serial)
      if (conflictRows.length > 0) {
        // Deduplicate conflicts - same (load_number, serial) can appear multiple times
        const conflictMap = new Map<string, typeof conflictRows[0]>();
        for (const conflict of conflictRows) {
          const key = `${conflict.loadNumber}:${conflict.serial}`;
          if (!conflictMap.has(key)) {
            conflictMap.set(key, conflict);
          }
        }

        const conflictPayload = Array.from(conflictMap.values()).map((conflict) => ({
          company_id: companyId,
          location_id: locationId,
          inventory_type: 'ASIS',
          load_number: conflict.loadNumber,
          serial: conflict.serial,
          conflicting_load: conflict.conflictingLoad,
          status: 'open',
        }));

        for (const chunk of chunkArray(conflictPayload, IMPORT_BATCH_SIZE)) {
          const { error } = await supabase
            .from('load_conflicts')
            .upsert(chunk, { onConflict: 'location_id,load_number,serial' });

          if (error) throw error;
        }
      }
  
      // 12) Toast summary
      const existingLoadsCount = bestByLoadNumber.size - newLoads.length;
      const summaryBase = [
        `Loads in files: ${normalizedLoads.length}.`,
        `Unique loads: ${bestByLoadNumber.size}.`,
        `Existing loads: ${existingLoadsCount}.`,
        `New loads: ${newLoads.length}.`,
        `Updated loads: ${updatedLoadsCount}.`,
        `Items processed: ${canonicalItems.length}.`,
      ].join(' ');
  
      const noChanges = newLoads.length === 0 && updatedLoadsCount === 0;
  
      toast({
        title: 'ASIS loads imported',
        message: noChanges ? `${summaryBase} No new load metadata from GE.` : summaryBase,
        duration: Infinity,
        dismissible: true,
      });
  
      if (conflictRows.length > 0) {
        toast({
          variant: 'error',
          title: 'Serial conflicts detected',
          message: `${conflictRows.length} conflict${conflictRows.length === 1 ? '' : 's'} logged.`,
        });
      }
  
      if (loadErrors.length) {
        toast({
          variant: 'error',
          title: 'Some load CSVs failed',
          message: `${loadErrors.length} per-load CSV file${loadErrors.length === 1 ? '' : 's'} could not be read.`,
        });
      }
  
      fetchLoads();
    } catch (err) {
      console.error('Failed to import ASIS loads:', err);
      toast({
        variant: 'error',
        title: 'Load import failed',
        message: err instanceof Error ? err.message : 'Unable to import ASIS loads.',
      });
    } finally {
      setImportingLoads(false);
    }
  };
  

  useEffect(() => {
    fetchLoads();
  }, []);

  useEffect(() => {
    if (!selectedLoadForDetail) return;
    const updated = loads.find((load) => load.id === selectedLoadForDetail.id);
    if (!updated) {
      setSelectedLoadForDetail(null);
      return;
    }
    if (updated !== selectedLoadForDetail) {
      setSelectedLoadForDetail(updated);
    }
  }, [loads, selectedLoadForDetail]);

  const normalizeGeStatus = (status?: string | null) => status?.toLowerCase().trim() ?? '';
  const isSoldStatus = (status?: string | null) => {
    const normalized = normalizeGeStatus(status);
    return normalized.includes('sold');
  };
  const formatPickupDate = (value?: string | null) => {
    if (!value) return '';
    const base = value.slice(0, 10);
    const [year, month, day] = base.split('-').map(Number);
    if (!year || !month || !day) return base;
    return new Date(year, month - 1, day).toLocaleDateString();
  };

  const handleLoadClick = (load: LoadMetadata) => {
    setSelectedLoadForDetail((prev) => (prev?.id === load.id ? null : load));
  };

  const handleRenameClick = (load: LoadMetadata) => {
    setSelectedLoadForRename(load);
    setRenameDialogOpen(true);
  };

  const handleDeleteClick = (load: LoadMetadata) => {
    setLoadPendingDelete(load);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!loadPendingDelete) return;

    const { success, error } = await deleteLoad(
      loadPendingDelete.inventory_type,
      loadPendingDelete.sub_inventory_name,
      true // clearItems - set sub_inventory to null
    );

    if (success) {
      toast({
        message: `Deleted load "${loadPendingDelete.friendly_name || loadPendingDelete.sub_inventory_name}".`,
        variant: 'success',
      });
      if (selectedLoadForDetail?.id === loadPendingDelete.id) {
        setSelectedLoadForDetail(null);
      }
      fetchLoads();
    } else {
      toast({
        message: `Failed to delete load: ${error?.message || 'Unknown error'}`,
        variant: 'error',
      });
    }

    setLoadPendingDelete(null);
  };

  const getPrepCount = (load: LoadMetadata) =>
    (load.prep_tagged ? 1 : 0) + (load.prep_wrapped ? 1 : 0);

  const isReadyForPickup = (load: LoadMetadata) =>
    isSoldStatus(load.ge_source_status) &&
    Boolean(load.prep_tagged) &&
    Boolean(load.prep_wrapped) &&
    (Boolean(load.pickup_date) || Boolean(load.pickup_tba));

  return (
    <>
      <div className="min-h-screen bg-background">
        <AppHeader
          title="Load Management"
          onMenuClick={onMenuClick}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportLoads}
                disabled={importingLoads}
              >
                {importingLoads ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import loads
              </Button>
              <Button size="sm" onClick={() => onViewChange('create-load')}>
                <Plus className="mr-2 h-4 w-4" />
                New Load
              </Button>
            </div>
          }
        />

        <PageContainer className="py-4 space-y-4 pb-24">
          {/* Filter Tabs */}
          {!loading && loads.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${selectedLoadForDetail ? 'hidden lg:flex' : ''}`}>
              {([
                { key: 'all', label: 'All' },
                { key: 'for_sale', label: 'For Sale' },
                { key: 'picked', label: 'Picked' },
                { key: 'shipped', label: 'Shipped' },
                { key: 'delivered', label: 'Delivered' },
              ] as const).map(({ key, label }) => {
                const count = loads.filter((load) => {
                  if (key === 'all') return true;
                  if (key === 'for_sale') return normalizeGeStatus(load.ge_source_status) === 'for sale';
                  return (
                    normalizeGeStatus(load.ge_source_status) === 'sold' &&
                    normalizeGeStatus(load.ge_cso_status) === key
                  );
                }).length;
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={loadFilter === key ? 'default' : 'outline'}
                    onClick={() => setLoadFilter(key)}
                    className="h-8"
                  >
                    {label}
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          )}

          {/* Load List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : loads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>No loads found</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => onViewChange('create-load')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Load
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              {/* Load List - hidden on mobile when a load is selected */}
              <div className={`space-y-2 ${selectedLoadForDetail ? 'hidden lg:block' : ''}`}>
                {loads
                  .filter((load) => {
                    if (loadFilter === 'all') return true;
                    if (loadFilter === 'for_sale') return normalizeGeStatus(load.ge_source_status) === 'for sale';
                    return (
                      normalizeGeStatus(load.ge_source_status) === 'sold' &&
                      normalizeGeStatus(load.ge_cso_status) === loadFilter
                    );
                  })
                  .map((load) => {
                  const isSold = isSoldStatus(load.ge_source_status);
                  const prepCount = getPrepCount(load);
                  const readyForPickup = isReadyForPickup(load);
                  const pickupLabel = load.pickup_tba
                    ? 'Pickup: TBA'
                    : load.pickup_date
                      ? `Pickup: ${formatPickupDate(load.pickup_date)}`
                      : '';

                  return (
                  <Card
                    key={load.id}
                    className={`p-4 transition cursor-pointer ${
                      selectedLoadForDetail?.id === load.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'hover:bg-accent/30'
                    }`}
                    onClick={() => handleLoadClick(load)}
                    role="button"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {load.primary_color && (
                            <span
                              className="h-4 w-4 rounded-sm border border-border/60"
                              style={{ backgroundColor: load.primary_color }}
                              aria-hidden="true"
                            />
                          )}
                          <h3 className="font-semibold">{load.friendly_name || load.sub_inventory_name}</h3>
                          <Badge variant="outline">{load.inventory_type}</Badge>
                          {load.category && (
                            <Badge variant="secondary">{load.category}</Badge>
                          )}
                          {load.ge_source_status && (
                            <Badge variant="outline">GE: {load.ge_source_status}</Badge>
                          )}
                          {isSold && (
                            <Badge variant="outline">Prep {prepCount}/2</Badge>
                          )}
                          {readyForPickup && (
                            <Badge className="bg-green-500 text-white">Ready for pickup</Badge>
                          )}
                          {load.conflict_count > 0 && (
                            <Badge variant="destructive">
                              {load.conflict_count} conflict{load.conflict_count === 1 ? '' : 's'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{load.item_count} items</span>
                          <span>Load # {load.sub_inventory_name}</span>
                          <span>Created {new Date(load.created_at!).toLocaleDateString()}</span>
                          {pickupLabel && <span>{pickupLabel}</span>}
                        </div>
                        {load.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{load.notes}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
                })}
              </div>

              {/* Load Detail Panel - on mobile, shown with back button when selected */}
              <div className={`min-h-[200px] ${selectedLoadForDetail ? '' : 'hidden lg:block'}`}>
                {selectedLoadForDetail ? (
                  <div className="space-y-3">
                    {/* Back button - mobile only */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="lg:hidden -ml-2"
                      onClick={() => setSelectedLoadForDetail(null)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to loads
                    </Button>
                    <LoadDetailPanel
                      load={selectedLoadForDetail}
                      onClose={() => setSelectedLoadForDetail(null)}
                      onRename={handleRenameClick}
                      onDelete={handleDeleteClick}
                      onMetaUpdated={fetchLoads}
                    />
                  </div>
                ) : (
                  <Card className="p-6 text-sm text-muted-foreground">
                    Select a load to view details.
                  </Card>
                )}
              </div>
            </div>
          )}
        </PageContainer>
      </div>

      {selectedLoadForRename && (
        <RenameLoadDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          load={selectedLoadForRename}
          onSuccess={fetchLoads}
        />
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setLoadPendingDelete(null);
        }}
        title={
          loadPendingDelete
            ? `Delete load "${loadPendingDelete.friendly_name || loadPendingDelete.sub_inventory_name}"?`
            : "Delete load?"
        }
        description={
          loadPendingDelete
            ? `This removes the load metadata but keeps all ${loadPendingDelete.inventory_type} items. Items will no longer be assigned to this load.`
            : undefined
        }
        confirmText="Delete Load"
        cancelText="Keep Load"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
