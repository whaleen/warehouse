import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Package, Layers, Grid3x3, Box, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import supabase from '@/lib/supabase';
import type { InventoryItem } from '@/types/inventory';

const INVENTORY_TYPE_COLORS: Record<string, string> = {
  ASIS: '#EF4444',
  BackHaul: '#F59E0B',
  Salvage: '#6B7280',
  Staged: '#3B82F6',
  Inbound: '#10B981',
  FG: '#8B5CF6',
  LocalStock: '#EC4899'
};

const PRODUCT_TYPE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6'
];

export function DashboardView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*');

      if (error) {
        console.error('Error fetching inventory:', error);
      } else {
        setItems(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Calculate statistics
  const totalItems = items.length;
  const inventoryTypes = new Set(items.map(item => item.inventory_type)).size;
  const productTypes = new Set(items.map(item => item.product_type)).size;
  const uniqueModels = new Set(items.map(item => item.model)).size;

  // Inventory type distribution
  const inventoryTypeData = Object.entries(
    items.reduce((acc, item) => {
      const type = item.inventory_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Product type distribution
  const productTypeData = Object.entries(
    items.reduce((acc, item) => {
      const type = item.product_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10 product types
    .map(([name, value]) => ({ name, value }));

  // Status distribution
  const statusData = Object.entries(
    items.reduce((acc, item) => {
      const status = item.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
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

      <div className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{totalItems}</div>
                <div className="text-xs text-muted-foreground">Total Items</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{inventoryTypes}</div>
                <div className="text-xs text-muted-foreground">Inventory Types</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Grid3x3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{productTypes}</div>
                <div className="text-xs text-muted-foreground">Product Types</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{uniqueModels}</div>
                <div className="text-xs text-muted-foreground">Unique Models</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inventory Type Distribution */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Inventory by Type</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={inventoryTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {inventoryTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INVENTORY_TYPE_COLORS[entry.name] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Product Type Distribution */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Top Product Types</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6">
                  {productTypeData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRODUCT_TYPE_COLORS[index % PRODUCT_TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Distribution */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Items by Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Inventory Type Breakdown Table */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Inventory Breakdown</h2>
            <div className="space-y-2">
              {inventoryTypeData
                .sort((a, b) => b.value - a.value)
                .map((item) => {
                  const percentage = totalItems > 0 ? Math.round((item.value / totalItems) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: INVENTORY_TYPE_COLORS[item.name] || '#6B7280' }}
                        />
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{item.value} items</span>
                        <span className="text-sm font-semibold text-foreground w-12 text-right">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>

        {/* Product Types Table */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">All Product Types</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(
              items.reduce((acc, item) => {
                const type = item.product_type || 'Unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            )
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="bg-muted rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">{type}</div>
                  <div className="text-xl font-bold text-foreground">{count}</div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
