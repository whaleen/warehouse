import { useState, useEffect, useCallback, useRef } from 'react';
import supabase from '@/lib/supabase';
import type { InventoryItem } from '@/types/inventory';
import { getActiveLocationContext } from '@/lib/tenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductDetailDialog } from '@/components/Products/ProductDetailDialog';
import { InventoryItemDetailDialog } from './InventoryItemDetailDialog';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { usePartsListView } from '@/hooks/usePartsListView';
import { PartsListViewToggle } from './PartsListViewToggle';
import { Loader2, Search, X, FileText, PackageSearch, Download, Trash2, Upload } from 'lucide-react';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { fetchAsisXlsRows } from '@/lib/asisImport';

type InventoryItemWithProduct = InventoryItem & {
  products: {
    id: string;
    model: string;
    product_type: string;
    brand?: string;
    description?: string;
    dimensions?: Record<string, any>;
    image_url?: string;
    product_url?: string;
    product_category?: string;
  } | null;
};

type ProductImportRow = {
  'Model #': string;
  'Serial #': string;
  'Inv Qty': string | number;
  'Availability Status': string;
  'Availability Message': string;
};

const PAGE_SIZE = 60;
const EXPORT_BATCH_SIZE = 1000;
const IMPORT_BATCH_SIZE = 500;
const GE_SYNC_URL =
  (import.meta.env.VITE_GE_SYNC_URL as string | undefined) ?? 'http://localhost:3001';
const GE_SYNC_API_KEY = import.meta.env.VITE_GE_SYNC_API_KEY as string | undefined;

type InventoryTypeFilter = 'all' | 'ASIS' | 'FG' | 'LocalStock';

type InventoryFilters = {
  inventoryType: InventoryTypeFilter;
  subInventory: string;
  productCategory: 'all' | 'appliance' | 'accessory';
  brand: string;
  search: string;
};

type InventorySort = 'model-asc' | 'model-desc' | 'created-desc' | 'created-asc';

type ProductImportSource = {
  label: string;
  baseUrl: string;
  fileName: string;
  inventoryType: 'ASIS' | 'FG' | 'STA';
  csoValue: string;
};

const PRODUCT_IMPORT_SOURCES_BY_FILTER: Record<'ASIS' | 'FG' | 'LocalStock', ProductImportSource> = {
  ASIS: {
    label: 'ASIS',
    baseUrl: '/ASIS',
    fileName: 'ASIS.xls',
    inventoryType: 'ASIS',
    csoValue: 'ASIS',
  },
  FG: {
    label: 'FG',
    baseUrl: '/FG',
    fileName: 'ERP On Hand Qty.xls',
    inventoryType: 'FG',
    csoValue: 'FG',
  },
  LocalStock: {
    label: 'Local Stock (STA)',
    baseUrl: '/STA',
    fileName: 'ERP On Hand Qty.xls',
    inventoryType: 'STA',
    csoValue: 'STA',
  },
};

const resolveProductImportSource = (filter: InventoryTypeFilter) => {
  if (filter === 'ASIS' || filter === 'FG' || filter === 'LocalStock') {
    return PRODUCT_IMPORT_SOURCES_BY_FILTER[filter];
  }
  return null;
};

type ExportColumnKey =
  | 'item_id'
  | 'cso'
  | 'serial'
  | 'item_model'
  | 'item_product_type'
  | 'inventory_type'
  | 'sub_inventory'
  | 'route_id'
  | 'is_scanned'
  | 'customer'
  | 'created_at'
  | 'product_id'
  | 'product_model'
  | 'product_type'
  | 'brand'
  | 'product_category'
  | 'description'
  | 'image_url'
  | 'product_url'
  | 'ge_model'
  | 'ge_serial'
  | 'ge_inv_qty'
  | 'ge_availability_status'
  | 'ge_availability_message'
  | 'ge_ordc'
  | 'ge_orphaned';

type ExportColumn = {
  key: ExportColumnKey;
  label: string;
  group: 'Item' | 'Product';
  getValue: (item: InventoryItemWithProduct) => string | number | boolean | null | undefined;
};

const exportColumns: ExportColumn[] = [
  { key: 'item_id', label: 'Item ID', group: 'Item', getValue: item => item.id },
  { key: 'cso', label: 'CSO', group: 'Item', getValue: item => item.cso },
  { key: 'serial', label: 'Serial', group: 'Item', getValue: item => item.serial },
  { key: 'item_model', label: 'Item Model', group: 'Item', getValue: item => item.model },
  { key: 'item_product_type', label: 'Item Product Type', group: 'Item', getValue: item => item.product_type },
  { key: 'inventory_type', label: 'Inventory Type', group: 'Item', getValue: item => item.inventory_type },
  { key: 'sub_inventory', label: 'Sub Inventory', group: 'Item', getValue: item => item.sub_inventory },
  { key: 'route_id', label: 'Route', group: 'Item', getValue: item => item.route_id },
  { key: 'is_scanned', label: 'Scanned', group: 'Item', getValue: item => item.is_scanned },
  { key: 'customer', label: 'Customer', group: 'Item', getValue: item => item.consumer_customer_name },
  { key: 'created_at', label: 'Created At', group: 'Item', getValue: item => item.created_at },
  { key: 'ge_model', label: 'GE Model #', group: 'Item', getValue: item => item.ge_model },
  { key: 'ge_serial', label: 'GE Serial #', group: 'Item', getValue: item => item.ge_serial },
  { key: 'ge_inv_qty', label: 'GE Inv Qty', group: 'Item', getValue: item => item.ge_inv_qty },
  { key: 'ge_availability_status', label: 'GE Availability Status', group: 'Item', getValue: item => item.ge_availability_status },
  { key: 'ge_availability_message', label: 'GE Availability Message', group: 'Item', getValue: item => item.ge_availability_message },
  { key: 'ge_ordc', label: 'GE ORDC', group: 'Item', getValue: item => item.ge_ordc },
  { key: 'ge_orphaned', label: 'GE Orphaned', group: 'Item', getValue: item => item.ge_orphaned },
  { key: 'product_id', label: 'Product ID', group: 'Product', getValue: item => item.products?.id },
  { key: 'product_model', label: 'Product Model', group: 'Product', getValue: item => item.products?.model },
  { key: 'product_type', label: 'Product Type', group: 'Product', getValue: item => item.products?.product_type },
  { key: 'brand', label: 'Brand', group: 'Product', getValue: item => item.products?.brand },
  { key: 'product_category', label: 'Product Category', group: 'Product', getValue: item => item.products?.product_category },
  { key: 'description', label: 'Description', group: 'Product', getValue: item => item.products?.description },
  { key: 'image_url', label: 'Image URL', group: 'Product', getValue: item => item.products?.image_url },
  { key: 'product_url', label: 'Product URL', group: 'Product', getValue: item => item.products?.product_url },
];

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const normalizeInventoryItem = (item: any): InventoryItemWithProduct => ({
  ...item,
  qty: item.qty ?? 1,
  products: Array.isArray(item.products) ? item.products[0] ?? null : item.products ?? null,
});

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

interface InventoryViewProps {
  onMenuClick?: () => void;
}

export function InventoryView({ onMenuClick }: InventoryViewProps) {
  const { locationId, companyId } = getActiveLocationContext();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItemWithProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportedRows, setExportedRows] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [nukeDialogOpen, setNukeDialogOpen] = useState(false);
  const [nuking, setNuking] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [exportColumnKeys, setExportColumnKeys] = useState<Set<ExportColumnKey>>(
    () => new Set(exportColumns.map(column => column.key))
  );
  const [includeRowNumbers, setIncludeRowNumbers] = useState(false);
  const requestIdRef = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Read filter from URL on mount
  const getInitialFilter = (): InventoryTypeFilter => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'ASIS' || type === 'FG' || type === 'LocalStock') {
      return type;
    }
    return 'all';
  };
  const getInitialSort = (): InventorySort => {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get('sort');
    if (sort === 'model-desc' || sort === 'created-desc' || sort === 'created-asc' || sort === 'model-asc') {
      return sort;
    }
    return 'model-asc';
  };

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] =
    useState<InventoryTypeFilter>(getInitialFilter);
  const [subInventoryFilter, setSubInventoryFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'appliance' | 'accessory'>('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [sortOption, setSortOption] = useState<InventorySort>(getInitialSort);
  const [subInventoryOptions, setSubInventoryOptions] = useState<Array<{
    value: string;
    label: string;
    color?: string | null;
    friendlyName?: string | null;
    cso?: string | null;
  }>>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);

  // State
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const { view, setView, isImageView } = usePartsListView();

  // GE sync stats (for ASIS)
  const [geSyncStats, setGeSyncStats] = useState<{
    totalItems: number;
    itemsInLoads: number;
    unassignedItems: number;
    forSaleLoads: number;
    pickedLoads: number;
  } | null>(null);
  const [loadingGEStats, setLoadingGEStats] = useState(false);

  const resolveInventoryTypes = useCallback((type: InventoryTypeFilter) => {
    if (type === 'FG') {
      return ['FG', 'BackHaul'];
    }
    if (type === 'LocalStock') {
      return ['LocalStock', 'Staged', 'STA', 'Inbound', 'WillCall'];
    }
    if (type === 'ASIS') {
      return ['ASIS'];
    }
    return [];
  }, []);

  const findCrossTypeSerials = useCallback(async (serials: string[], inventoryType: string) => {
    if (!locationId || serials.length === 0) return new Set<string>();
    const conflictSerials = new Set<string>();
    for (const chunk of chunkArray(serials, 500)) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('serial, inventory_type')
        .eq('location_id', locationId)
        .in('serial', chunk)
        .neq('inventory_type', inventoryType);
      if (error) throw error;
      (data ?? []).forEach(row => {
        if (row.serial) {
          conflictSerials.add(row.serial);
        }
      });
    }
    return conflictSerials;
  }, [locationId]);

  const applyInventoryFilters = useCallback(
    (query: any, filters: InventoryFilters) => {
      let nextQuery = query;

      if (filters.inventoryType !== 'all') {
        const types = resolveInventoryTypes(filters.inventoryType);
        if (types.length === 1) {
          nextQuery = nextQuery.eq('inventory_type', types[0]);
        } else if (types.length > 1) {
          nextQuery = nextQuery.in('inventory_type', types);
        }
      }

      if (filters.subInventory !== 'all') {
        nextQuery = nextQuery.eq('sub_inventory', filters.subInventory);
      }

      if (filters.productCategory !== 'all') {
        nextQuery = nextQuery.eq('products.product_category', filters.productCategory);
      }

      if (filters.brand !== 'all') {
        nextQuery = nextQuery.eq('products.brand', filters.brand);
      }

      if (filters.search) {
        const escaped = filters.search.replace(/[%_]/g, '\\$&').replace(/,/g, ' ');
        const like = `%${escaped}%`;
        nextQuery = nextQuery.or(
          `cso.ilike.${like},serial.ilike.${like},model.ilike.${like},product_type.ilike.${like}`
        );
      }

      return nextQuery;
    },
    [resolveInventoryTypes]
  );

  const applyInventorySort = useCallback((query: any, sort: InventorySort) => {
    switch (sort) {
      case 'model-desc':
        return query.order('model', { ascending: false }).order('created_at', { ascending: false });
      case 'created-asc':
        return query.order('created_at', { ascending: true }).order('model', { ascending: true });
      case 'created-desc':
        return query.order('created_at', { ascending: false }).order('model', { ascending: true });
      case 'model-asc':
      default:
        return query.order('model', { ascending: true }).order('created_at', { ascending: false });
    }
  }, []);

  // Keep tabs in sync with URL changes (e.g., sidebar navigation)
  useEffect(() => {
    const syncFromParams = () => {
      const params = new URLSearchParams(window.location.search);
      const type = params.get('type');
      const nextType =
        type === 'ASIS' || type === 'FG' || type === 'LocalStock'
          ? type
          : 'all';
      const sort = params.get('sort');
      const nextSort =
        sort === 'model-desc' || sort === 'created-desc' || sort === 'created-asc' || sort === 'model-asc'
          ? sort
          : 'model-asc';

      setInventoryTypeFilter(prev => (prev === nextType ? prev : nextType));
      setSortOption(prev => (prev === nextSort ? prev : nextSort));
    };

    syncFromParams();
    const handleChange = () => syncFromParams();
    window.addEventListener('app:locationchange', handleChange);
    window.addEventListener('popstate', handleChange);
    return () => {
      window.removeEventListener('app:locationchange', handleChange);
      window.removeEventListener('popstate', handleChange);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearchTerm(prev => (prev === next ? prev : next));
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (inventoryTypeFilter !== 'all') {
      params.set('type', inventoryTypeFilter);
    } else {
      params.delete('type');
    }

    if (sortOption !== 'model-asc') {
      params.set('sort', sortOption);
    } else {
      params.delete('sort');
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
  }, [inventoryTypeFilter, sortOption]);

  useEffect(() => {
    const fetchBrands = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('brand')
        .not('brand', 'is', null);

      if (error) {
        console.error('Failed to load brands:', error);
        return;
      }

      const unique = Array.from(new Set((data ?? []).map(item => item.brand).filter(Boolean))).sort();
      setBrandOptions(unique);
    };

    fetchBrands();
  }, []);

  useEffect(() => {
    const typesWithLoads = ['ASIS', 'FG', 'LocalStock'];
    if (inventoryTypeFilter === 'all' || !typesWithLoads.includes(inventoryTypeFilter)) {
      setSubInventoryOptions([]);
      return;
    }

    const fetchSubInventories = async () => {
      const types = resolveInventoryTypes(inventoryTypeFilter);
      const { data, error } = await supabase
        .from('load_metadata')
        .select('sub_inventory_name, friendly_name, primary_color, ge_cso')
        .eq('location_id', locationId)
        .in('inventory_type', types);

      if (error) {
        console.error('Failed to load sub-inventories:', error);
        setSubInventoryOptions([]);
        return;
      }

      const optionMap = new Map<string, {
        value: string;
        friendlyName?: string | null;
        color?: string | null;
        cso?: string | null;
      }>();

      (data ?? []).forEach((item) => {
        const value = item.sub_inventory_name?.trim();
        if (!value) return;
        const existing = optionMap.get(value);
        optionMap.set(value, {
          value,
          friendlyName: item.friendly_name?.trim() || existing?.friendlyName || null,
          color: item.primary_color?.trim() || existing?.color || null,
          cso: item.ge_cso?.trim() || existing?.cso || null,
        });
      });

      const isAsis = inventoryTypeFilter === 'ASIS';
      const options = Array.from(optionMap.values())
        .map(option => {
          if (!isAsis) {
            return {
              ...option,
              label: option.value,
            };
          }
          const friendly = option.friendlyName?.trim() || 'Unnamed';
          const csoOrLoad = option.cso?.trim() || option.value;
          return {
            ...option,
            label: `${friendly} • ${csoOrLoad}`,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      setSubInventoryOptions(options);
    };

    fetchSubInventories();
  }, [inventoryTypeFilter, resolveInventoryTypes, locationId]);

  const handleViewProduct = (model: string) => {
    setSelectedModel(model);
    setProductDetailOpen(true);
  };

  const handleViewItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setItemDetailOpen(true);
  };

  const handleExport = useCallback(async () => {
    if (exporting) return;

    const exportSearch = searchInput.trim();
    const exportFilters: InventoryFilters = {
      inventoryType: inventoryTypeFilter,
      subInventory: subInventoryFilter,
      productCategory: productCategoryFilter,
      brand: brandFilter,
      search: exportSearch,
    };

    setExporting(true);
    setExportedRows(0);
    setExportError(null);

    try {
      const lines: string[] = [];
      const selectedColumns = exportColumns.filter(column => exportColumnKeys.has(column.key));
      if (selectedColumns.length === 0) {
        throw new Error('Select at least one column to export.');
      }

      const header = [
        ...(includeRowNumbers ? ['#'] : []),
        ...selectedColumns.map(column => column.label),
      ];
      lines.push(header.map(csvEscape).join(','));

      let from = 0;
      let totalExported = 0;
      let rowNumber = 1;

      while (true) {
        let query = supabase
          .from('inventory_items')
          .select(
            `
            id,
            qty,
            cso,
            serial,
            model,
            product_type,
            inventory_type,
            sub_inventory,
            route_id,
            is_scanned,
            consumer_customer_name,
            created_at,
            ge_model,
            ge_serial,
            ge_inv_qty,
            ge_availability_status,
            ge_availability_message,
            ge_ordc,
            ge_orphaned,
            products:product_fk (
              id,
              model,
              product_type,
              brand,
              description,
              image_url,
              product_url,
              product_category
            )
          `
          )
          .eq('location_id', locationId)
          .range(from, from + EXPORT_BATCH_SIZE - 1);

        query = applyInventoryFilters(query, exportFilters);
        query = applyInventorySort(query, sortOption);

        const { data, error } = await query;
        if (error) throw error;

        const batch = (data ?? []).map(normalizeInventoryItem);
        if (batch.length === 0) break;

        for (const item of batch) {
          const rowValues = selectedColumns.map(column => {
            const value = column.getValue(item);
            if (column.key === 'is_scanned') {
              return value ? 'true' : 'false';
            }
            return value ?? '';
          });

          const row = includeRowNumbers
            ? [rowNumber, ...rowValues]
            : rowValues;

          lines.push(row.map(csvEscape).join(','));
          rowNumber += 1;
        }

        totalExported += batch.length;
        setExportedRows(totalExported);

        if (batch.length < EXPORT_BATCH_SIZE) break;
        from += EXPORT_BATCH_SIZE;
      }

      const filenameParts = ['inventory-export'];
      if (exportFilters.inventoryType !== 'all') {
        filenameParts.push(exportFilters.inventoryType.toLowerCase());
      }
      if (exportFilters.subInventory !== 'all') {
        filenameParts.push(exportFilters.subInventory.replace(/\s+/g, '-').toLowerCase());
      }
      filenameParts.push(new Date().toISOString().slice(0, 10));
      const filename = `${filenameParts.join('-')}.csv`;

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export inventory:', err);
      setExportError(err instanceof Error ? err.message : 'Failed to export inventory');
    } finally {
      setExporting(false);
    }
  }, [
    applyInventoryFilters,
    applyInventorySort,
    locationId,
    exportColumnKeys,
    exporting,
    inventoryTypeFilter,
    subInventoryFilter,
    productCategoryFilter,
    brandFilter,
    includeRowNumbers,
    searchInput,
    sortOption,
  ]);

  const fetchInventoryPage = useCallback(async (pageIndex: number, options?: { append?: boolean }) => {
    const append = options?.append ?? false;
    const requestId = ++requestIdRef.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setListError(null);

    try {
      const filters: InventoryFilters = {
        inventoryType: inventoryTypeFilter,
        subInventory: subInventoryFilter,
        productCategory: productCategoryFilter,
        brand: brandFilter,
        search: searchTerm,
      };

      let query = supabase
        .from('inventory_items')
        .select(
          `
          id,
          qty,
          cso,
          serial,
          model,
          product_type,
          inventory_type,
          sub_inventory,
          route_id,
          is_scanned,
          consumer_customer_name,
          ge_model,
          ge_serial,
          ge_inv_qty,
          ge_availability_status,
          ge_availability_message,
          ge_ordc,
          ge_orphaned,
          products:product_fk (
            id,
            model,
            product_type,
            brand,
            description,
            image_url,
            product_category
          )
        `,
          { count: 'exact' }
        )
        .eq('location_id', locationId)
        .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1);

      query = applyInventoryFilters(query, filters);
      query = applyInventorySort(query, sortOption);

      const { data, error, count } = await query;

      if (requestId !== requestIdRef.current) return;
      if (error) throw error;

      const nextItems = (data ?? []).map(normalizeInventoryItem);
      setItems(prev => (append ? [...prev, ...nextItems] : nextItems));
      setPage(pageIndex);
      if (typeof count === 'number') {
        setTotalCount(count);
      }
      const moreAvailable = nextItems.length === PAGE_SIZE && (typeof count !== 'number' || (pageIndex + 1) * PAGE_SIZE < count);
      setHasMore(moreAvailable);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load inventory items:', err);
      setListError(err instanceof Error ? err.message : 'Failed to load inventory items');
      if (!append) {
        setItems([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [inventoryTypeFilter, subInventoryFilter, productCategoryFilter, brandFilter, searchTerm, sortOption, applyInventoryFilters, applyInventorySort, locationId]);

  const refreshInventoryList = useCallback(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    setTotalCount(0);
    setListError(null);
    setLoadingMore(false);
    fetchInventoryPage(0, { append: false });
  }, [fetchInventoryPage]);

  const handleNukeProducts = useCallback(async () => {
    if (nuking) return;
    if (!locationId) {
      toast({
        variant: 'error',
        title: 'No active location',
        message: 'Select a location before clearing inventory.',
      });
      return;
    }

    try {
      const source = resolveProductImportSource(inventoryTypeFilter);
      if (!source) {
        toast({
          variant: 'error',
          title: 'Missing source',
          message: 'Pick ASIS, FG, or Local Stock in the type filter before deleting inventory.',
        });
        return;
      }
      setNuking(true);
      const types = resolveInventoryTypes(inventoryTypeFilter);
      const typeFilter = types.length > 0 ? types : [source.inventoryType];

      const { error, count } = await supabase
        .from('inventory_items')
        .delete({ count: 'exact' })
        .eq('location_id', locationId)
        .in('inventory_type', typeFilter);

      if (error) throw error;

      toast({
        title: `${source.label} inventory cleared`,
        message: typeof count === 'number'
          ? `${count} items removed (${typeFilter.join(', ')}).`
          : `${source.label} items removed.`,
      });

      refreshInventoryList();
      setNukeDialogOpen(false);
    } catch (err) {
      console.error('Failed to clear inventory:', err);
      toast({
        variant: 'error',
        title: 'Failed to clear inventory',
        message: err instanceof Error ? err.message : 'Unable to delete inventory items.',
      });
    } finally {
      setNuking(false);
    }
  }, [inventoryTypeFilter, locationId, nuking, refreshInventoryList, toast]);

  const buildProductLookup = useCallback(async (models: string[]) => {
    const uniqueModels = Array.from(new Set(models.map(model => model.trim()).filter(Boolean)));
    const lookup = new Map<string, { id: string; product_type: string }>();
    for (const chunk of chunkArray(uniqueModels, 500)) {
      const { data, error } = await supabase
        .from('products')
        .select('id, model, product_type')
        .in('model', chunk);
      if (error) throw error;
      (data ?? []).forEach(product => {
        if (product.id && product.product_type) {
          lookup.set(product.model, { id: product.id, product_type: product.product_type });
        }
      });
    }
    return lookup;
  }, []);

  const handleImportProducts = useCallback(async () => {
    if (importingProducts) return;
    const source = resolveProductImportSource(inventoryTypeFilter);
    if (!source) {
      toast({
        variant: 'error',
        title: 'Missing source',
        message: 'Pick ASIS, FG, or Local Stock in the type filter before importing.',
      });
      return;
    }
    setImportingProducts(true);
    try {
      // For ASIS, use the GE sync logic (GE fields become source of truth)
      if (inventoryTypeFilter === 'ASIS') {
        const response = await fetch(`${GE_SYNC_URL}/sync/asis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(GE_SYNC_API_KEY ? { 'X-API-Key': GE_SYNC_API_KEY } : {}),
          },
          body: JSON.stringify({ locationId }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          const errorMessage = payload?.error || response.statusText || 'Failed to sync ASIS';
          throw new Error(errorMessage);
        }

        const stats = payload.stats ?? {};
        toast({
          title: 'ASIS sync complete',
          message: `${stats.totalGEItems ?? 0} items synced. ${stats.newItems ?? 0} new, ${stats.updatedItems ?? 0} updated. ${stats.unassignedItems ?? 0} not in loads.`,
        });
      } else {
        // For FG/STA, import GE snapshot (GE fields become source of truth)
        const rows = await fetchAsisXlsRows<ProductImportRow>(source.fileName, source.baseUrl);
        if (!rows.length) {
          toast({
            title: `No ${source.label} products found`,
            message: `${source.fileName} did not return any rows.`,
          });
          return;
        }

        const models = rows
          .map(row => String(row['Model #'] ?? '').trim())
          .filter(Boolean);
        const productLookup = await buildProductLookup(models);

        const inventoryItems = rows
          .map(row => {
            const model = String(row['Model #'] ?? '').trim();
            if (!model) return null;
            const serialValue = String(row['Serial #'] ?? '').trim();
            const qtyValue = typeof row['Inv Qty'] === 'number'
              ? row['Inv Qty']
              : parseInt(String(row['Inv Qty']).trim(), 10);
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
            };
          })
          .filter(Boolean) as InventoryItem[];

        const incomingSerials = Array.from(
          new Set(inventoryItems.map(item => item.serial).filter(Boolean))
        ) as string[];
        const crossTypeSerials = await findCrossTypeSerials(incomingSerials, source.inventoryType);

        const filteredItems = inventoryItems.filter(
          (item) => !item.serial || !crossTypeSerials.has(item.serial)
        );

        const uniqueBySerial = new Map<string, InventoryItem>();
        const itemsWithoutSerial: InventoryItem[] = [];
        filteredItems.forEach(item => {
          if (!item.serial) {
            itemsWithoutSerial.push(item);
            return;
          }
          if (!uniqueBySerial.has(item.serial)) {
            uniqueBySerial.set(item.serial, item);
          }
        });

        const uniqueItems = [...itemsWithoutSerial, ...uniqueBySerial.values()];

        // Fetch existing items for this inventory type (for id matching)
        const { data: existingItems, error: existingError } = await supabase
          .from('inventory_items')
          .select('id, serial')
          .eq('location_id', locationId)
          .eq('inventory_type', source.inventoryType);

        if (existingError) throw existingError;

        const existingBySerial = new Map<string, string>();
        const existingIds = new Set<string>();

        (existingItems ?? []).forEach(item => {
          if (!item.serial || !item.id) return;
          if (!existingBySerial.has(item.serial)) {
            existingBySerial.set(item.serial, item.id);
          }
          existingIds.add(item.id);
        });

        const matchedIds = new Set<string>();
        const payload = uniqueItems.map(item => {
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

          return {
            ...item,
            id: existingId,
            company_id: companyId,
            location_id: locationId,
          };
        });

        const payloadWithId = payload.filter(item => item.id);
        const payloadWithoutId = payload
          .filter(item => !item.id)
          .map(({ id, ...rest }) => rest);

        for (const chunk of chunkArray(payloadWithoutId, IMPORT_BATCH_SIZE)) {
          if (chunk.length === 0) continue;
          const { error } = await supabase
            .from('inventory_items')
            .insert(chunk);
          if (error) throw error;
        }

        for (const chunk of chunkArray(payloadWithId, IMPORT_BATCH_SIZE)) {
          if (chunk.length === 0) continue;
          const { error } = await supabase
            .from('inventory_items')
            .upsert(chunk, { onConflict: 'id' });
          if (error) throw error;
        }

        // Flag items that no longer exist in GE for this inventory type
        const orphanIds = Array.from(existingIds).filter(id => !matchedIds.has(id));
        for (const chunk of chunkArray(orphanIds, IMPORT_BATCH_SIZE)) {
          if (chunk.length === 0) continue;
          const { error } = await supabase
            .from('inventory_items')
            .update({ status: 'NOT_IN_GE', ge_orphaned: true, ge_orphaned_at: new Date().toISOString() })
            .in('id', chunk);
          if (error) throw error;
        }

        toast({
          title: `${source.label} products imported`,
          message: `${inventoryItems.length} rows processed. ${crossTypeSerials.size} skipped due to cross-type conflicts.`,
        });
      }

      refreshInventoryList();
    } catch (err) {
      console.error('Failed to import products:', err);
      toast({
        variant: 'error',
        title: 'Import failed',
        message: err instanceof Error ? err.message : 'Unable to import inventory file.',
      });
    } finally {
      setImportingProducts(false);
    }
  }, [
    buildProductLookup,
    companyId,
    findCrossTypeSerials,
    importingProducts,
    inventoryTypeFilter,
    locationId,
    refreshInventoryList,
    toast,
  ]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchInventoryPage(page + 1, { append: true });
  }, [fetchInventoryPage, hasMore, loading, loadingMore, page]);

  const fetchGeStats = useCallback(async () => {
    const [{ count: totalItems }, { count: itemsInLoads }, { count: unassignedItems }] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS'),
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS')
        .not('sub_inventory', 'is', null),
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS')
        .is('sub_inventory', null),
    ]);

    const [{ count: forSaleLoads }, { count: pickedLoads }] = await Promise.all([
      supabase
        .from('load_metadata')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS')
        .ilike('ge_source_status', 'for sale'),
      supabase
        .from('load_metadata')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('inventory_type', 'ASIS')
        .ilike('ge_source_status', 'sold')
        .ilike('ge_cso_status', 'picked'),
    ]);

    return {
      totalItems: totalItems ?? 0,
      itemsInLoads: itemsInLoads ?? 0,
      unassignedItems: unassignedItems ?? 0,
      forSaleLoads: forSaleLoads ?? 0,
      pickedLoads: pickedLoads ?? 0,
    };
  }, [locationId]);

  useEffect(() => {
    setSubInventoryFilter('all');
  }, [inventoryTypeFilter, fetchGeStats]);

  // Fetch GE sync stats when ASIS filter is active
  useEffect(() => {
    if (inventoryTypeFilter !== 'ASIS') {
      setGeSyncStats(null);
      return;
    }

    let cancelled = false;
    setLoadingGEStats(true);

    fetchGeStats()
      .then((stats) => {
        if (!cancelled) {
          setGeSyncStats(stats);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch GE sync stats:', err);
        if (!cancelled) {
          setGeSyncStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingGEStats(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inventoryTypeFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setItems([]);
      setPage(0);
      setHasMore(true);
      setTotalCount(0);
      setListError(null);
      setLoadingMore(false);
      fetchInventoryPage(0, { append: false });
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [searchTerm, inventoryTypeFilter, subInventoryFilter, productCategoryFilter, brandFilter, sortOption, fetchInventoryPage]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const selectedSubInventoryLabel =
    subInventoryFilter === 'all'
      ? 'all'
      : subInventoryOptions.find(option => option.value === subInventoryFilter)?.label ?? subInventoryFilter;

  const activeFilters = [
    searchTerm && {
      key: 'search',
      label: `Search: ${searchTerm}`,
      clear: () => {
        setSearchInput('');
        setSearchTerm('');
      },
    },
    inventoryTypeFilter !== 'all' && {
      key: 'type',
      label: `Type: ${inventoryTypeFilter}`,
      clear: () => setInventoryTypeFilter('all'),
    },
    subInventoryFilter !== 'all' && {
      key: 'sub',
      label: `Load: ${selectedSubInventoryLabel}`,
      clear: () => setSubInventoryFilter('all'),
    },
    productCategoryFilter !== 'all' && {
      key: 'category',
      label: `Category: ${productCategoryFilter}`,
      clear: () => setProductCategoryFilter('all'),
    },
    brandFilter !== 'all' && {
      key: 'brand',
      label: `Brand: ${brandFilter}`,
      clear: () => setBrandFilter('all'),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setInventoryTypeFilter('all');
    setSubInventoryFilter('all');
    setProductCategoryFilter('all');
    setBrandFilter('all');
    setSortOption('model-asc');
  };

  const selectedImportSource = resolveProductImportSource(inventoryTypeFilter);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Inventory" onMenuClick={onMenuClick} />

      {/* Filters */}
      <div className="border-b">
        <PageContainer className="py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search CSO, Serial, Model…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={inventoryTypeFilter}
              onValueChange={v =>
                setInventoryTypeFilter(v as InventoryTypeFilter)
              }
            >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ASIS">ASIS</SelectItem>
                <SelectItem value="FG">FG</SelectItem>
                <SelectItem value="LocalStock">Local Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={productCategoryFilter}
              onValueChange={v =>
                setProductCategoryFilter(v as 'all' | 'appliance' | 'accessory')
              }
            >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="appliance">Appliances</SelectItem>
                <SelectItem value="accessory">Accessories</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={brandFilter}
              onValueChange={setBrandFilter}
            >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brandOptions.map(brand => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOption} onValueChange={v => setSortOption(v as InventorySort)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="model-asc">Model A → Z</SelectItem>
                <SelectItem value="model-desc">Model Z → A</SelectItem>
                <SelectItem value="created-desc">Newest first</SelectItem>
                <SelectItem value="created-asc">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {subInventoryOptions.length > 0 && (
            <Select
              value={subInventoryFilter}
              onValueChange={setSubInventoryFilter}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Sub-Inventories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub-Inventories</SelectItem>
                {subInventoryOptions.map(option => {
                  const friendly = option.friendlyName?.trim() || 'Unnamed';
                  const csoOrLoad = option.cso?.trim() || option.value;
                  return (
                    <SelectItem key={option.value} value={option.value} textValue={option.label}>
                      <div className="flex items-center gap-2">
                        {option.color && (
                          <span
                            className="h-3 w-3 rounded-sm border border-border/60"
                            style={{ backgroundColor: option.color }}
                            aria-hidden="true"
                          />
                        )}
                        {inventoryTypeFilter === 'ASIS' ? (
                          <>
                            <span className="font-medium">{friendly}</span>
                            <span className="text-muted-foreground">| {csoOrLoad}</span>
                          </>
                        ) : (
                          <span>{option.value}</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Filter chips and count */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {totalCount > 0 ? `${items.length} of ${totalCount} items` : `${items.length} items`}
            </span>
            {activeFilters.map((filter) => (
              <Button
                key={filter.key}
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={filter.clear}
              >
                <span className="truncate">{filter.label}</span>
                <X className="ml-1 h-3 w-3" />
              </Button>
            ))}
            {activeFilters.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearAllFilters}>
                Clear all
              </Button>
            )}
          </div>

          {/* GE Sync Stats (ASIS only) */}
          {inventoryTypeFilter === 'ASIS' && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {loadingGEStats ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading GE data...
                </div>
              ) : geSyncStats ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-medium">GE Status:</span>
                  <span>{geSyncStats.totalItems} total</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{geSyncStats.itemsInLoads} in loads</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {geSyncStats.unassignedItems} not in any load
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    ({geSyncStats.forSaleLoads} FOR SALE, {geSyncStats.pickedLoads} Picked)
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Unable to load GE stats</span>
              )}
            </div>
          )}

          {(exporting || exportError) && (
            <div className="text-xs">
              {exporting && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Exporting {exportedRows} rows…
                </div>
              )}
              {exportError && (
                <div className="text-destructive">{exportError}</div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <PartsListViewToggle view={view} onChange={setView} />
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportProducts}
                disabled={importingProducts}
              >
                {importingProducts ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import products
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExportDialogOpen(true)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!selectedImportSource) {
                    toast({
                      variant: 'error',
                      title: 'Missing source',
                      message: 'Pick ASIS, FG, or Local Stock in the type filter before deleting inventory.',
                    });
                    return;
                  }
                  setNukeDialogOpen(true);
                }}
                disabled={nuking}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Nuke products
              </Button>
            </div>
          </div>
        </PageContainer>
      </div>

      {/* Inventory List */}
      <PageContainer className="py-4 pb-24 space-y-2">
          {listError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {listError}
            </div>
          )}
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inventory…
            </div>
          )}
          {!loading && !listError && items.length === 0 && (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
              No items match these filters.
            </div>
          )}

          {items.map(item => (
            <InventoryItemCard
              key={item.id as string}
              item={item}
              onClick={() => handleViewItem(item.id as string)}
              actions={
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleViewItem(item.id as string);
                    }}
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    <span>Item</span>
                    <span className="hidden sm:inline">&nbsp;details</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.products?.model || item.model) {
                        handleViewProduct(item.products?.model ?? item.model);
                      }
                    }}
                    disabled={!item.products?.model && !item.model}
                  >
                    <PackageSearch className="mr-1 h-3 w-3" />
                    <span>Product</span>
                    <span className="hidden sm:inline">&nbsp;details</span>
                  </Button>
                </>
              }
              showImage={isImageView}
              showInventoryTypeBadge
              showScannedBadge
              showProductMeta
              showRouteBadge
            />
          ))}

          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more…
            </div>
          )}
          <div ref={loadMoreRef} className="h-px" />
          {!loadingMore && !loading && !hasMore && items.length > 0 && (
            <div className="text-center text-xs text-muted-foreground">
              End of results
            </div>
          )}
        </PageContainer>

      <ProductDetailDialog
        open={productDetailOpen}
        onOpenChange={setProductDetailOpen}
        modelNumber={selectedModel}
      />

      <InventoryItemDetailDialog
        open={itemDetailOpen}
        onOpenChange={setItemDetailOpen}
        itemId={selectedItemId}
      />

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export inventory</DialogTitle>
            <DialogDescription>
              Choose which columns to include in the CSV export.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-row-numbers"
                  checked={includeRowNumbers}
                  onCheckedChange={(checked) => setIncludeRowNumbers(checked === true)}
                  disabled={exporting}
                />
                <Label htmlFor="include-row-numbers">Add row numbers column</Label>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{exportColumnKeys.size} columns selected</span>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setExportColumnKeys(new Set(exportColumns.map(column => column.key)))}
                  disabled={exporting}
                >
                  Select all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setExportColumnKeys(new Set())}
                  disabled={exporting}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(['Item', 'Product'] as const).map(group => (
                <div key={group} className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group} columns
                  </div>
                  <div className="grid gap-2">
                    {exportColumns.filter(column => column.group === group).map(column => (
                      <label key={column.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={exportColumnKeys.has(column.key)}
                          onCheckedChange={(checked) => {
                            setExportColumnKeys(prev => {
                              const next = new Set(prev);
                              if (checked === true) {
                                next.add(column.key);
                              } else {
                                next.delete(column.key);
                              }
                              return next;
                            });
                          }}
                          disabled={exporting}
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {exportError && (
              <div className="mr-auto text-xs text-destructive">
                {exportError}
              </div>
            )}
            <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                await handleExport();
                setExportDialogOpen(false);
              }}
              disabled={exporting || exportColumnKeys.size === 0}
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                'Export CSV'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={nukeDialogOpen} onOpenChange={setNukeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuke inventory?</DialogTitle>
            <DialogDescription>
              This will delete every inventory item for the selected source at the active location. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Source: <span className="font-medium text-foreground">{selectedImportSource?.label ?? 'Unknown'}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNukeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleNukeProducts}
              disabled={nuking || !selectedImportSource}
            >
              {nuking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete items'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      
    </div>
  );
}
