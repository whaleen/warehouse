import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, X, Trash2, Printer, CheckCircle2, Circle } from 'lucide-react';
import { updateLoadMetadata } from '@/lib/loadManager';
import { useLoadDetail, useLoadConflicts } from '@/hooks/queries/useLoads';
import type { LoadMetadata } from '@/types/inventory';
import { decodeHTMLEntities } from '@/lib/htmlUtils';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { getActiveLocationContext } from '@/lib/tenant';
import { useLogActivity } from '@/hooks/queries/useActivity';
import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { SanityCheckDialog } from '@/components/Loads/SanityCheckDialog';

interface LoadDetailPanelProps {
  load: LoadMetadata;
  allLoads?: LoadMetadata[];
  onClose?: () => void;
  onDelete?: (load: LoadMetadata) => void;
  onMetaUpdated?: (updates: Partial<LoadMetadata>) => void;
}

export function LoadDetailPanel({
  load,
  allLoads = [],
  onClose,
  onDelete,
  onMetaUpdated,
}: LoadDetailPanelProps) {
  const { user } = useAuth();
  const userDisplayName = user?.username ?? user?.email ?? 'Unknown';
  const { locationId, companyId } = getActiveLocationContext();
  const logActivityMutation = useLogActivity();

  const { data: loadDetail, isLoading: loading } = useLoadDetail(
    load.inventory_type,
    load.sub_inventory_name
  );
  const { data: conflicts } = useLoadConflicts(
    load.inventory_type,
    load.sub_inventory_name
  );

  const otherInventoryQuery = useQuery({
    queryKey: ['load-cross-inventory', locationId ?? 'none', load.sub_inventory_name, load.inventory_type],
    enabled: !!locationId && !!load.sub_inventory_name,
    queryFn: async () => {
      if (!locationId) return [];
      const { data, error } = await supabase
        .from('inventory_items')
        .select('serial, inventory_type')
        .eq('location_id', locationId)
        .eq('sub_inventory', load.sub_inventory_name)
        .neq('inventory_type', load.inventory_type)
        .not('serial', 'is', null);

      if (error) throw error;
      return data ?? [];
    },
  });

  const otherInventoryBySerial = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of otherInventoryQuery.data ?? []) {
      if (!row.serial) continue;
      const current = map.get(row.serial) ?? new Set<string>();
      if (row.inventory_type) current.add(row.inventory_type);
      map.set(row.serial, current);
    }
    return map;
  }, [otherInventoryQuery.data]);

  const items = loadDetail?.items ?? [];
  const [searchTerm, setSearchTerm] = useState('');
  const [prepTagged, setPrepTagged] = useState(false);
  const [prepWrapped, setPrepWrapped] = useState(false);
  const [sanityCheckRequested, setSanityCheckRequested] = useState(false);
  const [sanityCompletedAt, setSanityCompletedAt] = useState<string | null>(null);
  const [sanityRequestConfirmOpen, setSanityRequestConfirmOpen] = useState(false);
  const [sanityCompleteConfirmOpen, setSanityCompleteConfirmOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [savingPrep, setSavingPrep] = useState(false);
  const [friendlyName, setFriendlyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [notes, setNotes] = useState('');
  const [isSalvage, setIsSalvage] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [savePulse, setSavePulse] = useState(false);
  const metaSaveTimeoutRef = useRef<number | null>(null);
  const COLOR_OPTIONS = [
    { label: 'Red', value: '#E53935' },
    { label: 'Red-Orange', value: '#F4511E' },
    { label: 'Orange', value: '#FB8C00' },
    { label: 'Yellow-Orange', value: '#F9A825' },
    { label: 'Yellow', value: '#FDD835' },
    { label: 'Yellow-Green', value: '#C0CA33' },
    { label: 'Green', value: '#43A047' },
    { label: 'Blue-Green', value: '#009688' },
    { label: 'Blue', value: '#1E88E5' },
    { label: 'Blue-Violet', value: '#5E35B1' },
    { label: 'Violet', value: '#8E24AA' },
    { label: 'Red-Violet', value: '#D81B60' },
  ];
  const recentWindowSize = 20;

  useEffect(() => {
    setSearchTerm('');
  }, [load.inventory_type, load.sub_inventory_name]);

  useEffect(() => {
    setPrepTagged(Boolean(load.prep_tagged));
    setPrepWrapped(Boolean(load.prep_wrapped));
    setSanityCheckRequested(Boolean(load.sanity_check_requested));
    setSanityCompletedAt(load.sanity_check_completed_at ?? null);
    setPickupDate(load.pickup_date ? load.pickup_date.slice(0, 10) : '');
    setFriendlyName(load.friendly_name || '');
    setPrimaryColor(load.primary_color || '');
    setNotes(load.notes || '');
    setIsSalvage((load.category || '').toLowerCase() === 'salvage');
    setMetaError(null);
  }, [
    load.prep_tagged,
    load.prep_wrapped,
    load.sanity_check_requested,
    load.sanity_check_completed_at,
    load.pickup_date,
    load.friendly_name,
    load.primary_color,
    load.notes,
    load.category,
  ]);

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.cso?.toLowerCase().includes(q) ||
      item.serial?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q) ||
      item.products?.brand?.toLowerCase().includes(q)
    );
  });

  const productTypeBreakdown = items.reduce((acc, item) => {
    acc[item.product_type] = (acc[item.product_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getItemStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-emerald-500';
      case 'reserved':
        return 'bg-amber-500';
      case 'not available':
        return 'bg-red-500';
      case 'picked':
        return 'bg-blue-500';
      case 'shipped':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };


  const displayName = load.friendly_name || load.sub_inventory_name;

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const normalizeHexColor = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed) || /^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  };

  const persistPrepUpdate = async (
    updates: {
      prep_tagged?: boolean;
      prep_wrapped?: boolean;
      sanity_check_requested?: boolean;
      sanity_check_requested_at?: string | null;
      sanity_check_requested_by?: string | null;
      sanity_check_completed_at?: string | null;
      sanity_check_completed_by?: string | null;
      pickup_date?: string | null;
      pickup_tba?: boolean;
    },
    options?: { skipActivityLog?: boolean }
  ) => {
    setSavingPrep(true);
    const { success, error } = await updateLoadMetadata(
      load.inventory_type,
      load.sub_inventory_name,
      updates
    );
    if (!success) {
      toast.error('Failed to update load', {
        description: error?.message || 'Unable to save prep details.',
      });
    } else {
      onMetaUpdated?.(updates);
      triggerSavePulse();
      // Always try to log activity (unless explicitly skipped)
      if (!options?.skipActivityLog) {
        if (!locationId) {
          console.error('Cannot log activity: missing locationId');
        } else if (!user) {
          console.error('Cannot log activity: user not authenticated');
        } else {
          try {
            await logActivityMutation.mutateAsync({
              companyId: companyId || locationId, // Use locationId as fallback
              locationId,
              user,
              action: 'load_update',
              entityType: 'ASIS_LOAD',
              entityId: load.sub_inventory_name,
              details: {
                loadNumber: load.sub_inventory_name,
                friendlyName: load.friendly_name ?? null,
                fields: Object.keys(updates),
                updates,
              },
            });
          } catch (activityError) {
            console.error('Failed to log activity (load_update):', activityError);
          }
        }
      }
    }
    setSavingPrep(false);
    return success;
  };

  const triggerSavePulse = useCallback(() => {
    setSavePulse(true);
    window.setTimeout(() => setSavePulse(false), 1200);
  }, []);

  const deriveFriendlyNameFromNotes = (notes?: string | null, status?: string | null) => {
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
  };

  const parseLoadTimestamp = (value?: string | null) => {
    if (!value) return 0;
    const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second ?? '0')
      );
      return date.getTime();
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const normalizeFriendlyCode = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return null;
    // Only validate 1-2 letter codes for duplicate detection
    // Allow other formats (numbers, dates, etc.) to pass through
    if (!/^[A-Z]{1,2}$/.test(trimmed)) return null;
    return trimmed;
  };

  const recentCodes = (() => {
    if (!allLoads.length) return new Set<string>();
    const sorted = [...allLoads]
      .filter((entry) => entry.inventory_type === load.inventory_type)
      .sort((a, b) => {
        const aTime = parseLoadTimestamp(a.ge_scanned_at) || (a.created_at ? Date.parse(a.created_at) : 0);
        const bTime = parseLoadTimestamp(b.ge_scanned_at) || (b.created_at ? Date.parse(b.created_at) : 0);
        return bTime - aTime;
      })
      .slice(0, recentWindowSize);

    const codes = new Set<string>();
    sorted.forEach((entry) => {
      const direct = normalizeFriendlyCode(entry.friendly_name);
      const derived = direct ?? normalizeFriendlyCode(deriveFriendlyNameFromNotes(entry.ge_notes, entry.ge_source_status));
      if (derived) {
        codes.add(derived);
      }
    });
    return codes;
  })();

  const normalizedFriendlyInput = normalizeFriendlyCode(friendlyName);
  const originalFriendly = (load.friendly_name ?? '').trim().toUpperCase();
  const currentFriendly = friendlyName.trim().toUpperCase();
  const friendlyNameError = (() => {
    if (load.inventory_type !== 'ASIS') return null;
    if (!currentFriendly) return null;
    if (currentFriendly === originalFriendly) return null;

    // Only check for duplicates if it matches the letter-code format (1-2 letters)
    // Allow other formats like "6", "1/2", "2nd" without validation
    if (normalizedFriendlyInput) {
      if (normalizedFriendlyInput === normalizeFriendlyCode(load.friendly_name)) return null;
      if (recentCodes.has(normalizedFriendlyInput)) {
        return `Code "${normalizedFriendlyInput}" already used in the last ${recentWindowSize} loads.`;
      }
    }

    return null;
  })();


  const hasMetaChanges = (() => {
    const friendly = friendlyName.trim().toUpperCase();
    const notesValue = notes.trim();
    const colorValue = primaryColor.trim();
    const categoryValue = load.inventory_type === 'ASIS' ? (isSalvage ? 'Salvage' : '') : (load.category || '');

    return (
      friendly !== (load.friendly_name || '') ||
      notesValue !== (load.notes || '') ||
      colorValue !== (load.primary_color || '') ||
      categoryValue !== (load.category || '')
    );
  })();

  const loadDetailRows = useMemo(
    () =>
      [
        ['ID', load.id],
        ['Company ID', load.company_id],
        ['Location ID', load.location_id],
        ['Inventory Type', load.inventory_type],
        ['Load Number', load.sub_inventory_name],
        ['Friendly Name', load.friendly_name],
        ['Status', load.status],
        ['Category', load.category],
        ['Primary Color', load.primary_color],
        ['Prep Tagged', load.prep_tagged],
        ['Prep Wrapped', load.prep_wrapped],
        ['Sanity Check Requested', load.sanity_check_requested],
        ['Sanity Requested At', load.sanity_check_requested_at],
        ['Sanity Requested By', load.sanity_check_requested_by],
        ['Sanity Completed At', load.sanity_check_completed_at],
        ['Sanity Completed By', load.sanity_check_completed_by],
        ['Pickup Date', load.pickup_date],
        ['Pickup TBA', load.pickup_tba],
        ['GE Source Status', load.ge_source_status],
        ['GE CSO Status', load.ge_cso_status],
        ['GE Inv Org', load.ge_inv_org],
        ['GE Units', load.ge_units],
        ['GE Submitted Date', load.ge_submitted_date],
        ['GE CSO', load.ge_cso],
        ['GE Pricing', load.ge_pricing],
        ['GE Notes', load.ge_notes],
        ['GE Scanned At', load.ge_scanned_at],
        ['Created At', load.created_at],
        ['Updated At', load.updated_at],
        ['Created By', load.created_by],
        ['Notes', load.notes],
      ] as Array<[string, string | number | boolean | null | undefined]>,
    [load]
  );

  const handleSaveMeta = useCallback(async () => {
    if (!hasMetaChanges) {
      setMetaError('No changes to save.');
      return;
    }
    if (friendlyNameError) {
      setMetaError(friendlyNameError);
      return;
    }

    setSavingMeta(true);
    setMetaError(null);

    const friendly = friendlyName.trim();
    const notesValue = notes.trim();
    const colorValue = primaryColor.trim();

    const updates: {
      friendly_name?: string | null;
      primary_color?: string | null;
      notes?: string | null;
      category?: string | null;
    } = {
      friendly_name: friendly ? friendly : null,
      primary_color: colorValue ? colorValue : null,
      notes: notesValue ? notesValue : null,
    };

    if (load.inventory_type === 'ASIS') {
      updates.category = isSalvage ? 'Salvage' : null;
    }

    const { success, error } = await updateLoadMetadata(
      load.inventory_type,
      load.sub_inventory_name,
      updates
    );

    if (!success) {
      setMetaError(error?.message || 'Unable to save load details.');
    } else {
      onMetaUpdated?.(updates);
      triggerSavePulse();

      // Always try to log activity
      if (!locationId) {
        console.error('Cannot log activity: missing locationId');
      } else if (!user) {
        console.error('Cannot log activity: user not authenticated');
      } else {
        try {
          await logActivityMutation.mutateAsync({
            companyId: companyId || locationId, // Use locationId as fallback
            locationId,
            user,
            action: 'load_update',
            entityType: 'ASIS_LOAD',
            entityId: load.sub_inventory_name,
            details: {
              loadNumber: load.sub_inventory_name,
              friendlyName: friendly || load.friendly_name || null,
              fields: Object.keys(updates),
              updates,
            },
          });
        } catch (activityError) {
          console.error('Failed to log activity (load_update):', activityError);
        }
      }
    }

    setSavingMeta(false);
  }, [
    companyId,
    friendlyName,
    friendlyNameError,
    hasMetaChanges,
    isSalvage,
    load.friendly_name,
    load.inventory_type,
    load.sub_inventory_name,
    locationId,
    logActivityMutation,
    notes,
    onMetaUpdated,
    primaryColor,
    triggerSavePulse,
    user,
  ]);

  useEffect(() => {
    if (!hasMetaChanges || savingMeta || friendlyNameError) return;
    if (metaSaveTimeoutRef.current) {
      window.clearTimeout(metaSaveTimeoutRef.current);
    }
    setMetaError(friendlyNameError ?? null);
    metaSaveTimeoutRef.current = window.setTimeout(() => {
      handleSaveMeta();
    }, 800);

    return () => {
      if (metaSaveTimeoutRef.current) {
        window.clearTimeout(metaSaveTimeoutRef.current);
      }
    };
  }, [friendlyName, notes, primaryColor, isSalvage, hasMetaChanges, savingMeta, friendlyNameError, handleSaveMeta]);

  const deriveCsoFromLoadNumber = (value: string) => {
    if (!value) return '';
    let result = value.trim();
    if (result.startsWith('9SU')) {
      result = result.slice(3);
    }
    if (result.startsWith('2025') || result.startsWith('2026')) {
      result = result.slice(4);
    }
    return result;
  };

  const isSyntheticSerial = (serial?: string | null) => {
    if (!serial) return false;
    return serial.startsWith('ASIS-NS:') || serial.startsWith('ASIS-INV-NS:');
  };

  const renderBarcodeSvg = (value: string) => {
    if (!value) return '';
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svg, value, {
        format: 'CODE128',
        displayValue: false,
        height: 50,
        margin: 0,
        width: 2,
      });
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      return svg.outerHTML;
    } catch {
      return '';
    }
  };

  const handleTaggedChange = (checked: boolean | 'indeterminate') => {
    const nextValue = checked === true;
    setPrepTagged(nextValue);
    persistPrepUpdate({ prep_tagged: nextValue });
  };

  const handleWrappedChange = (checked: boolean | 'indeterminate') => {
    const nextValue = checked === true;
    setPrepWrapped(nextValue);
    persistPrepUpdate({ prep_wrapped: nextValue });
  };

  const handlePickupDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setPickupDate(nextValue);
    persistPrepUpdate({
      pickup_date: nextValue ? nextValue : null,
    });
  };

  const handlePrintTags = () => {
    if (!items.length) {
      toast.error('No items to print', {
        description: 'This load has no items yet.',
      });
      return;
    }

    const sortedItems = [...items].sort((a, b) => {
      const modelCompare = (a.model || '').localeCompare(b.model || '');
      if (modelCompare !== 0) return modelCompare;
      return (a.serial || '').localeCompare(b.serial || '');
    });

    const tagColor = normalizeHexColor(load.primary_color);
    const csoValue = (load.ge_cso || '').trim() || deriveCsoFromLoadNumber(load.sub_inventory_name);
    const csoHead = csoValue.length > 4 ? csoValue.slice(0, -4) : '';
    const csoTail = csoValue.length > 4 ? csoValue.slice(-4) : csoValue;

    const tags = sortedItems.map((item, index) => {
      const model = item.model || '';
      const serial = isSyntheticSerial(item.serial) ? '' : item.serial || '';
      const modelBarcode = renderBarcodeSvg(model);
      const serialBarcode = isSyntheticSerial(serial) ? '' : renderBarcodeSvg(serial);
      return {
        index: index + 1,
        model,
        serial,
        modelBarcode,
        serialBarcode,
      };
    });

    const pages = [];
    for (let i = 0; i < tags.length; i += 2) {
      pages.push([tags[i], tags[i + 1] || null]);
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Load Tags - ${escapeHtml(displayName)}</title>
          <style>
            @page { size: letter landscape; margin: 0.35in; }
            * { box-sizing: border-box; }
            html, body { height: 100%; }
            body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #111; }
            .page { width: 100%; height: calc(8.5in - 0.7in); display: grid; grid-template-columns: 1fr 1fr; gap: 1in; page-break-after: always; position: relative; padding: 0; }
            .page::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 2px dotted #e2e2e2; pointer-events: none; }
            .page:last-child { page-break-after: auto; }
            .tag { border: none; padding: 0.3in 0.6in; display: flex; flex-direction: column; justify-content: space-between; height: 100%; }
            .tag.empty { border: none; }
            .tag-top { display: flex; flex-direction: column; gap: 0.25in; }
            .cso-row { display: flex; align-items: center; gap: 0.25in; }
            .color-square { width: 1in; height: 1in; background: ${tagColor ?? 'transparent'}; flex-shrink: 0; }
            .model-content { min-width: 0; }
            .serial-row { display: flex; flex-direction: column; gap: 0.05in; }
            .color-square.empty { background: transparent; }
            .label { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .value { font-size: 20px; font-weight: 700; word-break: break-word; }
            .cso-value { font-size: 44px; font-weight: 700; letter-spacing: 0.04em; }
            .cso-emphasis { font-weight: 800; text-decoration: underline; }
            .barcode { margin-top: 0.1in; display: flex; justify-content: flex-start; align-items: flex-start; text-align: left; }
            .barcode svg { width: auto; max-width: 100%; height: 60px; display: block; margin: 0; }
            .tag-bottom { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 160px; font-weight: 800; }
          </style>
        </head>
        <body>
          ${pages
            .map(
              (pair) => `
                <div class="page">
                  ${pair
                    .map((tag) => {
                      if (!tag) {
                        return '<div class="tag empty"></div>';
                      }
                      return `
                        <div class="tag">
                          <div class="tag-top">
                            <div class="cso-row">
                              <div class="color-square${tagColor ? '' : ' empty'}"></div>
                              <div class="cso-block">
                                <div class="label">CSO</div>
                                <div class="cso-value">${escapeHtml(csoHead)}<span class="cso-emphasis">${escapeHtml(csoTail)}</span></div>
                              </div>
                            </div>
                            <div class="model-content">
                              <div class="label">Model</div>
                              <div class="value">${escapeHtml(tag.model)}</div>
                            </div>
                            <div class="barcode model-barcode">${tag.modelBarcode}</div>
                            <div class="serial-row">
                              <div class="label">Serial</div>
                              <div class="value">${escapeHtml(tag.serial || '—')}</div>
                            </div>
                            ${tag.serial ? `<div class="barcode serial-barcode">${tag.serialBarcode}</div>` : ''}
                          </div>
                          <div class="tag-bottom">${tag.index}</div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              `
            )
            .join('')}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked', {
        description: 'Allow pop-ups to open the print view.',
      });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <>
      <div className="rounded-lg border bg-background p-4 space-y-4">
        {/* Simplified Header */}
        <div className="flex items-start gap-3">
          {onClose && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Close load details"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {primaryColor && (
                <span
                  className="size-8 rounded-md flex-shrink-0 shadow-sm border border-border"
                  style={{ backgroundColor: primaryColor }}
                  aria-hidden="true"
                />
              )}
              <h2 className="text-lg font-semibold">{displayName}</h2>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {load.ge_cso ? `CSO ${load.ge_cso}` : `Load # ${load.sub_inventory_name}`}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="progress" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="progress">Work Progress</TabsTrigger>
            <TabsTrigger value="editor">Load Editor</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Work Progress Tab */}
          <TabsContent value="progress" className="space-y-4 mt-4">
            {/* Prep Checklist */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              {savingPrep && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Saving</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm">
                  <Checkbox checked={prepTagged} onCheckedChange={handleTaggedChange} disabled={savingPrep} />
                  Tagged
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm">
                  <Checkbox checked={prepWrapped} onCheckedChange={handleWrappedChange} disabled={savingPrep} />
                  Wrapped
                </label>

                {/* Scanning Progress */}
                {load.items_total_count ? (
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                    load.scanning_complete
                      ? 'border-green-500/50 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                      : 'border-border bg-background text-muted-foreground'
                  }`}>
                    {load.scanning_complete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                    <span>
                      Scanned: {load.items_scanned_count || 0}/{load.items_total_count}
                      {load.items_total_count > 0 && (
                        <span className="ml-1 text-xs">
                          ({Math.round(((load.items_scanned_count || 0) / load.items_total_count) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  variant={sanityCheckRequested ? 'outline' : 'default'}
                  onClick={() =>
                    sanityCheckRequested
                      ? setSanityCompleteConfirmOpen(true)
                      : setSanityRequestConfirmOpen(true)
                  }
                  disabled={savingPrep}
                  className="h-8"
                >
                  {sanityCheckRequested
                    ? 'Sanity: Requested'
                    : sanityCompletedAt
                    ? 'Sanity: Complete'
                    : 'Sanity: Request'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Pickup</span>
                <Input
                  type="date"
                  value={pickupDate}
                  onChange={handlePickupDateChange}
                  disabled={savingPrep}
                  className="w-[150px]"
                />
              </div>
            </div>

            {/* Conflicts */}
            {conflicts && conflicts.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <div className="font-semibold text-destructive">
                  {conflicts.length} serial conflict{conflicts.length === 1 ? '' : 's'}
                </div>
                <p className="text-muted-foreground">
                  These serials also appear in another load.
                </p>
                <div className="mt-2 space-y-1">
                  {conflicts.slice(0, 6).map(conflict => (
                    <div key={conflict.id ?? `${conflict.serial}-${conflict.load_number}`}>
                      <span className="font-medium">{conflict.serial}</span> already in{' '}
                      <span className="font-medium">{conflict.conflicting_load}</span>
                    </div>
                  ))}
                  {conflicts.length > 6 && (
                    <div className="text-xs text-muted-foreground">
                      +{conflicts.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="flex flex-wrap items-center gap-2 border-b pb-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Items list */}
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No items found
                </div>
              ) : (
                filteredItems.map((item) => {
                  const syntheticSerial = isSyntheticSerial(item.serial);
                  const normalizedItem =
                    item.products?.description
                      ? {
                          ...item,
                          products: {
                            ...item.products,
                            description: decodeHTMLEntities(item.products.description)
                          }
                        }
                      : item;

                  const statusValue = item.ge_availability_status?.trim() || '';
                  const statusBadge = statusValue ? (
                    <Badge className={getItemStatusColor(statusValue)}>
                      {statusValue}
                    </Badge>
                  ) : null;

                  const badges = (
                    <>
                      {statusBadge}
                      {syntheticSerial && (
                        <Badge variant="outline">No serial</Badge>
                      )}
                      {item.serial && otherInventoryBySerial.has(item.serial) && (
                        <Badge variant="secondary">
                          Also in {Array.from(otherInventoryBySerial.get(item.serial) ?? []).join(', ')}
                        </Badge>
                      )}
                    </>
                  );

                  return (
                    <InventoryItemCard
                      key={item.id}
                      item={normalizedItem}
                      badges={badges}
                    />
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Load Editor Tab */}
          <TabsContent value="editor" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/20 p-3 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Load metadata</p>
                  <p className="text-xs text-muted-foreground">Edit load name, color, and category.</p>
                </div>
                <Button
                  type="button"
                  size="responsive"
                  variant="outline"
                  onClick={handleSaveMeta}
                  disabled={savingMeta || !hasMetaChanges || Boolean(friendlyNameError)}
                  className={savePulse ? 'animate-pulse' : undefined}
                >
                  {savingMeta && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {savingMeta ? 'Saving...' : savePulse && !savingMeta ? 'Saved' : 'Save changes'}
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground/70">Friendly name</label>
                  <Input
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    placeholder="e.g., A, 6, 1/2, 2nd"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground/70">Notes</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes for this load"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground/70">Primary color</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={primaryColor ? 'outline' : 'default'}
                      size="sm"
                      className="h-9"
                      onClick={() => setPrimaryColor('')}
                    >
                      No color
                    </Button>
                    {COLOR_OPTIONS.map((option) => {
                      const isSelected = primaryColor === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPrimaryColor(option.value)}
                          className={`h-9 w-9 rounded-md border ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border'} flex items-center justify-center`}
                          aria-label={option.label}
                          title={`${option.label} (${option.value})`}
                        >
                          <span
                            className="size-6 rounded-sm border border-border"
                            style={{ backgroundColor: option.value }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {load.inventory_type === 'ASIS' && (
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-muted-foreground/70">Salvage</label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={isSalvage} onCheckedChange={(checked) => setIsSalvage(checked === true)} />
                      Mark this load as salvage
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Unchecked loads are treated as regular.
                    </p>
                  </div>
                )}
              </div>

              {metaError && (
                <div className="text-sm text-destructive">{metaError}</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="text-sm font-medium mb-3">Load data</div>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground">Product Types</div>
                <div className="mt-2 grid gap-1 text-sm">
                  {Object.entries(productTypeBreakdown).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="font-medium">{type}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {loadDetailRows.map(([label, value]) => (
                  <div key={label} className="space-y-1">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium break-words">
                      {value === null || value === undefined ? '—' : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="responsive"
            variant="outline"
            onClick={handlePrintTags}
          >
            <Printer className="h-4 w-4" />
            Print tags
          </Button>
          <Button
            type="button"
            size="responsive"
            variant="destructive"
            onClick={() => onDelete?.(load)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <SanityCheckDialog
        load={load}
        open={sanityRequestConfirmOpen}
        onClose={() => setSanityRequestConfirmOpen(false)}
        onSuccess={() => {
          // Notify parent that metadata changed
          const now = new Date().toISOString();
          onMetaUpdated?.({
            sanity_check_requested: true,
            sanity_check_requested_at: now,
            sanity_check_requested_by: userDisplayName,
          });
          // Update local state will happen via useEffect when load prop updates
          triggerSavePulse();
        }}
        mode="request"
      />

      <SanityCheckDialog
        load={load}
        open={sanityCompleteConfirmOpen}
        onClose={() => setSanityCompleteConfirmOpen(false)}
        onSuccess={() => {
          // Notify parent that metadata changed
          const now = new Date().toISOString();
          onMetaUpdated?.({
            sanity_check_requested: false,
            sanity_check_completed_at: now,
            sanity_check_completed_by: userDisplayName,
          });
          // Update local state will happen via useEffect when load prop updates
          triggerSavePulse();
        }}
        mode="complete"
      />
    </>
  );
}
