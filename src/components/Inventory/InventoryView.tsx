import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { InventoryItemDetailDialog } from './InventoryItemDetailDialog';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { usePartsListView } from '@/hooks/usePartsListView';
import { PartsListViewToggle } from './PartsListViewToggle';
import { InventoryDataTable } from './InventoryDataTable';
import { useUiHandedness } from '@/hooks/useUiHandedness';
import {
  Loader2,
  Search,
  X,
  Eye,
  Download,
  Trash2,
  Upload,
  SlidersHorizontal,
  MoreHorizontal,
  ArrowUpDown,
} from 'lucide-react';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGeSync } from '@/hooks/queries/useGeSync';
import { useImportInventorySnapshot } from '@/hooks/queries/useInventoryImport';
import type { InventoryImportProgress } from '@/lib/inventoryImportManager';
import {
  useInventoryBrands,
  useInventoryExport,
  useInventoryPages,
  useInventorySubInventories,
  useNukeInventory,
} from '@/hooks/queries/useInventory';
import {
  resolveInventoryTypes,
  type InventoryExportColumn,
  type InventoryFilters,
  type InventorySort,
  type InventoryTypeFilter,
} from '@/lib/inventoryManager';
import type { ProductImportSource } from '@/lib/inventoryImportManager';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 60;
const EXPORT_BATCH_SIZE = 1000;

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

type ExportColumn = InventoryExportColumn & { key: ExportColumnKey };

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

interface InventoryViewProps {
  onMenuClick?: () => void;
}

export function InventoryView({ onMenuClick }: InventoryViewProps) {
  const { locationId, companyId } = getActiveLocationContext();
  const geSyncMutation = useGeSync();
  const importSnapshotMutation = useImportInventorySnapshot();
  const [exportedRows, setExportedRows] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [nukeDialogOpen, setNukeDialogOpen] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [exportColumnKeys, setExportColumnKeys] = useState<Set<ExportColumnKey>>(
    () => new Set(exportColumns.map(column => column.key))
  );
  const [includeRowNumbers, setIncludeRowNumbers] = useState(false);
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const uiHandedness = useUiHandedness();
  const isMobile = useIsMobile();
  const alignRight = isMobile && uiHandedness === 'right';

  // State
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const { view, setView } = usePartsListView();
  const isImageView = view === 'images';
  const isTableView = view === 'table';
  const inventoryFilters = useMemo<InventoryFilters>(() => ({
    inventoryType: inventoryTypeFilter,
    subInventory: subInventoryFilter,
    productCategory: productCategoryFilter,
    brand: brandFilter,
    search: searchTerm,
  }), [inventoryTypeFilter, subInventoryFilter, productCategoryFilter, brandFilter, searchTerm]);
  const inventoryQuery = useInventoryPages(inventoryFilters, sortOption, PAGE_SIZE);
  const { data: brandOptions = [] } = useInventoryBrands();
  const { data: subInventoryOptions = [] } = useInventorySubInventories(inventoryTypeFilter);
  const exportMutation = useInventoryExport();
  const nukeMutation = useNukeInventory();
  const items = inventoryQuery.data?.pages.flatMap(page => page.items) ?? [];
  const totalCount = inventoryQuery.data?.pages[0]?.count ?? 0;
  const loading = inventoryQuery.isLoading;
  const loadingMore = inventoryQuery.isFetchingNextPage;
  const hasMore = Boolean(inventoryQuery.hasNextPage);
  const exporting = exportMutation.isPending;
  const nuking = nukeMutation.isPending;
  const listError = inventoryQuery.isError
    ? inventoryQuery.error instanceof Error
      ? inventoryQuery.error.message
      : 'Failed to load inventory items'
    : null;

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

  

  const handleViewItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setItemDetailOpen(true);
  };

  const handleExport = useCallback(async () => {
    if (exportMutation.isPending) return;
    if (!locationId) {
      setExportError('No active location selected.');
      return;
    }

    const exportSearch = searchInput.trim();
    const exportFilters: InventoryFilters = {
      inventoryType: inventoryTypeFilter,
      subInventory: subInventoryFilter,
      productCategory: productCategoryFilter,
      brand: brandFilter,
      search: exportSearch,
    };

    setExportedRows(0);
    setExportError(null);

    try {
      const selectedColumns = exportColumns.filter(column => exportColumnKeys.has(column.key)) as InventoryExportColumn[];
      const result = await exportMutation.mutateAsync({
        locationId,
        filters: exportFilters,
        sort: sortOption,
        columns: selectedColumns,
        includeRowNumbers,
        batchSize: EXPORT_BATCH_SIZE,
        onProgress: setExportedRows,
      });

      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export inventory:', err);
      setExportError(err instanceof Error ? err.message : 'Failed to export inventory');
    }
  }, [
    brandFilter,
    exportColumnKeys,
    exportMutation,
    includeRowNumbers,
    inventoryTypeFilter,
    locationId,
    productCategoryFilter,
    searchInput,
    sortOption,
    subInventoryFilter,
  ]);

  const handleNukeProducts = useCallback(async () => {
    if (nukeMutation.isPending) return;
    if (!locationId) {
      toast.error('No active location', {
        description: 'Select a location before clearing inventory.',
      });
      return;
    }

    try {
      const source = resolveProductImportSource(inventoryTypeFilter);
      if (!source) {
        toast.error('Missing source', {
          description: 'Pick ASIS, FG, or Local Stock in the type filter before deleting inventory.',
        });
        return;
      }
      const types = resolveInventoryTypes(inventoryTypeFilter);
      const typeFilter = types.length > 0 ? types : [source.inventoryType];
      const result = await nukeMutation.mutateAsync({ inventoryTypes: typeFilter, locationId });

      toast(`${source.label} inventory cleared`, {
        description: typeof result.count === 'number'
          ? `${result.count} items removed (${typeFilter.join(', ')}).`
          : `${source.label} items removed.`,
      });

      setNukeDialogOpen(false);
    } catch (err) {
      console.error('Failed to clear inventory:', err);
      toast.error('Failed to clear inventory', {
        description: err instanceof Error ? err.message : 'Unable to delete inventory items.',
      });
    }
  }, [inventoryTypeFilter, locationId, nukeMutation]);

  const handleImportProducts = useCallback(async () => {
    if (importingProducts) return;
    if (!locationId || !companyId) {
      toast.error('Missing location', {
        description: 'Select a location before importing inventory.',
      });
      return;
    }
    const source = resolveProductImportSource(inventoryTypeFilter);
    if (!source) {
      toast.error('Missing source', {
        description: 'Pick ASIS, FG, or Local Stock in the type filter before importing.',
      });
      return;
    }
    setImportingProducts(true);
    let importToastId: string | number | undefined;
    let syncToastId: string | number | undefined;
    let syncInterval: number | undefined;

    try {
      // For ASIS, use the GE sync logic (GE fields become source of truth)
      if (inventoryTypeFilter === 'ASIS') {
        syncToastId = toast.loading('Syncing ASIS inventory…');
        let elapsed = 0;
        syncInterval = window.setInterval(() => {
          elapsed += 5;
          toast.loading('Syncing ASIS inventory…', {
            id: syncToastId,
            description: `Waiting for GE DMS… ${elapsed}s`,
          });
        }, 5000);

        const result = await geSyncMutation.mutateAsync({ type: 'asis', locationId });
        const stats = result.stats ?? {};
        toast.success('ASIS sync complete', {
          id: syncToastId,
          description: `${stats.totalGEItems ?? 0} items synced. ${stats.newItems ?? 0} new, ${stats.updatedItems ?? 0} updated. ${stats.unassignedItems ?? 0} not in loads.`,
        });
      } else {
        importToastId = toast.loading(`Importing ${source.label} inventory…`);
        const handleProgress = (progress: InventoryImportProgress) => {
          const description =
            typeof progress.total === 'number' && typeof progress.processed === 'number'
              ? `${progress.message} ${progress.processed}/${progress.total}`
              : progress.message;
          toast.loading(`Importing ${source.label} inventory…`, {
            id: importToastId,
            description,
          });
        };

        const result = await importSnapshotMutation.mutateAsync({
          source,
          locationId,
          companyId,
          onProgress: handleProgress,
        });

        if (result.totalRows === 0) {
          toast.error(`No ${source.label} products found`, {
            id: importToastId,
            description: `${source.fileName} did not return any rows.`,
          });
          return;
        }

        toast.success(`${source.label} products imported`, {
          id: importToastId,
          description: `${result.processedRows} rows processed. ${result.crossTypeSkipped} skipped due to cross-type conflicts.`,
        });
      }

    } catch (err) {
      console.error('Failed to import products:', err);
      toast.error('Import failed', {
        id: importToastId ?? syncToastId,
        description: err instanceof Error ? err.message : 'Unable to import inventory file.',
      });
    } finally {
      if (syncInterval) {
        window.clearInterval(syncInterval);
      }
      setImportingProducts(false);
    }
  }, [
    companyId,
    importingProducts,
    inventoryTypeFilter,
    locationId,
    geSyncMutation,
    importSnapshotMutation,
  ]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    inventoryQuery.fetchNextPage();
  }, [hasMore, inventoryQuery, loading, loadingMore]);

  useEffect(() => {
    setSubInventoryFilter('all');
  }, [inventoryTypeFilter]);

  

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
  const handleNukeClick = () => {
    if (!selectedImportSource) {
      toast.error('Missing source', {
        description: 'Pick ASIS, FG, or Local Stock in the type filter before deleting inventory.',
      });
      return;
    }
    setNukeDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader title="Inventory" onMenuClick={onMenuClick} />
      )}

      {/* Filters */}
      <div className="border-b">
        <PageContainer className="py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search CSO, Serial, Model…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              size="responsive"
              className="pl-10 sm:pl-10"
            />
          </div>

          <div
            className={cn(
              'flex items-center sm:hidden',
              alignRight ? 'justify-end' : 'justify-start'
            )}
          >
            <Button
              type="button"
              size="responsive"
              variant="outline"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {filtersOpen ? 'Hide filters' : 'Show filters'}
            </Button>
          </div>

          <div
            className={cn(
              'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4',
              filtersOpen ? 'grid' : 'hidden',
              'sm:grid'
            )}
          >
            <Select
              value={inventoryTypeFilter}
              onValueChange={v =>
                setInventoryTypeFilter(v as InventoryTypeFilter)
              }
            >
            <SelectTrigger size="responsive" className="w-full">
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
            <SelectTrigger size="responsive" className="w-full">
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
            <SelectTrigger size="responsive" className="w-full">
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

          </div>

          {subInventoryOptions.length > 0 && (
            <div className={cn(filtersOpen ? 'block' : 'hidden', 'sm:block')}>
              <Select
                value={subInventoryFilter}
                onValueChange={setSubInventoryFilter}
              >
                <SelectTrigger size="responsive" className="w-full">
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
            </div>
          )}

          {/* Filter chips and count */}
          <div
            className={cn(
              'flex flex-wrap items-center gap-2 text-sm',
              alignRight ? 'justify-end' : 'justify-start'
            )}
          >
            <span className="text-muted-foreground">
              {totalCount > 0 ? `${items.length} of ${totalCount} items` : `${items.length} items`}
            </span>
            {activeFilters.map((filter) => (
              <Button
                key={filter.key}
                size="responsive"
                variant="outline"
                className="h-7 px-2"
                onClick={filter.clear}
              >
                <span className="truncate">{filter.label}</span>
                <X className="ml-1 h-3 w-3" />
              </Button>
            ))}
            {activeFilters.length > 0 && (
              <Button size="responsive" variant="ghost" onClick={clearAllFilters}>
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

          <div
            className={cn(
              'flex w-full items-center gap-2',
              alignRight ? 'justify-end' : 'justify-start',
              'sticky top-14 z-10 bg-background/95 backdrop-blur py-2'
            )}
          >
            <ButtonGroup className="w-fit">
              <PartsListViewToggle
                view={view}
                onChange={setView}
                showTable
                variant="dropdown"
                triggerSize="responsive"
              />
              <Select value={sortOption} onValueChange={v => setSortOption(v as InventorySort)}>
                <SelectTrigger size="responsive">
                  <span className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="hidden sm:inline">Sort</span>
                    <span className="hidden md:inline text-muted-foreground">·</span>
                    <SelectValue className="hidden md:inline text-muted-foreground" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="model-asc">Model A → Z</SelectItem>
                  <SelectItem value="model-desc">Model Z → A</SelectItem>
                  <SelectItem value="created-desc">Newest first</SelectItem>
                  <SelectItem value="created-asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="responsive"
                    variant="outline"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                    <span className="hidden sm:inline">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleImportProducts} disabled={importingProducts}>
                    <Upload className="h-4 w-4" />
                    Import products
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={handleNukeClick} disabled={nuking}>
                    <Trash2 className="h-4 w-4" />
                    Nuke products
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
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

          {isTableView ? (
            <InventoryDataTable
              items={items}
              onViewItem={handleViewItem}
            />
          ) : (
            items.map(item => (
              <InventoryItemCard
                key={item.id as string}
                item={item}
                onClick={() => handleViewItem(item.id as string)}
                actions={
                  <>
                    <Button
                      type="button"
                      size="responsive"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleViewItem(item.id as string);
                      }}
                    >
                      <Eye className="mr-1 h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                  </>
                }
                showImage={isImageView}
                imageSize={isImageView ? "xl" : "sm"}
                showInventoryTypeBadge
                showScannedBadge
                showProductMeta
                showRouteBadge
              />
            ))
          )}

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
                  size="responsive"
                  variant="ghost"
                  type="button"
                  onClick={() => setExportColumnKeys(new Set(exportColumns.map(column => column.key)))}
                  disabled={exporting}
                >
                  Select all
                </Button>
                <Button
                  size="responsive"
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
