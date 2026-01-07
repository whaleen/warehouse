import { useState, useEffect, useMemo } from "react";
import supabase from "@/lib/supabase";
import type { Truck } from "@/types/deliveries";
import { TruckCard } from "./TruckCard";
import { TruckEditDialog } from "./TruckEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Loader2, Plus, Search, Filter } from "lucide-react";

export function TruckProfileView() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [deliveryCounts, setDeliveryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch trucks from Supabase
  const fetchTrucks = async () => {
    try {
      const { data, error } = await supabase
        .from('trucks')
        .select('*')
        .order('truck_id', { ascending: true });

      if (error) {
        console.error('Error fetching trucks:', error);
      } else {
        setTrucks(data || []);
      }
    } catch (error) {
      console.error('Error fetching trucks:', error);
    }
  };

  // Fetch delivery counts for each truck
  const fetchDeliveryCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('truck_fk, count(*)')
        .not('truck_fk', 'is', null);

      if (error) {
        console.error('Error fetching delivery counts:', error);
      } else {
        const counts: Record<string, number> = {};
        data?.forEach((item: any) => {
          counts[item.truck_fk] = item.count;
        });
        setDeliveryCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching delivery counts:', error);
    }
  };

  const fetchData = async () => {
    await Promise.all([fetchTrucks(), fetchDeliveryCounts()]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Handle truck save
  const handleSaveTruck = async (truckData: Truck) => {
    try {
      if (truckData.id) {
        // Update existing truck
        const { error } = await supabase
          .from('trucks')
          .update({
            abbreviated_name: truckData.abbreviated_name,
            color: truckData.color,
            driver_name: truckData.driver_name,
            capacity: truckData.capacity,
            active: truckData.active
          })
          .eq('id', truckData.id);

        if (error) throw error;
      } else {
        // Create new truck
        const { error } = await supabase
          .from('trucks')
          .insert([truckData]);

        if (error) throw error;
      }

      await fetchTrucks();
    } catch (error) {
      console.error('Error saving truck:', error);
      throw error;
    }
  };

  // Get existing abbreviations for validation
  const existingAbbreviations = useMemo(() => 
    trucks.map(t => t.abbreviated_name).filter(Boolean) as string[],
    [trucks]
  );

  // Filter trucks
  const filteredTrucks = useMemo(() => {
    let filtered = trucks.filter(truck => {
      const matchesSearch = !searchTerm || 
        truck.truck_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.abbreviated_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.driver_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && truck.active) ||
        (statusFilter === 'inactive' && !truck.active) ||
        (statusFilter === 'no_abbreviation' && !truck.abbreviated_name);

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => a.truck_id.localeCompare(b.truck_id));
  }, [trucks, searchTerm, statusFilter]);

  const handleEditTruck = (truck: Truck) => {
    setEditingTruck(truck);
    setShowEditDialog(true);
  };

  const handleNewTruck = () => {
    setEditingTruck(null);
    setShowEditDialog(true);
  };

  const handleCloseDialog = () => {
    setShowEditDialog(false);
    setEditingTruck(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading trucks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Truck Profiles</h1>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleNewTruck}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Truck
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search trucks, abbreviations, drivers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trucks</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
            <SelectItem value="no_abbreviation">Missing Abbreviation</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-sm text-gray-600">
          Showing {filteredTrucks.length} of {trucks.length} trucks
        </div>
      </div>

      {/* Truck Cards */}
      <div className="p-4">
        {filteredTrucks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {trucks.length === 0 ? "No trucks found" : "No trucks match your filters"}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrucks.map(truck => (
              <TruckCard
                key={truck.id}
                truck={truck}
                onEdit={handleEditTruck}
                deliveryCount={deliveryCounts[truck.id!] || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <TruckEditDialog
        truck={editingTruck}
        isOpen={showEditDialog}
        onClose={handleCloseDialog}
        onSave={handleSaveTruck}
        existingAbbreviations={existingAbbreviations}
      />
    </div>
  );
}