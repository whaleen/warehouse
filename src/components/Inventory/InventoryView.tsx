import { useState, useEffect, useMemo } from 'react';
import supabase from '@/lib/supabase';
import type { InventoryItem, InventoryType } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CSVUpload } from './CSVUpload';
import { CreateSessionDialog } from '@/components/Session/CreateSessionDialog';
import { ScanningSessionView } from '@/components/Session/ScanningSessionView';
import { ProductDetailDialog } from '@/components/Products/ProductDetailDialog';
import { saveSession, setActiveSession, getActiveSession } from '@/lib/sessionManager';
import type { ScanningSession } from '@/types/session';
import { RefreshCw, Loader2, Upload, Search, CheckCircle2, Circle, Play, ExternalLink } from 'lucide-react';

export function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'all' | InventoryType>('all');
  const [subInventoryFilter, setSubInventoryFilter] = useState('all');
  const [scannedFilter, setScannedFilter] = useState<'all' | 'scanned' | 'pending'>('all');

  // Dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [activeSessionView, setActiveSessionView] = useState(false);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  // Check for active session on mount
  useEffect(() => {
    const activeSession = getActiveSession();
    if (activeSession) {
      setActiveSessionView(true);
    }
  }, []);

  // Fetch inventory items with product details
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          products (
            model,
            product_type,
            brand,
            description,
            weight,
            dimensions
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inventory items:', error);
      } else {
        setItems(data || []);
      }
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  // Handle session creation
  const handleSessionCreated = (session: ScanningSession) => {
    saveSession(session);
    setActiveSession(session.id);
    setActiveSessionView(true);
  };

  // Handle session exit
  const handleSessionExit = () => {
    setActiveSessionView(false);
    fetchItems(); // Refresh inventory list
  };

  // Handle product detail view
  const handleViewProduct = (model: string) => {
    setSelectedModel(model);
    setProductDetailOpen(true);
  };

  // Get unique sub-inventories for filter
  const uniqueSubInventories = useMemo(() => {
    const subs = [...new Set(items.map(item => item.sub_inventory))].filter(Boolean);
    return subs.sort();
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchTerm ||
        item.cso.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_type.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesInventoryType = inventoryTypeFilter === 'all' || item.inventory_type === inventoryTypeFilter;
      const matchesSubInventory = subInventoryFilter === 'all' || item.sub_inventory === subInventoryFilter;
      const matchesScanned =
        scannedFilter === 'all' ||
        (scannedFilter === 'scanned' && item.is_scanned) ||
        (scannedFilter === 'pending' && !item.is_scanned);

      return matchesSearch && matchesInventoryType && matchesSubInventory && matchesScanned;
    });
  }, [items, searchTerm, inventoryTypeFilter, subInventoryFilter, scannedFilter]);

  // Show session view if active
  if (activeSessionView) {
    return <ScanningSessionView onExit={handleSessionExit} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading inventory...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button size="sm" onClick={() => setCreateSessionOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search CSO, Serial, Model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Selects */}
          <div className="grid grid-cols-2 gap-2">
            <Select value={inventoryTypeFilter} onValueChange={(value: any) => setInventoryTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ASIS">ASIS</SelectItem>
                <SelectItem value="BackHaul">Back Haul</SelectItem>
                <SelectItem value="Salvage">Salvage</SelectItem>
                <SelectItem value="Staged">Staged</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
                <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                <SelectItem value="LocalStock">Local Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scannedFilter} onValueChange={(value: any) => setScannedFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="scanned">Scanned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {uniqueSubInventories.length > 0 && (
            <Select value={subInventoryFilter} onValueChange={setSubInventoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Routes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routes</SelectItem>
                {uniqueSubInventories.map(sub => (
                  <SelectItem key={sub} value={sub!}>{sub}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Item List */}
      <div className="p-4 pb-24">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {items.length === 0
              ? 'No inventory items. Upload a CSV to get started.'
              : 'No items match your filters.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map(item => (
              <Card key={item.id} className={`p-4 ${item.is_scanned ? 'bg-green-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {item.is_scanned ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300" />
                      )}
                      <span className="font-semibold text-gray-900">{item.product_type}</span>
                      <Badge variant="secondary" className="ml-auto">{item.inventory_type}</Badge>
                    </div>

                    {/* Product details from catalog */}
                    {item.products && (
                      <div className="ml-7 mb-2">
                        {item.products.brand && (
                          <Badge variant="outline" className="mr-2 text-xs">
                            {item.products.brand}
                          </Badge>
                        )}
                        {item.products.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {item.products.description}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm ml-7">
                      <div>
                        <span className="text-gray-500">CSO:</span>{' '}
                        <span className="font-mono">{item.cso}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Serial:</span>{' '}
                        <span className="font-mono">{item.serial || '-'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Model:</span>{' '}
                        <button
                          onClick={() => handleViewProduct(item.model)}
                          className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        >
                          {item.model}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                      {item.sub_inventory && (
                        <div>
                          <span className="text-gray-500">Route:</span>{' '}
                          <span className="font-mono">{item.sub_inventory}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* CSV Upload */}
      <CSVUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={fetchItems}
      />

      {/* Create Session Dialog */}
      <CreateSessionDialog
        open={createSessionOpen}
        onOpenChange={setCreateSessionOpen}
        onSessionCreated={handleSessionCreated}
      />

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        open={productDetailOpen}
        onOpenChange={setProductDetailOpen}
        modelNumber={selectedModel}
      />
    </div>
  );
}
