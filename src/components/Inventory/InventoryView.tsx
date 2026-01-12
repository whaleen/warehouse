import { useState, useEffect, useMemo } from 'react';
import supabase from '@/lib/supabase';
import type { InventoryItem } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// import { Badge } from '@/components/ui/badge';
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
import { Loader2, Search, PackageOpen, ScanBarcode, ClipboardList, X } from 'lucide-react';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';

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

interface InventoryViewProps {
  onSettingsClick: () => void;
  onViewChange: (view: 'dashboard' | 'inventory' | 'products' | 'settings' | 'loads' | 'create-session') => void;
  onMenuClick?: () => void;
}

export function InventoryView({ onSettingsClick, onViewChange, onMenuClick }: InventoryViewProps) {
  const [items, setItems] = useState<InventoryItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] =
    useState<'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts'>(getInitialFilter);
  const [subInventoryFilter, setSubInventoryFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'appliance' | 'part' | 'accessory'>('all');
  const [brandFilter, setBrandFilter] = useState('all');

  // State
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [partsTab, setPartsTab] = useState<'inventory' | 'tracked' | 'history' | 'reports'>(getInitialPartsTab);
  const [partsStatus, setPartsStatus] = useState<'all' | 'reorder'>(getInitialPartsStatus);
  const { view, setView, isImageView } = usePartsListView();

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

      setInventoryTypeFilter(prev => (prev === nextType ? prev : nextType));
      setPartsTab(prev => (prev === nextTab ? prev : nextTab));
      setPartsStatus(prev => (prev === nextStatus ? prev : nextStatus));
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

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
  }, [inventoryTypeFilter, partsTab, partsStatus]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      // Fetch ALL items in batches
      let allItems: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select(
            `
            *,
            products:product_fk (
              id,
              model,
              product_type,
              brand,
              description,
              dimensions,
              image_url,
              product_url,
              product_category
            )
          `,
          )
          .range(from, from + batchSize - 1)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          allItems = [...allItems, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setItems(allItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleViewProduct = (model: string) => {
    setSelectedModel(model);
    setProductDetailOpen(true);
  };

  const handleViewItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setItemDetailOpen(true);
  };

  const uniqueSubInventories = useMemo(() => {
    // Only show sub-inventory filter for types that use loads
    const typesWithLoads = ['ASIS', 'FG', 'LocalStock'];
    if (inventoryTypeFilter === 'all' || !typesWithLoads.includes(inventoryTypeFilter)) {
      return [];
    }

    // Get items matching the filter type (including related types)
    const scoped = items.filter(i => {
      if (inventoryTypeFilter === 'FG') {
        return i.inventory_type === 'FG' || i.inventory_type === 'BackHaul';
      } else if (inventoryTypeFilter === 'LocalStock') {
        return i.inventory_type === 'LocalStock' || i.inventory_type === 'Staged' || i.inventory_type === 'Inbound' || i.inventory_type === 'WillCall';
      } else if (inventoryTypeFilter === 'ASIS') {
        return i.inventory_type === 'ASIS';
      } else {
        return i.inventory_type === inventoryTypeFilter;
      }
    });

    return [...new Set(scoped.map(i => i.sub_inventory).filter(Boolean))].sort();
  }, [items, inventoryTypeFilter]);

  const uniqueBrands = useMemo(() => {
    const brands = items
      .map(i => i.products?.brand)
      .filter(Boolean) as string[];
    return [...new Set(brands)].sort();
  }, [items]);

  useEffect(() => {
    setSubInventoryFilter('all');
  }, [inventoryTypeFilter]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase();

    return items.filter(item => {
      const matchesSearch =
        !q ||
        item.cso?.toLowerCase().includes(q) ||
        item.serial?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q) ||
        item.products?.model?.toLowerCase().includes(q) ||
        item.products?.brand?.toLowerCase().includes(q) ||
        item.products?.description?.toLowerCase().includes(q);

      // Handle inventory type filter with grouped types
      const matchesType = (() => {
        if (inventoryTypeFilter === 'all') return true;

        if (inventoryTypeFilter === 'FG') {
          return item.inventory_type === 'FG' || item.inventory_type === 'BackHaul';
        } else if (inventoryTypeFilter === 'LocalStock') {
          return item.inventory_type === 'LocalStock' || item.inventory_type === 'Staged' || item.inventory_type === 'Inbound';
        } else if (inventoryTypeFilter === 'Parts') {
          return item.inventory_type === 'Parts';
        } else if (inventoryTypeFilter === 'ASIS') {
          return item.inventory_type === 'ASIS';
        }

        return item.inventory_type === inventoryTypeFilter;
      })();

      const matchesSub =
        subInventoryFilter === 'all' ||
        item.sub_inventory === subInventoryFilter;

      const matchesCategory =
        productCategoryFilter === 'all' ||
        item.products?.product_category === productCategoryFilter;

      const matchesBrand =
        brandFilter === 'all' ||
        item.products?.brand === brandFilter;

      return matchesSearch && matchesType && matchesSub && matchesCategory && matchesBrand;
    });
  }, [items, searchTerm, inventoryTypeFilter, subInventoryFilter, productCategoryFilter, brandFilter]);

  const activeFilters = [
    searchTerm && {
      key: 'search',
      label: `Search: ${searchTerm}`,
      clear: () => setSearchTerm(''),
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
    setSearchTerm('');
    setInventoryTypeFilter('all');
    setSubInventoryFilter('all');
    setProductCategoryFilter('all');
    setBrandFilter('all');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading inventory…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Inventory"
        onSettingsClick={onSettingsClick}
        onMenuClick={onMenuClick}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onViewChange('loads')}>
              <PackageOpen className="mr-2 h-4 w-4" />
              Manage Loads
            </Button>
            <Button size="sm" onClick={() => onViewChange('create-session')}>
              <ScanBarcode className="mr-2 h-4 w-4" />
              Scan
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
              placeholder="Search CSO, Serial, Model, Brand…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                {uniqueBrands.map(brand => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {uniqueSubInventories.length > 0 && (
            <Select
              value={subInventoryFilter}
              onValueChange={setSubInventoryFilter}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Sub-Inventories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub-Inventories</SelectItem>
                {uniqueSubInventories.map(sub => (
                  <SelectItem key={sub} value={sub!}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Filter chips and count */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {filteredItems.length} of {items.length} items
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
              <PartsInventoryTab searchTerm={searchTerm} statusFilter={partsStatus} />
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
          {filteredItems.map(item => (
            <InventoryItemCard
              key={item.id as string}
              item={item}
              onClick={() => handleViewItem(item.id as string)}
              onModelClick={
                item.products
                  ? () => handleViewProduct(item.products?.model ?? item.model)
                  : undefined
              }
              showImage={isImageView}
              showInventoryTypeBadge
              showScannedBadge
              showProductMeta
              showRouteBadge
            />
          ))}
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

      
    </div>
  );
}
