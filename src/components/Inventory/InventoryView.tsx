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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductDetailDialog } from '@/components/Products/ProductDetailDialog';
import { InventoryItemDetailDialog } from './InventoryItemDetailDialog';
import { PartsInventoryTab } from './PartsInventoryTab';
import { PartsTrackingTab } from './PartsTrackingTab';
import { PartsHistoryChart } from './PartsHistoryChart';
import { PartsReportsTab } from './PartsReportsTab';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { usePartsListView } from '@/hooks/usePartsListView';
import { PartsListViewToggle } from './PartsListViewToggle';
import { Loader2, Search, ClipboardList, X, FileText, PackageSearch, Download, Trash2, Upload } from 'lucide-react';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { fetchAsisCsvRows, fetchAsisXlsRows } from '@/lib/asisImport';

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

type AsisProductRow = {
  'Model #': string;
  'Serial #': string;
  'Inv Qty': string | number;
  'Availability Status': string;
  'Availability Message': string;
};

type AsisLoadRow = {
  'Load Number': string;
  Units: string | number;
  Notes?: string;
  'Scanned Date/Time'?: string;
  Status?: string;
};

type AsisLoadItemRow = {
  ORDC: string;
  MODELS: string;
  SERIALS: string;
  QTY: string | number;
  'LOAD NUMBER': string;
};

type NormalizedAsisLoad = {
  loadNumber: string;
  units: number;
  notes: string;
  scannedAt: string;
  status: string;
};

const PAGE_SIZE = 60;
const EXPORT_BATCH_SIZE = 1000;
const IMPORT_BATCH_SIZE = 500;

type InventoryFilters = {
  inventoryType: 'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts';
  subInventory: string;
  productCategory: 'all' | 'appliance' | 'part' | 'accessory';
  brand: string;
  search: string;
};

type InventorySort = 'model-asc' | 'model-desc' | 'created-desc' | 'created-asc';

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
  | 'product_url';

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

const parseAsisTimestamp = (value: string) => {
  if (!value) return 0;
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
};

const dedupeBySerial = (items: InventoryItem[]) => {
  const seen = new Map<string, InventoryItem>();
  const output: InventoryItem[] = [];
  let duplicates = 0;

  items.forEach(item => {
    const serial = item.serial?.trim();
    if (!serial) {
      output.push(item);
      return;
    }
    if (seen.has(serial)) {
      duplicates += 1;
    }
    seen.set(serial, { ...item, serial });
  });

  output.push(...seen.values());
  return { items: output, duplicates };
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
  const [importingLoads, setImportingLoads] = useState(false);
  const [exportColumnKeys, setExportColumnKeys] = useState<Set<ExportColumnKey>>(
    () => new Set(exportColumns.map(column => column.key))
  );
  const [includeRowNumbers, setIncludeRowNumbers] = useState(false);
  const requestIdRef = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Read filter from URL on mount
  const getInitialFilter = (): 'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts' => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'ASIS' || type === 'FG' || type === 'LocalStock' || type === 'Parts') {
      return type;
    }
    return 'all';
  };
  const getInitialPartsTab = (): 'inventory' | 'tracked' | 'history' | 'reports' => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('partsTab');
    if (tab === 'tracked' || tab === 'history' || tab === 'reports' || tab === 'inventory') {
      return tab;
    }
    return 'inventory';
  };
  const getInitialPartsStatus = (): 'all' | 'reorder' => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('partsStatus');
    return status === 'reorder' ? 'reorder' : 'all';
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
    useState<'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts'>(getInitialFilter);
  const [subInventoryFilter, setSubInventoryFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'appliance' | 'part' | 'accessory'>('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [sortOption, setSortOption] = useState<InventorySort>(getInitialSort);
  const [subInventoryOptions, setSubInventoryOptions] = useState<string[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);

  // State
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [partsTab, setPartsTab] = useState<'inventory' | 'tracked' | 'history' | 'reports'>(getInitialPartsTab);
  const [partsStatus, setPartsStatus] = useState<'all' | 'reorder'>(getInitialPartsStatus);
  const { view, setView, isImageView } = usePartsListView();

  const resolveInventoryTypes = useCallback((type: 'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts') => {
    if (type === 'FG') {
      return ['FG', 'BackHaul'];
    }
    if (type === 'LocalStock') {
      return ['LocalStock', 'Staged', 'Inbound', 'WillCall'];
    }
    if (type === 'ASIS') {
      return ['ASIS'];
    }
    if (type === 'Parts') {
      return ['Parts'];
    }
    return [];
  }, []);

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
        type === 'ASIS' || type === 'FG' || type === 'LocalStock' || type === 'Parts'
          ? type
          : 'all';
      const tab = params.get('partsTab');
      const nextTab =
        tab === 'tracked' || tab === 'history' || tab === 'reports' || tab === 'inventory'
          ? tab
          : 'inventory';
      const status = params.get('partsStatus');
      const nextStatus = status === 'reorder' ? 'reorder' : 'all';
      const sort = params.get('sort');
      const nextSort =
        sort === 'model-desc' || sort === 'created-desc' || sort === 'created-asc' || sort === 'model-asc'
          ? sort
          : 'model-asc';

      setInventoryTypeFilter(prev => (prev === nextType ? prev : nextType));
      setPartsTab(prev => (prev === nextTab ? prev : nextTab));
      setPartsStatus(prev => (prev === nextStatus ? prev : nextStatus));
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
    if (partsTab !== 'inventory' && partsStatus !== 'all') {
      setPartsStatus('all');
    }
  }, [partsTab, partsStatus]);

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

    if (inventoryTypeFilter === 'Parts') {
      params.set('partsTab', partsTab);
      if (partsStatus !== 'all') {
        params.set('partsStatus', partsStatus);
      } else {
        params.delete('partsStatus');
      }
    } else {
      params.delete('partsTab');
      params.delete('partsStatus');
    }

    if (sortOption !== 'model-asc') {
      params.set('sort', sortOption);
    } else {
      params.delete('sort');
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
  }, [inventoryTypeFilter, partsTab, partsStatus, sortOption]);

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
        .select('sub_inventory_name')
        .eq('location_id', locationId)
        .in('inventory_type', types);

      if (error) {
        console.error('Failed to load sub-inventories:', error);
        setSubInventoryOptions([]);
        return;
      }

      const unique = Array.from(
        new Set((data ?? []).map(item => item.sub_inventory_name).filter(Boolean))
      ).sort();
      setSubInventoryOptions(unique);
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
    if (inventoryTypeFilter === 'Parts') return;
    setItems([]);
    setPage(0);
    setHasMore(true);
    setTotalCount(0);
    setListError(null);
    setLoadingMore(false);
    fetchInventoryPage(0, { append: false });
  }, [fetchInventoryPage, inventoryTypeFilter]);

  const handleNukeProducts = useCallback(async () => {
    if (nuking) return;
    if (!locationId) {
      toast({
        variant: 'destructive',
        title: 'No active location',
        description: 'Select a location before clearing inventory.',
      });
      return;
    }

    setNuking(true);
    try {
      const { error, count } = await supabase
        .from('inventory_items')
        .delete({ count: 'exact' })
        .eq('location_id', locationId)
        .or('inventory_type.neq.Parts,inventory_type.is.null');

      if (error) throw error;

      toast({
        title: 'Non-part inventory cleared',
        description: typeof count === 'number' ? `${count} items removed.` : 'Non-part items removed.',
      });

      refreshInventoryList();
    } catch (err) {
      console.error('Failed to clear non-part inventory:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to clear inventory',
        description: err instanceof Error ? err.message : 'Unable to delete non-part items.',
      });
    } finally {
      setNuking(false);
    }
  }, [locationId, nuking, refreshInventoryList, toast]);

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

  const handleImportProducts = useCallback(async () => {
    if (importingProducts || importingLoads) return;
    setImportingProducts(true);
    try {
      const rows = await fetchAsisXlsRows<AsisProductRow>('ASIS.xls');
      if (!rows.length) {
        toast({
          title: 'No ASIS products found',
          description: 'ASIS.xls did not return any rows.',
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
          const qtyValue = typeof row['Inv Qty'] === 'number' ? row['Inv Qty'] : parseInt(String(row['Inv Qty']).trim(), 10);
          const product = productLookup.get(model);
          return {
            cso: 'ASIS',
            model,
            qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
            serial: serialValue || undefined,
            product_type: product?.product_type ?? 'UNKNOWN',
            product_fk: product?.id,
            status: String(row['Availability Status'] ?? '').trim() || undefined,
            notes: String(row['Availability Message'] ?? '').trim() || undefined,
            inventory_type: 'ASIS' as const,
            is_scanned: false,
          };
        })
        .filter(Boolean) as InventoryItem[];

      const { items: dedupedItems, duplicates } = dedupeBySerial(inventoryItems);
      if (duplicates > 0) {
        toast({
          title: 'Duplicate serials collapsed',
          description: `${duplicates} duplicate serials were merged before import.`,
        });
      }

      const payload = dedupedItems.map(item => ({
        ...item,
        company_id: companyId,
        location_id: locationId,
      }));

      for (const chunk of chunkArray(payload, IMPORT_BATCH_SIZE)) {
        const { error } = await supabase
          .from('inventory_items')
          .upsert(chunk, { onConflict: 'serial' });
        if (error) throw error;
      }

      toast({
        title: 'ASIS products imported',
        description: `${dedupedItems.length} items processed.`,
      });
      refreshInventoryList();
    } catch (err) {
      console.error('Failed to import ASIS products:', err);
      toast({
        variant: 'destructive',
        title: 'ASIS import failed',
        description: err instanceof Error ? err.message : 'Unable to import ASIS.xls.',
      });
    } finally {
      setImportingProducts(false);
    }
  }, [buildProductLookup, companyId, importingLoads, importingProducts, locationId, refreshInventoryList, toast]);

  const handleImportLoads = useCallback(async () => {
    if (importingProducts || importingLoads) return;
    setImportingLoads(true);
    try {
      const loadRows = await fetchAsisXlsRows<AsisLoadRow>('ASISLoadData.xls');
      const normalizedLoads: NormalizedAsisLoad[] = loadRows
        .map(row => {
          const loadNumber = String(row['Load Number'] ?? '').trim();
          if (!loadNumber) return null;
          const unitsValue = typeof row.Units === 'number' ? row.Units : parseInt(String(row.Units).trim(), 10);
          return {
            loadNumber,
            units: Number.isFinite(unitsValue) ? unitsValue : 0,
            notes: String(row.Notes ?? '').trim(),
            scannedAt: String(row['Scanned Date/Time'] ?? '').trim(),
            status: String(row.Status ?? '').trim(),
          };
        })
        .filter(Boolean) as NormalizedAsisLoad[];

      if (!normalizedLoads.length) {
        toast({
          title: 'No ASIS loads found',
          description: 'ASISLoadData.xls did not return any rows.',
        });
        return;
      }

      const loadNumbers = normalizedLoads.map(load => load.loadNumber);
      let existingLoadNumbers = new Set<string>();
      if (loadNumbers.length) {
        const { data, error } = await supabase
          .from('load_metadata')
          .select('sub_inventory_name')
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('sub_inventory_name', loadNumbers);
        if (error) throw error;
        existingLoadNumbers = new Set((data ?? []).map(load => load.sub_inventory_name));
      }

      const newLoads = normalizedLoads
        .filter(load => !existingLoadNumbers.has(load.loadNumber))
        .map(load => ({
          company_id: companyId,
          location_id: locationId,
          inventory_type: 'ASIS',
          sub_inventory_name: load.loadNumber,
          status: 'active',
          category: load.status || null,
          notes: [load.notes, load.scannedAt].filter(Boolean).join(' • ') || null,
        }));

      if (newLoads.length) {
        const { error } = await supabase.from('load_metadata').insert(newLoads);
        if (error) throw error;
      }

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
          const rows = await fetchAsisCsvRows<AsisLoadItemRow>(`${load.loadNumber}.csv`);
          rows.forEach(row => loadItemRows.push({ row, load }));
        } catch (err) {
          loadErrors.push(`${load.loadNumber}: ${err instanceof Error ? err.message : 'Failed to load CSV.'}`);
        }
      }

      const loadModels = loadItemRows
        .map(item => String(item.row.MODELS ?? '').trim())
        .filter(Boolean);
      const productLookup = await buildProductLookup(loadModels);

      const serialCandidates = new Map<
        string,
        Array<{
          item: InventoryItem;
          loadNumber: string;
          loadIndex: number;
          loadTimestamp: number;
        }>
      >();
      const noSerialItems: InventoryItem[] = [];
      const conflictRows: Array<{ serial: string; loadNumber: string; conflictingLoad: string }> = [];
      loadItemRows.forEach(({ row, load }) => {
        const model = String(row.MODELS ?? '').trim();
        if (!model) return;
        const serialValue = String(row.SERIALS ?? '').trim();
        const qtyValue = typeof row.QTY === 'number' ? row.QTY : parseInt(String(row.QTY).trim(), 10);
        const product = productLookup.get(model);
        const item: InventoryItem = {
          cso: String(row.ORDC ?? '').trim() || 'ASIS',
          model,
          qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
          serial: serialValue || undefined,
          product_type: product?.product_type ?? 'UNKNOWN',
          product_fk: product?.id,
          status: load.status || undefined,
          notes: load.notes || undefined,
          inventory_type: 'ASIS',
          sub_inventory: load.loadNumber,
          is_scanned: false,
        };

        if (!serialValue) {
          noSerialItems.push(item);
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

      const dedupedItems: InventoryItem[] = [...noSerialItems];
      serialCandidates.forEach((candidates, serial) => {
        let canonical = candidates[0];
        candidates.forEach(candidate => {
          if (candidate.loadTimestamp > canonical.loadTimestamp) {
            canonical = candidate;
            return;
          }
          if (
            candidate.loadTimestamp === canonical.loadTimestamp &&
            candidate.loadIndex > canonical.loadIndex
          ) {
            canonical = candidate;
          }
        });

        dedupedItems.push(canonical.item);
        const uniqueLoads = new Set(candidates.map(candidate => candidate.loadNumber));
        if (uniqueLoads.size > 1) {
          candidates.forEach(candidate => {
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

      const payload = dedupedItems.map(item => ({
        ...item,
        company_id: companyId,
        location_id: locationId,
      }));

      for (const chunk of chunkArray(payload, IMPORT_BATCH_SIZE)) {
        const { error } = await supabase
          .from('inventory_items')
          .upsert(chunk, { onConflict: 'serial' });
        if (error) throw error;
      }

      if (loadNumbers.length) {
        const { error } = await supabase
          .from('load_conflicts')
          .delete()
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .in('load_number', loadNumbers);
        if (error) throw error;
      }

      if (conflictRows.length > 0) {
        const conflictPayload = conflictRows.map(conflict => ({
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

      toast({
        title: 'ASIS loads imported',
        description: `${normalizedLoads.length} loads, ${dedupedItems.length} items processed.`,
      });

      if (conflictRows.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Serial conflicts detected',
          description: `${conflictRows.length} conflict${conflictRows.length === 1 ? '' : 's'} logged.`,
        });
      }

      if (loadErrors.length) {
        toast({
          variant: 'destructive',
          title: 'Some load CSVs failed',
          description: `${loadErrors.length} CSV files could not be read.`,
        });
      }

      refreshInventoryList();
    } catch (err) {
      console.error('Failed to import ASIS loads:', err);
      toast({
        variant: 'destructive',
        title: 'Load import failed',
        description: err instanceof Error ? err.message : 'Unable to import ASIS loads.',
      });
    } finally {
      setImportingLoads(false);
    }
  }, [buildProductLookup, companyId, importingLoads, importingProducts, locationId, refreshInventoryList, toast]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchInventoryPage(page + 1, { append: true });
  }, [fetchInventoryPage, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    setSubInventoryFilter('all');
  }, [inventoryTypeFilter]);

  useEffect(() => {
    if (inventoryTypeFilter === 'Parts') {
      setItems([]);
      setTotalCount(0);
      setHasMore(false);
      setListError(null);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

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
    if (inventoryTypeFilter === 'Parts') return;
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
  }, [handleLoadMore, inventoryTypeFilter]);

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
      label: `Load: ${subInventoryFilter}`,
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Inventory"
        onMenuClick={onMenuClick}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleImportProducts}
              disabled={importingProducts || importingLoads}
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
              onClick={handleImportLoads}
              disabled={importingProducts || importingLoads}
            >
              {importingLoads ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import loads
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              disabled={inventoryTypeFilter === 'Parts'}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setNukeDialogOpen(true)}
              disabled={nuking}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Nuke products
            </Button>
          </div>
        }
      />

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
                setInventoryTypeFilter(v as 'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts')
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
                <SelectItem value="Parts">Parts</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={productCategoryFilter}
              onValueChange={v =>
                setProductCategoryFilter(v as 'all' | 'appliance' | 'part' | 'accessory')
              }
            >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="appliance">Appliances</SelectItem>
                <SelectItem value="part">Parts</SelectItem>
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
                {subInventoryOptions.map(sub => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
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

          {inventoryTypeFilter !== 'Parts' && (
            <div className="flex justify-end">
              <PartsListViewToggle view={view} onChange={setView} />
            </div>
          )}
        </PageContainer>
      </div>

      {/* Parts Inventory with Tabs */}
      {inventoryTypeFilter === 'Parts' ? (
        <PageContainer className="py-4 pb-24">
          <Tabs value={partsTab} onValueChange={(v) => setPartsTab(v as typeof partsTab)}>
            <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 mb-4">
              <TabsTrigger value="inventory">
                <ClipboardList className="h-4 w-4 mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="tracked">Tracked Parts</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory">
              <PartsInventoryTab searchTerm={searchInput} statusFilter={partsStatus} />
            </TabsContent>

            <TabsContent value="tracked">
              <PartsTrackingTab />
            </TabsContent>

            <TabsContent value="history">
              <PartsHistoryChart />
            </TabsContent>

            <TabsContent value="reports">
              <PartsReportsTab />
            </TabsContent>
          </Tabs>
        </PageContainer>
      ) : (
        /* Regular Inventory List */
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
      )}

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

      <ConfirmDialog
        open={nukeDialogOpen}
        onOpenChange={setNukeDialogOpen}
        title="Nuke non-part inventory?"
        description="This will delete every inventory item that is not a part for the active location. This cannot be undone."
        confirmText="Delete non-part items"
        destructive
        onConfirm={handleNukeProducts}
      />

      
    </div>
  );
}
