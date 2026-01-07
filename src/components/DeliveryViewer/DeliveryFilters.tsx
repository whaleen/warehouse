import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, X, SortAsc, SortDesc } from "lucide-react";
import { ViewToggle, type ViewMode } from "./ViewToggle";

import type { Truck } from "@/types/deliveries";

interface DeliveryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  truckFilter: string;
  onTruckFilterChange: (value: string) => void;
  productTypeFilter: string;
  onProductTypeFilterChange: (value: string) => void;
  scannedFilter: string;
  onScannedFilterChange: (value: string) => void;
  lifecycleFilter: string;
  onLifecycleFilterChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (value: 'asc' | 'desc') => void;
  onClearFilters: () => void;
  trucks: Truck[];
  statuses: string[];
  productTypes: string[];
  totalResults: number;
  filteredResults: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function DeliveryFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  truckFilter,
  onTruckFilterChange,
  productTypeFilter,
  onProductTypeFilterChange,
  scannedFilter,
  onScannedFilterChange,
  lifecycleFilter,
  onLifecycleFilterChange,
  sortBy,
  onSortChange,
  sortOrder,
  onSortOrderChange,
  onClearFilters,
  trucks,
  statuses,
  productTypes,
  totalResults,
  filteredResults,
  viewMode,
  onViewModeChange
}: DeliveryFiltersProps) {
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || truckFilter !== 'all' || 
                          productTypeFilter !== 'all' || scannedFilter !== 'all' || 
                          lifecycleFilter !== 'all';

  return (
    <div className="space-y-4 bg-white p-4 border-b border-gray-200 sticky top-0 z-10">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search customer, CSO, serial..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters Row 1 */}
      <div className="grid grid-cols-2 gap-2">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.filter(status => status && status.trim() !== '').map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={truckFilter} onValueChange={onTruckFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Truck" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trucks</SelectItem>
            {trucks.map(truck => (
              <SelectItem key={truck.id || truck.truck_id} value={truck.truck_id}>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full border"
                    style={{ 
                      backgroundColor: truck.color || '#3B82F6',
                      borderColor: truck.color || '#3B82F6'
                    }}
                  />
                  <span>{truck.truck_id}</span>
                  {truck.abbreviated_name && (
                    <span 
                      className="text-xs px-1.5 py-0.5 rounded text-white font-bold"
                      style={{ backgroundColor: truck.color || '#3B82F6' }}
                    >
                      {truck.abbreviated_name}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filters Row 2 */}
      <div className="grid grid-cols-2 gap-2">
        <Select value={productTypeFilter} onValueChange={onProductTypeFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Product Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {productTypes.filter(type => type && type.trim() !== '').map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={lifecycleFilter} onValueChange={onLifecycleFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Lifecycle Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="scanned_only">Scanned Only</SelectItem>
            <SelectItem value="marked_only">Marked for Truck</SelectItem>
            <SelectItem value="staged">Staged</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center space-x-2">
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="truck_id">Truck</SelectItem>
            <SelectItem value="stop">Stop</SelectItem>
            <SelectItem value="consumer_customer_name">Customer</SelectItem>
            <SelectItem value="product_type">Product Type</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="scanned">Scanned</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="flex-shrink-0"
        >
          {sortOrder === 'asc' ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Results Summary, View Toggle & Clear Filters */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {filteredResults} of {totalResults} deliveries
        </div>
        
        <div className="flex items-center space-x-3">
          <ViewToggle 
            currentView={viewMode} 
            onViewChange={onViewModeChange}
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1">
          {searchTerm && (
            <Badge variant="secondary" className="text-xs">
              Search: {searchTerm}
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Status: {statusFilter}
            </Badge>
          )}
          {truckFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Truck: {truckFilter}
            </Badge>
          )}
          {productTypeFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Product: {productTypeFilter}
            </Badge>
          )}
          {lifecycleFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Stage: {lifecycleFilter.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}