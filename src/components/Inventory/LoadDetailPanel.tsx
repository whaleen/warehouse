import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, Trash2, Printer, ChevronDown, Maximize2 } from 'lucide-react';
import { updateLoadMetadata } from '@/lib/loadManager';
import { useLoadDetail, useLoadConflicts } from '@/hooks/queries/useLoads';
import type { LoadMetadata } from '@/types/inventory';
import { decodeHTMLEntities } from '@/lib/htmlUtils';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';
import { useToast } from '@/components/ui/toast';
import JsBarcode from 'jsbarcode';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/context/AuthContext';
import { getActiveLocationContext } from '@/lib/tenant';
import { logActivity } from '@/lib/activityLog';

interface LoadDetailPanelProps {
  load: LoadMetadata;
  allLoads?: LoadMetadata[];
  onClose?: () => void;
  onDelete?: (load: LoadMetadata) => void;
  onMetaUpdated?: (updates: Partial<LoadMetadata>) => void;
  onOpenStandalone?: () => void;
}

export function LoadDetailPanel({
  load,
  allLoads = [],
  onClose,
  onDelete,
  onMetaUpdated,
  onOpenStandalone,
}: LoadDetailPanelProps) {
  const { user } = useAuth();
  const userDisplayName = user?.username ?? user?.email ?? 'Unknown';
  const { locationId, companyId } = getActiveLocationContext();
  const { toast } = useToast();

  const { data: loadDetail, isLoading: loading } = useLoadDetail(
    load.inventory_type,
    load.sub_inventory_name
  );
  const { data: conflicts } = useLoadConflicts(
    load.inventory_type,
    load.sub_inventory_name
  );

  const items = loadDetail?.items ?? [];
  const [searchTerm, setSearchTerm] = useState('');
  const [prepTagged, setPrepTagged] = useState(false);
  const [prepWrapped, setPrepWrapped] = useState(false);
  const [sanityCheckRequested, setSanityCheckRequested] = useState(false);
  const [sanityRequestedAt, setSanityRequestedAt] = useState<string | null>(null);
  const [sanityRequestedBy, setSanityRequestedBy] = useState<string | null>(null);
  const [sanityCompletedAt, setSanityCompletedAt] = useState<string | null>(null);
  const [sanityCompletedBy, setSanityCompletedBy] = useState<string | null>(null);
  const [sanityRequestConfirmOpen, setSanityRequestConfirmOpen] = useState(false);
  const [sanityCompleteConfirmOpen, setSanityCompleteConfirmOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTba, setPickupTba] = useState(false);
  const [savingPrep, setSavingPrep] = useState(false);
  const [friendlyName, setFriendlyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [notes, setNotes] = useState('');
  const [isSalvage, setIsSalvage] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [savePulse, setSavePulse] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  const colorLabel = primaryColor
    ? COLOR_OPTIONS.find((option) => option.value === primaryColor)?.label ?? primaryColor
    : 'No color';

  useEffect(() => {
    setSearchTerm('');
    setDetailsOpen(false);
  }, [load.inventory_type, load.sub_inventory_name]);

  useEffect(() => {
    setPrepTagged(Boolean(load.prep_tagged));
    setPrepWrapped(Boolean(load.prep_wrapped));
    setSanityCheckRequested(Boolean(load.sanity_check_requested));
    setSanityRequestedAt(load.sanity_check_requested_at ?? null);
    setSanityRequestedBy(load.sanity_check_requested_by ?? null);
    setSanityCompletedAt(load.sanity_check_completed_at ?? null);
    setSanityCompletedBy(load.sanity_check_completed_by ?? null);
    setPickupDate(load.pickup_date ? load.pickup_date.slice(0, 10) : '');
    setPickupTba(Boolean(load.pickup_tba));
    setFriendlyName(load.friendly_name || '');
    setPrimaryColor(load.primary_color || '');
    setNotes(load.notes || '');
    setIsSalvage((load.category || '').toLowerCase() === 'salvage');
    setMetaError(null);
  }, [
    load.prep_tagged,
    load.prep_wrapped,
    load.sanity_check_requested,
    load.sanity_check_requested_at,
    load.sanity_check_requested_by,
    load.sanity_check_completed_at,
    load.sanity_check_completed_by,
    load.pickup_date,
    load.pickup_tba,
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
      (item.products as any)?.brand?.toLowerCase().includes(q)
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

  const formatPickupDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString();
  };

  const formatSanityTimestamp = (value?: string | null) => {
    if (!value) return '';
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const createdDate = load.created_at ? new Date(load.created_at).toLocaleDateString() : null;
  const displayName = load.friendly_name || load.sub_inventory_name;
  const normalizedGeStatus = load.ge_source_status?.toLowerCase().trim() ?? '';
  const isSold = normalizedGeStatus.includes('sold');
  const prepCount = (prepTagged ? 1 : 0) + (prepWrapped ? 1 : 0);
  const pickupLabel = pickupTba
    ? 'Pickup: TBA'
    : pickupDate
      ? `Pickup: ${formatPickupDate(pickupDate)}`
      : null;
  const isReadyForPickup =
    isSold && prepTagged && prepWrapped && Boolean(pickupDate || pickupTba);

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
      toast({
        variant: 'error',
        title: 'Failed to update load',
        message: error?.message || 'Unable to save prep details.',
      });
    } else {
      onMetaUpdated?.(updates);
      triggerSavePulse();
      if (!options?.skipActivityLog) {
        const { error: activityError } = await logActivity({
          companyId,
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
        if (activityError) {
          console.warn('Failed to log activity (load_update):', activityError.message);
        }
      }
    }
    setSavingPrep(false);
    return success;
  };

  const triggerSavePulse = () => {
    setSavePulse(true);
    window.setTimeout(() => setSavePulse(false), 1200);
  };

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
    if (currentFriendly === originalFriendly && !normalizeFriendlyCode(originalFriendly)) {
      return null;
    }
    if (!normalizedFriendlyInput) return 'Use 1–2 letters only (A–Z).';
    if (normalizedFriendlyInput === normalizeFriendlyCode(load.friendly_name)) return null;
    if (recentCodes.has(normalizedFriendlyInput)) {
      return `Already used in the last ${recentWindowSize} loads.`;
    }
    return null;
  })();

  const suggestedCodes = (() => {
    if (load.inventory_type !== 'ASIS') return [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const suggestions: string[] = [];
    const used = recentCodes;

    for (const letter of alphabet) {
      if (!used.has(letter)) {
        suggestions.push(letter);
      }
      if (suggestions.length >= 8) return suggestions;
    }

    for (const first of alphabet) {
      for (const second of alphabet) {
        const code = `${first}${second}`;
        if (first === second && used.has(first)) continue;
        if (!used.has(code)) {
          suggestions.push(code);
        }
        if (suggestions.length >= 8) return suggestions;
      }
    }
    return suggestions;
  })();

  const derivedFriendlyName = deriveFriendlyNameFromNotes(load.ge_notes, load.ge_source_status);
  const derivedFriendlyCode = normalizeFriendlyCode(derivedFriendlyName);

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

  const handleSaveMeta = async () => {
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
      const { error: activityError } = await logActivity({
        companyId,
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
      if (activityError) {
        console.warn('Failed to log activity (load_update):', activityError.message);
      }
    }

    setSavingMeta(false);
  };

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
  }, [friendlyName, notes, primaryColor, isSalvage, hasMetaChanges, savingMeta, friendlyNameError]);

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

  const formatGeSubmitted = (value?: string | null) => {
    if (!value) return '';
    const trimmed = value.trim();
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
    return trimmed;
  };

  const formatGeScanned = (value?: string | null) => {
    if (!value) return '';
    const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return value;
    const [, year, month, day, hour, minute, second] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toLocaleString();
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

  const requestSanityCheck = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setSanityCheckRequested(true);
    setSanityRequestedAt(now);
    setSanityRequestedBy(userDisplayName);
    setSanityCompletedAt(null);
    setSanityCompletedBy(null);
    const success = await persistPrepUpdate(
      {
        sanity_check_requested: true,
        sanity_check_requested_at: now,
        sanity_check_requested_by: userDisplayName,
        sanity_check_completed_at: null,
        sanity_check_completed_by: null,
      },
      { skipActivityLog: true }
    );
    if (success) {
      const { error: activityError } = await logActivity({
        companyId,
        locationId,
        user,
        action: 'sanity_check_requested',
        entityType: 'ASIS_LOAD',
        entityId: load.sub_inventory_name,
        details: {
          loadNumber: load.sub_inventory_name,
          friendlyName: load.friendly_name ?? null,
        },
      });
      if (activityError) {
        console.warn('Failed to log activity (sanity_check_requested):', activityError.message);
      }
    }
  };

  const completeSanityCheck = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setSanityCheckRequested(false);
    setSanityCompletedAt(now);
    setSanityCompletedBy(userDisplayName);
    const success = await persistPrepUpdate(
      {
        sanity_check_requested: false,
        sanity_check_completed_at: now,
        sanity_check_completed_by: userDisplayName,
      },
      { skipActivityLog: true }
    );
    if (success) {
      const { error: activityError } = await logActivity({
        companyId,
        locationId,
        user,
        action: 'sanity_check_completed',
        entityType: 'ASIS_LOAD',
        entityId: load.sub_inventory_name,
        details: {
          loadNumber: load.sub_inventory_name,
          friendlyName: load.friendly_name ?? null,
        },
      });
      if (activityError) {
        console.warn('Failed to log activity (sanity_check_completed):', activityError.message);
      }
    }
  };

  const handlePickupDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setPickupDate(nextValue);
    if (pickupTba) {
      setPickupTba(false);
    }
    persistPrepUpdate({
      pickup_date: nextValue ? nextValue : null,
      pickup_tba: false,
    });
  };

  const handlePickupTbaChange = (checked: boolean | 'indeterminate') => {
    const nextValue = checked === true;
    setPickupTba(nextValue);
    if (nextValue) {
      setPickupDate('');
      persistPrepUpdate({ pickup_tba: true, pickup_date: null });
    } else {
      persistPrepUpdate({ pickup_tba: false });
    }
  };

  const handlePrintTags = () => {
    if (!items.length) {
      toast({
        variant: 'error',
        title: 'No items to print',
        message: 'This load has no items yet.',
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
      toast({
        variant: 'error',
        title: 'Pop-up blocked',
        message: 'Allow pop-ups to open the print view.',
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{displayName}</h2>
              {load.category && <Badge variant="secondary">{load.category}</Badge>}
              {load.ge_source_status && (
                <Badge variant="outline">GE: {load.ge_source_status}</Badge>
              )}
              {isReadyForPickup && (
                <Badge className="bg-green-500 text-white">Ready for pickup</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline">{load.inventory_type}</Badge>
              {isSold && <Badge variant="outline">Prep {prepCount}/2</Badge>}
              {load.ge_submitted_date && (
                <span className="text-xs text-muted-foreground">GE Submitted {formatGeSubmitted(load.ge_submitted_date)}</span>
              )}
              {load.ge_scanned_at && (
                <span className="text-xs text-muted-foreground">GE Scanned {formatGeScanned(load.ge_scanned_at)}</span>
              )}
              {createdDate && (
                <span className="text-xs text-muted-foreground">Local Created {createdDate}</span>
              )}
              {load.ge_cso ? (
                <span className="text-xs text-muted-foreground">CSO {load.ge_cso}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Load # {load.sub_inventory_name}</span>
              )}
              {pickupLabel && (
                <span className="text-xs text-muted-foreground">{pickupLabel}</span>
              )}
            </div>
            {load.ge_cso && (
              <div className="text-xs text-muted-foreground mt-1">
                Load # {load.sub_inventory_name}
              </div>
            )}
            {load.notes && (
              <p className="text-sm text-muted-foreground mt-2">{load.notes}</p>
            )}
          </div>
          {(onClose || onOpenStandalone) && (
            <div className="flex items-center gap-2">
              {onOpenStandalone && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onOpenStandalone}
                  aria-label="Open standalone load view"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
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
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-muted-foreground">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground/70">GE Inv Org</div>
              <div className="text-sm font-medium text-foreground">{load.ge_inv_org || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground/70">GE Units</div>
              <div className="text-sm font-medium text-foreground">{load.ge_units ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground/70">GE CSO</div>
              <div className="text-sm font-medium text-foreground">{load.ge_cso || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground/70">GE CSO Status</div>
              <div className="text-sm font-medium text-foreground">{load.ge_cso_status || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground/70">GE Pricing</div>
              <div className="text-sm font-medium text-foreground">{load.ge_pricing || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground/70">GE Status</div>
              <div className="text-sm font-medium text-foreground">{load.ge_source_status || '—'}</div>
            </div>
            {load.ge_notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground/70">GE Notes</div>
                <div className="text-sm font-medium text-foreground break-words">{load.ge_notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Prep checklist</p>
              <p className="text-xs text-muted-foreground">Tagged, wrapped, and sanity check requests.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {savingPrep && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>{prepCount}/2 complete</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={prepTagged} onCheckedChange={handleTaggedChange} disabled={savingPrep} />
              Tagged
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={prepWrapped} onCheckedChange={handleWrappedChange} disabled={savingPrep} />
              Wrapped
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Sanity check</span>
                {sanityCheckRequested ? (
                  <span className="text-xs text-muted-foreground">
                    Requested
                    {sanityRequestedBy ? ` by ${sanityRequestedBy}` : ''}
                    {sanityRequestedAt ? ` • ${formatSanityTimestamp(sanityRequestedAt)}` : ''}
                  </span>
                ) : sanityCompletedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Last completed
                    {sanityCompletedBy ? ` by ${sanityCompletedBy}` : ''}
                    {sanityCompletedAt ? ` • ${formatSanityTimestamp(sanityCompletedAt)}` : ''}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not requested</span>
                )}
              </div>
              <Button
                size="responsive"
                variant={sanityCheckRequested ? 'outline' : 'default'}
                onClick={() =>
                  sanityCheckRequested
                    ? setSanityCompleteConfirmOpen(true)
                    : setSanityRequestConfirmOpen(true)
                }
                disabled={savingPrep}
              >
                {sanityCheckRequested ? 'Complete sanity check' : 'Request sanity check'}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Pickup</span>
              <Input
                type="date"
                value={pickupDate}
                onChange={handlePickupDateChange}
                disabled={savingPrep || pickupTba}
                className="w-[160px]"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={pickupTba} onCheckedChange={handlePickupTbaChange} disabled={savingPrep} />
                TBA
              </label>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="flex items-start gap-2 text-left"
              onClick={() => setDetailsOpen((prev) => !prev)}
            >
              <ChevronDown className={`mt-0.5 h-4 w-4 transition-transform ${detailsOpen ? '' : '-rotate-90'}`} />
              <div>
                <p className="text-sm font-medium">Load details</p>
                <p className="text-xs text-muted-foreground">Local metadata you can edit.</p>
                {!detailsOpen && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Name: {friendlyName.trim() || '—'} • Color: {colorLabel}
                    {isSalvage ? ' • Salvage' : ''}
                  </p>
                )}
              </div>
            </button>
            {detailsOpen && (
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
            )}
          </div>

          {detailsOpen && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground/70">Friendly name</label>
                  <Input
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value.toUpperCase())}
                    placeholder="Optional display name"
                  />
                  {load.inventory_type === 'ASIS' && (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      {derivedFriendlyCode && !friendlyName.trim() && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-primary"
                          onClick={() => setFriendlyName(derivedFriendlyCode)}
                        >
                          Use suggested name {derivedFriendlyCode}
                        </button>
                      )}
                      {suggestedCodes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedCodes.map((code) => (
                            <button
                              key={code}
                              type="button"
                              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                              onClick={() => setFriendlyName(code)}
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                      )}
                      <p>Allowed: 1–2 letters, not used in the last {recentWindowSize} ASIS loads.</p>
                    </div>
                  )}
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
                  <select
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No color</option>
                    {COLOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.value})
                      </option>
                    ))}
                  </select>
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
            </>
          )}
        </div>

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

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 p-4 bg-muted rounded-lg sm:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">Total Items</div>
            <div className="text-2xl font-bold">{items.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Product Types</div>
            <div className="text-sm mt-1">
              {Object.entries(productTypeBreakdown).map(([type, count]) => (
                <div key={type}>
                  {type}: {count}
                </div>
              ))}
            </div>
          </div>
        </div>
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

        {/* Search and selection */}
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
                </>
              );

              return (
                <InventoryItemCard
                  key={item.id}
                  item={{
                    ...normalizedItem,
                    status: undefined,
                    ge_availability_status: undefined,
                  }}
                  showInventoryTypeBadge={false}
                  showRouteBadge={false}
                  showProductMeta
                  showImage={Boolean((normalizedItem.products as any)?.image_url)}
                  badges={badges}
                />
              );
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        open={sanityRequestConfirmOpen}
        onOpenChange={setSanityRequestConfirmOpen}
        title="Request sanity check?"
        description="This marks the load as needing a sanity check."
        confirmText="Request sanity check"
        cancelText="Cancel"
        onConfirm={() => {
          setSanityRequestConfirmOpen(false);
          requestSanityCheck();
        }}
      />

      <ConfirmDialog
        open={sanityCompleteConfirmOpen}
        onOpenChange={setSanityCompleteConfirmOpen}
        title="Complete sanity check?"
        description="This marks the sanity check as complete."
        confirmText="Complete sanity check"
        cancelText="Cancel"
        onConfirm={() => {
          setSanityCompleteConfirmOpen(false);
          completeSanityCheck();
        }}
      />
    </>
  );
}
