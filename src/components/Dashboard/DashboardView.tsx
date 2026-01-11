import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, TruckIcon, PackageOpen, Clock, User, Activity, ScanBarcode, ArrowRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import supabase from '@/lib/supabase';
import { getAllLoads } from '@/lib/loadManager';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { useAuth } from '@/context/AuthContext';

interface DashboardViewProps {
  onSettingsClick: () => void;
  onViewChange?: (view: 'dashboard' | 'inventory' | 'products' | 'settings' | 'loads') => void;
}

interface DetailedStats {
  totalItems: number;

  localStock: {
    total: number;
    unassigned: number;
    staged: number;
    inbound: number;
    routes: number;
  };

  fg: {
    total: number;
    regular: number;
    backhaul: number;
  };

  asis: {
    total: number;
    unassigned: number;
    regular: number;
    salvage: number;
    scrap: number;
  };

  loads: {
    total: number;
    active: number;
    byType: {
      localStock: number;
      fg: number;
      asis: number;
    };
  };
}

export function DashboardView({ onSettingsClick, onViewChange }: DashboardViewProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DetailedStats>({
    totalItems: 0,
    localStock: { total: 0, unassigned: 0, staged: 0, inbound: 0, routes: 0 },
    fg: { total: 0, regular: 0, backhaul: 0 },
    asis: { total: 0, unassigned: 0, regular: 0, salvage: 0, scrap: 0 },
    loads: { total: 0, active: 0, byType: { localStock: 0, fg: 0, asis: 0 } },
  });
  const [loading, setLoading] = useState(true);
  const [selectedChartType, setSelectedChartType] = useState<'overview' | 'LocalStock' | 'FG' | 'ASIS'>('overview');
  const [selectedDrilldown, setSelectedDrilldown] = useState<string | null>(null);
  const [loadDetails, setLoadDetails] = useState<Record<string, { loadName: string; count: number; category?: string }[]>>({});

  // Helper to navigate to inventory with filter
  const navigateToInventory = (filterType?: 'LocalStock' | 'FG' | 'ASIS') => {
    if (filterType) {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'inventory');
      params.set('type', filterType);
      window.history.replaceState({}, '', `?${params.toString()}`);
    }
    onViewChange?.('inventory');
  };

  // Mock user - replace with actual auth later
  const currentUser = {
    name: 'Josh Vaage',
    role: 'Warehouse Manager',
    lastActive: new Date().toLocaleTimeString(),
  };

  // Mock recent activity
  const recentActivity = [
    { id: 1, action: 'Created load', target: 'LOAD-2026-01-09-A', type: 'ASIS', time: '10 minutes ago' },
    { id: 2, action: 'Moved 5 items to', target: 'Salvage Load B', type: 'ASIS', time: '25 minutes ago' },
    { id: 3, action: 'Updated status', target: 'ROUTE-CAP-001', type: 'Local Stock', time: '1 hour ago' },
    { id: 4, action: 'Scanned 12 items', target: 'Session #127', type: 'FG', time: '2 hours ago' },
    { id: 5, action: 'Merged loads', target: '3 Back Haul loads', type: 'FG', time: '3 hours ago' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch ALL inventory items in batches
      let allItems: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allItems = [...allItems, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const itemsData = allItems;

      // Fetch all loads
      const { data: loadsData } = await getAllLoads();

      // Calculate detailed stats
      const newStats: DetailedStats = {
        totalItems: (itemsData || []).length,
        localStock: { total: 0, unassigned: 0, staged: 0, inbound: 0, routes: 0 },
        fg: { total: 0, regular: 0, backhaul: 0 },
        asis: { total: 0, unassigned: 0, regular: 0, salvage: 0, scrap: 0 },
        loads: { total: loadsData?.length || 0, active: 0, byType: { localStock: 0, fg: 0, asis: 0 } },
      };

      // Build a map of load categories for quick lookup
      const loadCategoryMap = new Map<string, string>();
      (loadsData || []).forEach(load => {
        if (load.category && load.sub_inventory_name) {
          loadCategoryMap.set(load.sub_inventory_name, load.category);
        }
      });

      // Count all items
      (itemsData || []).forEach((item) => {
        // Local Stock (includes LocalStock, Staged, Inbound)
        if (item.inventory_type === 'LocalStock' || item.inventory_type === 'Staged' || item.inventory_type === 'Inbound') {
          newStats.localStock.total++;
          if (!item.sub_inventory) {
            newStats.localStock.unassigned++;
          } else {
            newStats.localStock.routes++;
          }
          if (item.inventory_type === 'Staged') newStats.localStock.staged++;
          if (item.inventory_type === 'Inbound') newStats.localStock.inbound++;
        }
        // FG (includes FG and BackHaul)
        else if (item.inventory_type === 'FG') {
          newStats.fg.total++;
          newStats.fg.regular++;
        }
        else if (item.inventory_type === 'BackHaul') {
          newStats.fg.total++;
          newStats.fg.backhaul++;
        }
        // ASIS
        else if (item.inventory_type === 'ASIS') {
          newStats.asis.total++;

          if (!item.sub_inventory) {
            // No load assigned
            newStats.asis.unassigned++;
          } else {
            // In a load - categorize by load category
            const category = loadCategoryMap.get(item.sub_inventory);
            if (category === 'Regular') {
              newStats.asis.regular++;
            } else if (category === 'Salvage') {
              newStats.asis.salvage++;
            } else if (category === 'Scrap') {
              newStats.asis.scrap++;
            }
          }
        }
      });

      // Count loads by type and collect load details
      const loadsByCategory: Record<string, { loadName: string; count: number; category?: string }[]> = {
        'LocalStock-routes': [],
        'FG-backhaul': [],
        'ASIS-regular': [],
        'ASIS-salvage': [],
        'ASIS-scrap': [],
      };

      (loadsData || []).forEach((load) => {
        if (load.status === 'active') newStats.loads.active++;

        const itemsInLoad = (itemsData || []).filter(
          item => item.sub_inventory === load.sub_inventory_name
        ).length;

        if (load.inventory_type === 'ASIS') {
          newStats.loads.byType.asis++;
          if (load.category === 'Regular') {
            loadsByCategory['ASIS-regular'].push({
              loadName: load.sub_inventory_name,
              count: itemsInLoad,
              category: load.category
            });
          } else if (load.category === 'Salvage') {
            loadsByCategory['ASIS-salvage'].push({
              loadName: load.sub_inventory_name,
              count: itemsInLoad,
              category: load.category
            });
          } else if (load.category === 'Scrap') {
            loadsByCategory['ASIS-scrap'].push({
              loadName: load.sub_inventory_name,
              count: itemsInLoad,
              category: load.category
            });
          }
        } else if (load.inventory_type === 'BackHaul') {
          newStats.loads.byType.fg++;
          loadsByCategory['FG-backhaul'].push({
            loadName: load.sub_inventory_name,
            count: itemsInLoad
          });
        } else if (
          load.inventory_type === 'LocalStock' ||
          load.inventory_type === 'Staged' ||
          load.inventory_type === 'Inbound'
        ) {
          newStats.loads.byType.localStock++;
          loadsByCategory['LocalStock-routes'].push({
            loadName: load.sub_inventory_name,
            count: itemsInLoad
          });
        }
      });

      setStats(newStats);
      setLoadDetails(loadsByCategory);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    // Level 3: Individual loads within a category
    if (selectedDrilldown) {
      const loads = loadDetails[selectedDrilldown] || [];
      return loads.map((load, idx) => ({
        name: load.loadName,
        value: load.count,
        fill: `var(--color-chart-${(idx % 4) + 1})`,
      }));
    }

    // Level 2: Sub-inventories for a specific type
    if (selectedChartType === 'overview') {
      return [
        { name: 'Local Stock', value: stats.localStock.total, fill: 'var(--color-chart-1)' },
        { name: 'FG', value: stats.fg.total, fill: 'var(--color-chart-2)' },
        { name: 'ASIS', value: stats.asis.total, fill: 'var(--color-chart-3)' },
      ];
    } else if (selectedChartType === 'LocalStock') {
      return [
        { name: 'Unassigned', value: stats.localStock.unassigned, fill: 'var(--color-chart-1)' },
        { name: 'In Routes', value: stats.localStock.routes, fill: 'var(--color-chart-2)' },
        { name: 'Staged', value: stats.localStock.staged, fill: 'var(--color-chart-3)' },
      ];
    } else if (selectedChartType === 'FG') {
      return [
        { name: 'Regular FG', value: stats.fg.regular, fill: 'var(--color-chart-2)' },
        { name: 'BackHaul', value: stats.fg.backhaul, fill: 'var(--color-chart-3)' },
      ];
    } else if (selectedChartType === 'ASIS') {
      return [
        { name: 'Unassigned', value: stats.asis.unassigned, fill: 'var(--color-chart-3)' },
        { name: 'Regular', value: stats.asis.regular, fill: 'var(--color-chart-1)' },
        { name: 'Salvage', value: stats.asis.salvage, fill: 'var(--color-chart-2)' },
        { name: 'Scrap', value: stats.asis.scrap, fill: 'var(--color-chart-4)' },
      ];
    }
    return [];
  }, [stats, selectedChartType, selectedDrilldown, loadDetails]);

  const chartConfig = {
    value: {
      label: 'Items',
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Package className="h-6 w-6 animate-pulse" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Dashboard" onSettingsClick={onSettingsClick} />

      <div className="p-4 space-y-6 pb-24">
        {/* Welcome Header with Quick Stats */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Welcome back, {currentUser.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {currentUser.role} • Last active {currentUser.lastActive}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-sm">
                <Activity className="mr-2 h-3 w-3" />
                {stats.totalItems} Items
              </Badge>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigateToInventory()}>
                <ScanBarcode className="mr-2 h-4 w-4" />
                Start Scanning
              </Button>
              <Button size="sm" variant="outline" onClick={() => onViewChange?.('loads')}>
                <PackageOpen className="mr-2 h-4 w-4" />
                Manage Loads
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigateToInventory()}>
                <TruckIcon className="mr-2 h-4 w-4" />
                View Inventory
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Interactive Donut Chart */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {selectedDrilldown ?
                  `Load Details: ${selectedDrilldown.replace(/-/g, ' ')}` :
                  selectedChartType === 'overview' ? 'Inventory Distribution' :
                  selectedChartType === 'LocalStock' ? 'Local Stock Breakdown' :
                  selectedChartType === 'FG' ? 'FG Breakdown' : 'ASIS Breakdown'}
              </h2>
              {selectedDrilldown ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDrilldown(null)}
                >
                  ← Back to {selectedChartType}
                </Button>
              ) : selectedChartType !== 'overview' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChartType('overview')}
                >
                  ← Back to Overview
                </Button>
              ) : null}
            </div>

            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(data) => {
                      // Level 1: Overview -> drill to sub-inventories
                      if (selectedChartType === 'overview' && !selectedDrilldown) {
                        if (data.name === 'Local Stock') setSelectedChartType('LocalStock');
                        else if (data.name === 'FG') setSelectedChartType('FG');
                        else if (data.name === 'ASIS') setSelectedChartType('ASIS');
                      }
                      // Level 2: Sub-inventories -> drill to loads
                      else if (!selectedDrilldown) {
                        if (selectedChartType === 'LocalStock' && data.name === 'In Routes') {
                          setSelectedDrilldown('LocalStock-routes');
                        } else if (selectedChartType === 'FG' && data.name === 'BackHaul') {
                          setSelectedDrilldown('FG-backhaul');
                        } else if (selectedChartType === 'ASIS') {
                          if (data.name === 'Regular') setSelectedDrilldown('ASIS-regular');
                          else if (data.name === 'Salvage') setSelectedDrilldown('ASIS-salvage');
                          else if (data.name === 'Scrap') setSelectedDrilldown('ASIS-scrap');
                        }
                      }
                    }}
                    style={{ cursor: !selectedDrilldown ? 'pointer' : 'default' }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>

            {!selectedDrilldown && (
              <p className="text-sm text-muted-foreground text-center">
                Click on a segment to view detailed breakdown
              </p>
            )}
          </div>
        </Card>

        {/* Inventory Overview - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Local Stock Card */}
          <Card className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'oklch(var(--chart-1) / 0.1)' }}>
                    <PackageOpen className="h-5 w-5" style={{ color: 'oklch(var(--chart-1))' }} />
                  </div>
                  <h3 className="font-semibold">Local Stock</h3>
                </div>
                <span className="text-2xl font-bold">{stats.localStock.total}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unassigned</span>
                  <span className="font-medium">{stats.localStock.unassigned}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">In Routes</span>
                  <span className="font-medium">{stats.localStock.routes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staged</span>
                  <span className="font-medium">{stats.localStock.staged}</span>
                </div>
              </div>

              <Button size="sm" variant="outline" className="w-full" onClick={() => navigateToInventory('LocalStock')}>
                View Local Stock
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>

          {/* FG Card */}
          <Card className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'oklch(var(--chart-2) / 0.1)' }}>
                    <TruckIcon className="h-5 w-5" style={{ color: 'oklch(var(--chart-2))' }} />
                  </div>
                  <h3 className="font-semibold">FG</h3>
                </div>
                <span className="text-2xl font-bold">{stats.fg.total}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Regular FG</span>
                  <span className="font-medium">{stats.fg.regular}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BackHaul</span>
                  <span className="font-medium">{stats.fg.backhaul}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BackHaul Loads</span>
                  <span className="font-medium">{stats.loads.byType.fg}</span>
                </div>
              </div>

              <Button size="sm" variant="outline" className="w-full" onClick={() => navigateToInventory('FG')}>
                View FG
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>

          {/* ASIS Card */}
          <Card className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'oklch(var(--chart-3) / 0.1)' }}>
                    <Package className="h-5 w-5" style={{ color: 'oklch(var(--chart-3))' }} />
                  </div>
                  <h3 className="font-semibold">ASIS</h3>
                </div>
                <span className="text-2xl font-bold">{stats.asis.total}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unassigned</span>
                  <span className="font-medium">{stats.asis.unassigned}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Regular Loads</span>
                  <span className="font-medium">{stats.asis.regular}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salvage</span>
                  <span className="font-medium">{stats.asis.salvage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scrap</span>
                  <span className="font-medium">{stats.asis.scrap}</span>
                </div>
              </div>

              <Button size="sm" variant="outline" className="w-full" onClick={() => navigateToInventory('ASIS')}>
                View ASIS
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Load Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Load Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Loads</p>
                <p className="text-3xl font-bold">{stats.loads.total}</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Active Loads</p>
                <p className="text-3xl font-bold">{stats.loads.active}</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Route Loads</p>
                <p className="text-3xl font-bold">{stats.loads.byType.localStock}</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">ASIS Loads</p>
                <p className="text-3xl font-bold">{stats.loads.byType.asis}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Activity & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
            <Card className="p-4">
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 last:pb-0 border-b last:border-0">
                    <div className="p-2 bg-muted rounded-lg mt-0.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.action}</span>{' '}
                        <span className="text-muted-foreground">{activity.target}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {activity.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <Card className="p-4">
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={() => navigateToInventory()}>
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  Start New Scanning Session
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => onViewChange?.('loads')}>
                  <PackageOpen className="mr-2 h-4 w-4" />
                  Manage Loads
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigateToInventory()}>
                  <TruckIcon className="mr-2 h-4 w-4" />
                  View All Inventory
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => onViewChange?.('products')}>
                  <Package className="mr-2 h-4 w-4" />
                  Product Catalog
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
