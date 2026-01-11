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
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScanningSessionView } from '@/components/Session/ScanningSessionView';
import { ProductDetailDialog } from '@/components/Products/ProductDetailDialog';
import { InventoryItemDetailDialog } from './InventoryItemDetailDialog';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { getActiveSession } from '@/lib/sessionManager';
import { Loader2, Search, ExternalLink, PackageOpen, ScanBarcode } from 'lucide-react';

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
}

export function InventoryView({ onSettingsClick, onViewChange }: InventoryViewProps) {
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

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] =
    useState<'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts'>(getInitialFilter);
  const [subInventoryFilter, setSubInventoryFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'appliance' | 'part' | 'accessory'>('all');
  const [brandFilter, setBrandFilter] = useState('all');

  // State
  const [activeSessionView, setActiveSessionView] = useState(false);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');

  useEffect(() => {
    if (getActiveSession()) {
      setActiveSessionView(true);
    }
  }, []);

  // Update URL when filter changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (inventoryTypeFilter !== 'all') {
      params.set('type', inventoryTypeFilter);
    } else {
      params.delete('type');
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [inventoryTypeFilter]);

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

  const handleSessionExit = () => {
    setActiveSessionView(false);
    fetchItems();
  };

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

  if (activeSessionView) {
    return <ScanningSessionView onExit={handleSessionExit} />;
  }

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
        actions={
          <div className="flex gap-2">
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
      <div className="border-b px-4 py-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search CSO, Serial, Model, Brand…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select
            value={inventoryTypeFilter}
            onValueChange={v =>
              setInventoryTypeFilter(v as 'all' | 'ASIS' | 'FG' | 'LocalStock' | 'Parts')
            }
          >
            <SelectTrigger>
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
            <SelectTrigger>
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
            <SelectTrigger>
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
            <SelectTrigger>
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
      </div>

      {/* Inventory List */}
      <div className="p-4 pb-24 space-y-2">
        {filteredItems.map(item => (
          <Card
            key={item.id as string}
            className="p-4 cursor-pointer hover:bg-accent transition"
            onClick={() => handleViewItem(item.id as string)}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {item.products?.product_type ?? item.product_type}
                </span>
                <Badge variant="secondary">{item.inventory_type}</Badge>
                {item.is_scanned && <Badge variant="outline">Scanned</Badge>}
              </div>

              {item.products && (
                <>
                  {item.products.brand && (
                    <Badge variant="outline">{item.products.brand}</Badge>
                  )}
                  {item.products.description && (
                    <p className="text-sm text-muted-foreground">
                      {item.products.description}
                    </p>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">CSO:</span>{' '}
                  <span className="font-mono">{item.cso}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Serial:</span>{' '}
                  <span className="font-mono">{item.serial ?? '-'}</span>
                </div>

                <div className="col-span-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (item.products) {
                        handleViewProduct(item.products.model);
                      }
                    }}
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                  >
                    {item.products?.model ?? item.model}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>

                {item.route_id && (
                  <div>
                    <span className="text-muted-foreground">Route:</span>{' '}
                    <span className="font-mono">{item.route_id}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

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
