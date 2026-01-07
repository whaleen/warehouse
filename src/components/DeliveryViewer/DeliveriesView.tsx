import { useState, useEffect, useMemo } from "react";
import supabase from "@/lib/supabase";
import type { Delivery } from "@/types/deliveries";
import { DeliveryCard } from "./DeliveryCard";
import { DeliveryCardCompact } from "./DeliveryCardCompact";
import { DeliveryFilters } from "./DeliveryFilters";
import type { ViewMode } from "./ViewToggle";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

export function DeliveriesView() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [truckFilter, setTruckFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [scannedFilter, setScannedFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Fetch deliveries from Supabase with joined data
  const fetchDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          trucks (
            id,
            truck_id,
            abbreviated_name,
            color,
            driver_name,
            capacity,
            active
          ),
          customers (
            id,
            customer_name,
            address,
            phone,
            email
          ),
          products (
            id,
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
        console.error('Error fetching deliveries:', error);
      } else {
        setDeliveries(data || []);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  // Handle scanned status change
  const handleScannedChange = async (id: string, scanned: boolean) => {
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ scanned })
        .eq('id', id);

      if (error) {
        console.error('Error updating scanned status:', error);
      } else {
        // Update local state
        setDeliveries(prev => 
          prev.map(delivery => 
            delivery.id === id ? { ...delivery, scanned } : delivery
          )
        );
      }
    } catch (error) {
      console.error('Error updating scanned status:', error);
    }
  };

  // Handle status updates for the 3-stage lifecycle
  const handleStatusUpdate = async (id: string, field: 'scanned' | 'marked_for_truck' | 'staged', value: boolean) => {
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ [field]: value })
        .eq('id', id);

      if (error) {
        console.error(`Error updating ${field} status:`, error);
      } else {
        // Update local state
        setDeliveries(prev => 
          prev.map(delivery => 
            delivery.id === id ? { ...delivery, [field]: value } : delivery
          )
        );
      }
    } catch (error) {
      console.error(`Error updating ${field} status:`, error);
    }
  };

  // Get unique trucks for filters
  const uniqueTrucks = useMemo(() => {
    const trucksMap = new Map();
    deliveries.forEach(d => {
      if (d.trucks) {
        trucksMap.set(d.trucks.truck_id, d.trucks);
      } else if (d.truck_id) {
        // Fallback for deliveries without joined truck data
        trucksMap.set(d.truck_id, { truck_id: d.truck_id });
      }
    });
    return Array.from(trucksMap.values()).sort((a, b) => a.truck_id.localeCompare(b.truck_id));
  }, [deliveries]);

  const uniqueStatuses = useMemo(() => 
    [...new Set(deliveries.map(d => d.status))].filter(Boolean).sort(),
    [deliveries]
  );

  const uniqueProductTypes = useMemo(() => 
    [...new Set(deliveries.map(d => d.products?.product_type || d.product_type))].filter(Boolean).sort(),
    [deliveries]
  );

  // Filter and sort deliveries
  const filteredDeliveries = useMemo(() => {
    let filtered = deliveries.filter(delivery => {
      const customerName = delivery.customers?.customer_name || delivery.consumer_customer_name;
      const productModel = delivery.products?.model || delivery.model;
      const truckId = delivery.trucks?.truck_id || delivery.truck_id;
      const productType = delivery.products?.product_type || delivery.product_type;

      const matchesSearch = !searchTerm || 
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.cso.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        productModel.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || delivery.status === statusFilter;
      const matchesTruck = truckFilter === 'all' || truckId === truckFilter;
      const matchesProductType = productTypeFilter === 'all' || productType === productTypeFilter;
      const matchesScanned = scannedFilter === 'all' || 
        (scannedFilter === 'true' && delivery.scanned) ||
        (scannedFilter === 'false' && !delivery.scanned);

      const matchesLifecycle = lifecycleFilter === 'all' ||
        (lifecycleFilter === 'not_started' && !delivery.scanned && !delivery.marked_for_truck && !delivery.staged) ||
        (lifecycleFilter === 'scanned_only' && delivery.scanned && !delivery.marked_for_truck && !delivery.staged) ||
        (lifecycleFilter === 'marked_only' && delivery.marked_for_truck && !delivery.staged) ||
        (lifecycleFilter === 'staged' && delivery.staged) ||
        (lifecycleFilter === 'incomplete' && !delivery.staged);

      return matchesSearch && matchesStatus && matchesTruck && matchesProductType && matchesScanned && matchesLifecycle;
    });

    // Sort deliveries
    filtered.sort((a, b) => {
      let aValue = a[sortBy as keyof Delivery];
      let bValue = b[sortBy as keyof Delivery];

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [deliveries, searchTerm, statusFilter, truckFilter, productTypeFilter, scannedFilter, lifecycleFilter, sortBy, sortOrder]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTruckFilter("all");
    setProductTypeFilter("all");
    setScannedFilter("all");
    setLifecycleFilter("all");
    setSortBy("date");
    setSortOrder("desc");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading deliveries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Deliveries</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DeliveryFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        truckFilter={truckFilter}
        onTruckFilterChange={setTruckFilter}
        productTypeFilter={productTypeFilter}
        onProductTypeFilterChange={setProductTypeFilter}
        scannedFilter={scannedFilter}
        onScannedFilterChange={setScannedFilter}
        lifecycleFilter={lifecycleFilter}
        onLifecycleFilterChange={setLifecycleFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onClearFilters={clearFilters}
        trucks={uniqueTrucks}
        statuses={uniqueStatuses}
        productTypes={uniqueProductTypes}
        totalResults={deliveries.length}
        filteredResults={filteredDeliveries.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Delivery Cards */}
      <div className="p-4">
        {filteredDeliveries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {deliveries.length === 0 ? "No deliveries found" : "No deliveries match your filters"}
            </div>
          </div>
        ) : (
          <div className={
            viewMode === 'list' 
              ? "space-y-3"
              : viewMode === 'compact'
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
          }>
            {filteredDeliveries.map(delivery => (
              viewMode === 'list' ? (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  onScannedChange={handleScannedChange}
                  onStatusUpdate={handleStatusUpdate}
                />
              ) : (
                <DeliveryCardCompact
                  key={delivery.id}
                  delivery={delivery}
                  onStatusUpdate={handleStatusUpdate}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}