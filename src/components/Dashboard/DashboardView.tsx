import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TruckIcon, PackageOpen, Clock, User, Activity } from 'lucide-react';
import supabase from '@/lib/supabase';
import { getAllLoads } from '@/lib/loadManager';
import type { InventoryItem, LoadMetadata } from '@/types/inventory';
import { AppHeader } from '@/components/Navigation/AppHeader';

interface DashboardViewProps {
  onSettingsClick: () => void;
}

interface LoadStats {
  asis: { active: number; total: number; items: number };
  fg: { active: number; total: number; items: number };
  localStock: { active: number; total: number; items: number };
}

export function DashboardView({ onSettingsClick }: DashboardViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loads, setLoads] = useState<LoadMetadata[]>([]);
  const [loadStats, setLoadStats] = useState<LoadStats>({
    asis: { active: 0, total: 0, items: 0 },
    fg: { active: 0, total: 0, items: 0 },
    localStock: { active: 0, total: 0, items: 0 },
  });
  const [loading, setLoading] = useState(true);

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
      // Fetch inventory items
      const { data: itemsData, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch all loads
      const { data: loadsData } = await getAllLoads();
      if (loadsData) {
        setLoads(loadsData);

        // Calculate load stats
        const stats: LoadStats = {
          asis: { active: 0, total: 0, items: 0 },
          fg: { active: 0, total: 0, items: 0 },
          localStock: { active: 0, total: 0, items: 0 },
        };

        loadsData.forEach((load) => {
          if (load.inventory_type === 'ASIS') {
            stats.asis.total++;
            if (load.status === 'active') stats.asis.active++;
          } else if (load.inventory_type === 'FG' || load.inventory_type === 'BackHaul') {
            stats.fg.total++;
            if (load.status === 'active') stats.fg.active++;
          } else if (
            load.inventory_type === 'LocalStock' ||
            load.inventory_type === 'Staged' ||
            load.inventory_type === 'Inbound' ||
            load.inventory_type === 'WillCall'
          ) {
            stats.localStock.total++;
            if (load.status === 'active') stats.localStock.active++;
          }
        });

        // Count items in each type
        (itemsData || []).forEach((item) => {
          if (item.sub_inventory) {
            if (item.inventory_type === 'ASIS') {
              stats.asis.items++;
            } else if (item.inventory_type === 'FG' || item.inventory_type === 'BackHaul') {
              stats.fg.items++;
            } else if (
              item.inventory_type === 'LocalStock' ||
              item.inventory_type === 'Staged' ||
              item.inventory_type === 'Inbound' ||
              item.inventory_type === 'WillCall'
            ) {
              stats.localStock.items++;
            }
          }
        });

        setLoadStats(stats);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate inventory breakdown
  const inventoryByType = {
    ASIS: items.filter((i) => i.inventory_type === 'ASIS').length,
    FG: items.filter((i) => i.inventory_type === 'FG' || i.inventory_type === 'BackHaul').length,
    LocalStock: items.filter(
      (i) =>
        i.inventory_type === 'LocalStock' ||
        i.inventory_type === 'Staged' ||
        i.inventory_type === 'Inbound' ||
        i.inventory_type === 'WillCall'
    ).length,
    Parts: items.filter((i) => i.inventory_type === 'Parts').length,
  };

  const totalItems = items.length;
  const itemsInLoads = items.filter((i) => i.sub_inventory).length;
  const itemsWithoutLoad = totalItems - itemsInLoads;

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

      <div className="p-4 space-y-6">
        {/* User Welcome Section */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <User className="h-6 w-6 text-primary" />
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
              {loads.filter((l) => l.status === 'active').length} Active Loads
            </Badge>
          </div>
        </Card>

        {/* Load Statistics */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Load Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ASIS Loads */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold">ASIS Loads</h3>
                </div>
                <Badge variant="secondary">{loadStats.asis.total} Total</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Loads</span>
                  <span className="font-medium">{loadStats.asis.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items in Loads</span>
                  <span className="font-medium">{loadStats.asis.items}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${loadStats.asis.total > 0 ? (loadStats.asis.active / loadStats.asis.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </Card>

            {/* FG Loads */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TruckIcon className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold">FG Loads</h3>
                </div>
                <Badge variant="secondary">{loadStats.fg.total} Total</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Loads</span>
                  <span className="font-medium">{loadStats.fg.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items in Loads</span>
                  <span className="font-medium">{loadStats.fg.items}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${loadStats.fg.total > 0 ? (loadStats.fg.active / loadStats.fg.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </Card>

            {/* Local Stock Loads */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PackageOpen className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">Local Stock</h3>
                </div>
                <Badge variant="secondary">{loadStats.localStock.total} Total</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Loads</span>
                  <span className="font-medium">{loadStats.localStock.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items in Loads</span>
                  <span className="font-medium">{loadStats.localStock.items}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${loadStats.localStock.total > 0 ? (loadStats.localStock.active / loadStats.localStock.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inventory Summary */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Inventory Summary</h2>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b">
                  <span className="font-medium">Total Items</span>
                  <span className="text-2xl font-bold">{totalItems}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-red-500" />
                      <span className="text-sm">ASIS</span>
                    </div>
                    <span className="font-medium">{inventoryByType.ASIS}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-purple-500" />
                      <span className="text-sm">FG</span>
                    </div>
                    <span className="font-medium">{inventoryByType.FG}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      <span className="text-sm">Local Stock</span>
                    </div>
                    <span className="font-medium">{inventoryByType.LocalStock}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-teal-500" />
                      <span className="text-sm">Parts</span>
                    </div>
                    <span className="font-medium">{inventoryByType.Parts}</span>
                  </div>
                </div>
                <div className="pt-3 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items in Loads</span>
                    <span className="font-medium text-green-600">{itemsInLoads}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items Without Load</span>
                    <span className="font-medium text-orange-600">{itemsWithoutLoad}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Activity */}
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
        </div>
      </div>
    </div>
  );
}
