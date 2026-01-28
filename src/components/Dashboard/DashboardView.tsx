import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, TruckIcon, PackageOpen, User, ScanBarcode, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import supabase from '@/lib/supabase';
import { useLoads } from '@/hooks/queries/useLoads';
import { useActivityRealtime } from '@/hooks/queries/useRealtimeSync';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { ReorderAlertsCard } from './ReorderAlertsCard';
import { useAuth } from '@/context/AuthContext';
import { PageContainer } from '@/components/Layout/PageContainer';
import { getPathForView } from '@/lib/routes';
import type { AppView } from '@/lib/routes';
import { getActiveLocationContext } from '@/lib/tenant';

interface DashboardViewProps {
  onViewChange?: (view: AppView) => void;
  onMenuClick?: () => void;
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

  asisLoads: {
    total: number;
    forSale: number;
    sold: number;
    forSaleNeedsWrap: number;
    soldNeedsTag: number;
    soldNeedsWrap: number;
    soldNeedsBoth: number;
    pickupSoonNeedsPrep: number;
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

type AsisActionLoad = {
  id?: string;
  sub_inventory_name: string;
  friendly_name?: string | null;
  primary_color?: string | null;
  ge_cso?: string | null;
  ge_source_status?: string | null;
  pickup_date?: string | null;
  prep_tagged?: boolean | null;
  prep_wrapped?: boolean | null;
  sanity_check_requested?: boolean | null;
  conflict_count?: number | null;
};

type ActivityLogEntry = {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, any> | null;
  actor_name?: string | null;
  actor_image?: string | null;
  created_at: string;
};

export function DashboardView({ onViewChange, onMenuClick }: DashboardViewProps) {
  const { user } = useAuth();
  const { locationId } = getActiveLocationContext();
  const userDisplayName = user?.username ?? user?.email ?? "User";

  const { data: loadsData } = useLoads();
  useActivityRealtime();

  const [stats, setStats] = useState<DetailedStats>({
    totalItems: 0,
    localStock: { total: 0, unassigned: 0, staged: 0, inbound: 0, routes: 0 },
    fg: { total: 0, regular: 0, backhaul: 0 },
    asis: { total: 0, unassigned: 0, regular: 0, salvage: 0, scrap: 0 },
    asisLoads: {
      total: 0,
      forSale: 0,
      sold: 0,
      forSaleNeedsWrap: 0,
      soldNeedsTag: 0,
      soldNeedsWrap: 0,
      soldNeedsBoth: 0,
      pickupSoonNeedsPrep: 0,
    },
    loads: { total: 0, active: 0, byType: { localStock: 0, fg: 0, asis: 0 } },
  });
  const [loading, setLoading] = useState(true);
  const [selectedChartType, setSelectedChartType] = useState<'overview' | 'LocalStock' | 'FG' | 'ASIS'>('overview');
  const [selectedDrilldown, setSelectedDrilldown] = useState<string | null>(null);
  const [loadDetails, setLoadDetails] = useState<Record<string, { loadName: string; count: number; category?: string }[]>>({});
  const [asisActionLoads, setAsisActionLoads] = useState<{
    forSaleNeedsWrap: AsisActionLoad[];
    soldNeedsPrep: AsisActionLoad[];
    sanityCheckRequested: AsisActionLoad[];
    pickupSoonNeedsPrep: AsisActionLoad[];
  }>({
    forSaleNeedsWrap: [],
    soldNeedsPrep: [],
    sanityCheckRequested: [],
    pickupSoonNeedsPrep: [],
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  // const [isCompact, setIsCompact] = useState(false);

  // Helper to navigate to inventory with filter
  const navigateToInventory = (filterType?: 'LocalStock' | 'FG' | 'ASIS' | 'Parts') => {
    if (filterType) {
      const params = new URLSearchParams(window.location.search);
      params.set('type', filterType);
      params.delete('view');
      const path = getPathForView('inventory');
      const newUrl = params.toString() ? `${path}?${params.toString()}` : path;
      window.history.replaceState({}, '', newUrl);
      window.dispatchEvent(new Event('app:locationchange'));
    }
    onViewChange?.('inventory');
  };

  // Helper to navigate to Parts inventory
  const navigateToPartsInventory = (status?: 'reorder') => {
    const params = new URLSearchParams(window.location.search);
    params.set('type', 'Parts');
    params.set('partsTab', 'inventory');
    params.delete('view');
    if (status === 'reorder') {
      params.set('partsStatus', 'reorder');
    } else {
      params.delete('partsStatus');
    }
    const path = getPathForView('inventory');
    const newUrl = params.toString() ? `${path}?${params.toString()}` : path;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
    onViewChange?.('inventory');
  };

  const navigateToLoad = (loadNumber: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    params.delete('load');
    params.set('from', 'dashboard');
    const path = `${getPathForView('loads')}/${encodeURIComponent(loadNumber)}`;
    const newUrl = params.toString() ? `${path}?${params.toString()}` : path;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
  };

  const navigateToActivity = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    const path = getPathForView('activity');
    const newUrl = params.toString() ? `${path}?${params.toString()}` : path;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
    onViewChange?.('activity');
  };

  // Mock user - replace with actual auth later
  const currentUser = {
    name: 'Josh Vaage',
    role: 'Warehouse Floor',
    lastActive: new Date().toLocaleTimeString(),
  };


  useEffect(() => {
    if (loadsData) {
      fetchData(loadsData);
    }
  }, [locationId, loadsData]);

  // useEffect(() => {
  //   const updateLayout = () => {
  //     setIsCompact(window.innerWidth < 640);
  //   };
  //   updateLayout();
  //   window.addEventListener('resize', updateLayout);
  //   return () => window.removeEventListener('resize', updateLayout);
  // }, []);

  useEffect(() => {
    if (!locationId) return;
    const channel = supabase
      .channel(`activity-log-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          const entry = payload.new as ActivityLogEntry;
          setActivityLogs((prev) => {
            if (prev.some((item) => item.id === entry.id)) return prev;
            const next = [entry, ...prev];
            return next.slice(0, 20);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId]);

  const fetchData = async (baseLoadsData: any[]) => {
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
          .eq('location_id', locationId)
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

      // Get conflicts
      const { data: conflictsData } = await supabase
        .from('load_conflicts')
        .select('load_number')
        .eq('location_id', locationId)
        .eq('status', 'open');

      const conflictCountMap = new Map<string, number>();
      (conflictsData ?? []).forEach((row) => {
        if (!row?.load_number) return;
        conflictCountMap.set(row.load_number, (conflictCountMap.get(row.load_number) ?? 0) + 1);
      });

      const loads = (baseLoadsData ?? []).map((load) => ({
        ...load,
        conflict_count: conflictCountMap.get(load.sub_inventory_name) ?? 0,
      }));

      // Calculate detailed stats
      const newStats: DetailedStats = {
        totalItems: (itemsData || []).length,
        localStock: { total: 0, unassigned: 0, staged: 0, inbound: 0, routes: 0 },
        fg: { total: 0, regular: 0, backhaul: 0 },
        asis: { total: 0, unassigned: 0, regular: 0, salvage: 0, scrap: 0 },
        asisLoads: {
          total: 0,
          forSale: 0,
          sold: 0,
          forSaleNeedsWrap: 0,
          soldNeedsTag: 0,
          soldNeedsWrap: 0,
          soldNeedsBoth: 0,
          pickupSoonNeedsPrep: 0,
        },
        loads: { total: loads.length || 0, active: 0, byType: { localStock: 0, fg: 0, asis: 0 } },
      };

      // Build a map of load categories for quick lookup
      const loadCategoryMap = new Map<string, string>();
      loads.forEach(load => {
        if (load.category && load.sub_inventory_name) {
          loadCategoryMap.set(load.sub_inventory_name, load.category);
        }
      });

      // Count all items
      (itemsData || []).forEach((item) => {
        // Local Stock (includes LocalStock, Staged, Inbound)
        if (item.inventory_type === 'LocalStock' || item.inventory_type === 'Staged' || item.inventory_type === 'STA' || item.inventory_type === 'Inbound') {
          newStats.localStock.total++;
          if (!item.sub_inventory) {
            newStats.localStock.unassigned++;
          } else {
            newStats.localStock.routes++;
          }
          if (item.inventory_type === 'Staged' || item.inventory_type === 'STA') newStats.localStock.staged++;
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
      const now = new Date();
      const pickupSoonThreshold = new Date(now);
      pickupSoonThreshold.setDate(pickupSoonThreshold.getDate() + 3);
      const normalizeStatus = (value?: string | null) => value?.toLowerCase().trim() ?? '';

      const loadsByCategory: Record<string, { loadName: string; count: number; category?: string }[]> = {
        'LocalStock-routes': [],
        'FG-backhaul': [],
        'ASIS-regular': [],
        'ASIS-salvage': [],
        'ASIS-scrap': [],
      };
      const nextAsisActions = {
        forSaleNeedsWrap: [] as AsisActionLoad[],
        soldNeedsPrep: [] as AsisActionLoad[],
        sanityCheckRequested: [] as AsisActionLoad[],
        pickupSoonNeedsPrep: [] as AsisActionLoad[],
      };

      loads.forEach((load) => {
        if (load.status === 'active') newStats.loads.active++;

        const itemsInLoad = (itemsData || []).filter(
          item => item.sub_inventory === load.sub_inventory_name
        ).length;

        if (load.inventory_type === 'ASIS') {
          newStats.loads.byType.asis++;
          newStats.asisLoads.total += 1;

          const status = normalizeStatus(load.ge_source_status);
          const tagged = Boolean(load.prep_tagged);
          const wrapped = Boolean(load.prep_wrapped);
          const needsTag = !tagged;
          const needsWrap = !wrapped;
          const needsBoth = needsTag && needsWrap;

          const pickupDateValue = load.pickup_date ? new Date(load.pickup_date) : null;
          const pickupSoon =
            pickupDateValue && pickupDateValue <= pickupSoonThreshold && pickupDateValue >= now;

          const csoStatus = normalizeStatus(load.ge_cso_status);
          const isShippedOrDelivered = csoStatus === 'delivered' || csoStatus === 'shipped';

          if (load.sanity_check_requested && !isShippedOrDelivered) {
            nextAsisActions.sanityCheckRequested.push(load as AsisActionLoad);
          }

          if (status === 'for sale') {
            newStats.asisLoads.forSale += 1;
            if (needsWrap) {
              newStats.asisLoads.forSaleNeedsWrap += 1;
              nextAsisActions.forSaleNeedsWrap.push(load as AsisActionLoad);
            }
          } else if (status === 'sold') {
            if (!isShippedOrDelivered) {
              newStats.asisLoads.sold += 1;
              if (needsTag) newStats.asisLoads.soldNeedsTag += 1;
              if (needsWrap) newStats.asisLoads.soldNeedsWrap += 1;
              if (needsBoth || needsTag || needsWrap) {
                newStats.asisLoads.soldNeedsBoth += 1;
                nextAsisActions.soldNeedsPrep.push(load as AsisActionLoad);
              }
              if (pickupSoon && (needsTag || needsWrap)) {
                newStats.asisLoads.pickupSoonNeedsPrep += 1;
                nextAsisActions.pickupSoonNeedsPrep.push(load as AsisActionLoad);
              }
            }
          }

          if (load.category === 'Regular') {
            loadsByCategory['ASIS-regular'].push({
              loadName: load.friendly_name || load.sub_inventory_name,
              count: itemsInLoad,
              category: load.category
            });
          } else if (load.category === 'Salvage') {
            loadsByCategory['ASIS-salvage'].push({
              loadName: load.friendly_name || load.sub_inventory_name,
              count: itemsInLoad,
              category: load.category
            });
          } else if (load.category === 'Scrap') {
            loadsByCategory['ASIS-scrap'].push({
              loadName: load.friendly_name || load.sub_inventory_name,
              count: itemsInLoad,
              category: load.category
            });
          }
        } else if (load.inventory_type === 'BackHaul') {
          newStats.loads.byType.fg++;
          loadsByCategory['FG-backhaul'].push({
            loadName: load.friendly_name || load.sub_inventory_name,
            count: itemsInLoad
          });
        } else if (
          load.inventory_type === 'LocalStock' ||
          load.inventory_type === 'Staged' ||
          load.inventory_type === 'STA' ||
          load.inventory_type === 'Inbound'
        ) {
          newStats.loads.byType.localStock++;
          loadsByCategory['LocalStock-routes'].push({
            loadName: load.friendly_name || load.sub_inventory_name,
            count: itemsInLoad
          });
        }
      });

      setStats(newStats);
      setLoadDetails(loadsByCategory);
      setAsisActionLoads(nextAsisActions);

      setActivityLoading(true);
      const { data: activityData, error: activityError } = await supabase
        .from('activity_log')
        .select('id, action, entity_type, entity_id, details, actor_name, actor_image, created_at')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (activityError) {
        console.error('Failed to load activity log:', activityError);
        setActivityLogs([]);
      } else {
        setActivityLogs(activityData ?? []);
      }
      setActivityLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setActivityLoading(false);
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

  const formatPickupDate = (value?: string | null) => {
    if (!value) return '';
    const base = value.slice(0, 10);
    const [year, month, day] = base.split('-').map(Number);
    if (!year || !month || !day) return base;
    return new Date(year, month - 1, day).toLocaleDateString();
  };

  const renderLoadChips = (loads: AsisActionLoad[], onSelect: (load: AsisActionLoad) => void) => {
    if (!loads.length) {
      return (
        <div className="text-xs text-muted-foreground">
          All caught up.
        </div>
      );
    }

    const sorted = [...loads].sort((a, b) => {
      const aDate = a.pickup_date ? Date.parse(a.pickup_date) : 0;
      const bDate = b.pickup_date ? Date.parse(b.pickup_date) : 0;
      if (aDate && bDate) return aDate - bDate;
      if (aDate) return -1;
      if (bDate) return 1;
      return a.sub_inventory_name.localeCompare(b.sub_inventory_name);
    });

    return (
      <div className="grid gap-2">
        {sorted.slice(0, 5).map((load) => {
          const friendly = load.friendly_name?.trim() || load.sub_inventory_name;
          const csoValue = load.ge_cso?.trim() || '';
          const hasCso = Boolean(csoValue);
          const tailValue = hasCso ? csoValue.slice(-4) : load.sub_inventory_name;
          const wrapped = Boolean(load.prep_wrapped);
          const tagged = Boolean(load.prep_tagged);
          const sanityOk = (load.conflict_count ?? 0) === 0;
          const sanityRequested = Boolean(load.sanity_check_requested);
          return (
            <button
              key={load.sub_inventory_name}
              type="button"
              onClick={() => onSelect(load)}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left transition hover:bg-muted/60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {load.primary_color && (
                    <span
                      className="h-3 w-3 rounded-sm border border-border/60"
                      style={{ backgroundColor: load.primary_color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate text-sm font-medium">{friendly}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {hasCso ? 'CSO' : 'Load'}{' '}
                  <span className="font-semibold underline decoration-dotted underline-offset-2 text-foreground">
                    {tailValue}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex h-3 w-3 items-center justify-center rounded-[3px] border ${
                        wrapped
                          ? 'border-foreground/30 text-foreground'
                          : 'border-muted-foreground/40 bg-muted/40 text-muted-foreground/60'
                      }`}
                    >
                      {wrapped && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className={wrapped ? '' : 'opacity-60'}>Wrapped</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex h-3 w-3 items-center justify-center rounded-[3px] border ${
                        tagged
                          ? 'border-foreground/30 text-foreground'
                          : 'border-muted-foreground/40 bg-muted/40 text-muted-foreground/60'
                      }`}
                    >
                      {tagged && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className={tagged ? '' : 'opacity-60'}>Tagged</span>
                  </div>
                  {!sanityRequested && (
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex h-3 w-3 items-center justify-center rounded-[3px] border ${
                          sanityOk
                            ? 'border-foreground/30 text-foreground'
                            : 'border-muted-foreground/40 bg-muted/40 text-muted-foreground/60'
                        }`}
                      >
                        {sanityOk && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className={sanityOk ? '' : 'opacity-60'}>Sanity check</span>
                    </div>
                  )}
                  {sanityRequested && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span>Sanity requested</span>
                    </div>
                  )}
                </div>
              </div>
              {load.pickup_date && (
                <div className="text-xs text-muted-foreground">
                  Pickup {formatPickupDate(load.pickup_date)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const formatActivityDate = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const formatActivityMessage = (entry: ActivityLogEntry) => {
    if (entry.action === 'asis_sync') {
      const total = entry.details?.stats?.totalGEItems ?? entry.details?.stats?.totalItems;
      return total ? `Synced ASIS (${total} items)` : 'Synced ASIS from GE';
    }
    if (entry.action === 'asis_wipe') {
      return 'Wiped ASIS data';
    }
    if (entry.action === 'sanity_check_requested' || entry.action === 'sanity_check_completed') {
      const loadNumber = entry.details?.loadNumber ?? entry.entity_id ?? '';
      const friendly = entry.details?.friendlyName ?? '';
      const label = friendly ? `${friendly} (${loadNumber})` : loadNumber;
      return entry.action === 'sanity_check_requested'
        ? `Requested sanity check for load ${label}`
        : `Completed sanity check for load ${label}`;
    }
    if (entry.action === 'load_update') {
      const loadNumber = entry.details?.loadNumber ?? entry.entity_id ?? '';
      const friendly = entry.details?.friendlyName ?? '';
      const fields = Array.isArray(entry.details?.fields) ? entry.details?.fields : [];
      const fieldLabels: Record<string, string> = {
        friendly_name: 'friendly name',
        notes: 'notes',
        primary_color: 'color',
        category: 'salvage',
        prep_tagged: 'tagged',
        prep_wrapped: 'wrapped',
        sanity_check_requested: 'sanity check requested',
        pickup_date: 'pickup date',
        pickup_tba: 'pickup TBA',
      };
      const fieldsLabel = fields.length
        ? ` (${fields.map((field: string) => fieldLabels[field] ?? field).join(', ')})`
        : '';
      const label = friendly ? `${friendly} (${loadNumber})` : loadNumber;
      return `Updated load ${label}${fieldsLabel}`;
    }
    return entry.action.replace(/_/g, ' ');
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
      <AppHeader title="Dashboard" onMenuClick={onMenuClick} />

      <PageContainer className="py-4 space-y-6 pb-24">
        {/* Welcome Header with Quick Stats */}
        <Card className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="space-y-2 sm:space-y-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={userDisplayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold break-words">Welcome back, {currentUser.name}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  {currentUser.role} • {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            {/* <div className="flex flex-wrap gap-2">
              <Button size="responsive" onClick={() => navigateToInventory()}>
                <ScanBarcode className="mr-2 h-4 w-4" />
                Start Scanning
              </Button>
              <Button size="responsive" variant="outline" onClick={() => onViewChange?.('loads')}>
                <PackageOpen className="mr-2 h-4 w-4" />
                Manage Loads
              </Button>
              <Button size="responsive" variant="outline" onClick={() => navigateToInventory()}>
                <TruckIcon className="mr-2 h-4 w-4" />
                View Inventory
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div> */}
          </div>
        </Card>

        {/* Reorder Alerts */}
        <ReorderAlertsCard onViewParts={() => navigateToPartsInventory('reorder')} />

        {/* Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Load Board</h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Sanity check ASIS load</p>
                    <p className="text-xs text-muted-foreground">Loads requesting a sanity check.</p>
                  </div>
                  <Badge variant="outline">{asisActionLoads.sanityCheckRequested.length}</Badge>
                </div>
                {renderLoadChips(asisActionLoads.sanityCheckRequested, (load) => navigateToLoad(load.sub_inventory_name))}
              </div>

              <div className="border-t border-border/60" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Prep ASIS load</p>
                    <p className="text-xs text-muted-foreground">Sold loads missing prep.</p>
                  </div>
                  <Badge variant="outline">{stats.asisLoads.soldNeedsBoth}</Badge>
                </div>
                {renderLoadChips(asisActionLoads.soldNeedsPrep, (load) => navigateToLoad(load.sub_inventory_name))}
              </div>

              <div className="border-t border-border/60" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Prep ASIS load</p>
                    <p className="text-xs text-muted-foreground">For Sale loads missing prep.</p>
                  </div>
                  <Badge variant="outline">{stats.asisLoads.forSaleNeedsWrap}</Badge>
                </div>
                {renderLoadChips(asisActionLoads.forSaleNeedsWrap, (load) => navigateToLoad(load.sub_inventory_name))}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <Card className="p-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start whitespace-normal text-left h-auto py-3"
                  onClick={() => navigateToInventory()}
                >
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  Start New Scanning Session
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start whitespace-normal text-left h-auto py-3"
                  onClick={() => onViewChange?.('loads')}
                >
                  <PackageOpen className="mr-2 h-4 w-4" />
                  Manage Loads
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start whitespace-normal text-left h-auto py-3"
                  onClick={() => navigateToInventory()}
                >
                  <TruckIcon className="mr-2 h-4 w-4" />
                  View All Inventory
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start whitespace-normal text-left h-auto py-3"
                  onClick={() => onViewChange?.('products')}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Product Lookup
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          <Card className="p-4">
            <div className="max-h-[320px] overflow-y-auto pr-2 space-y-3">
              {activityLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 animate-pulse" />
                  Loading activity…
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                activityLogs.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-semibold">
                      {entry.actor_image ? (
                        <img
                          src={entry.actor_image}
                          alt={entry.actor_name ?? 'User'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {(entry.actor_name ?? 'U').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{entry.actor_name ?? 'Unknown'}</div>
                      <div className="text-sm text-foreground">{formatActivityMessage(entry)}</div>
                      <div className="text-xs text-muted-foreground">{formatActivityDate(entry.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="pt-3">
              <Button variant="ghost" size="responsive" onClick={navigateToActivity}>
                View full activity log
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Interactive Donut Chart */}
        <div className="flex justify-center">
          <Card className="p-6 w-full max-w-2xl">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold min-w-0">
                  {selectedDrilldown ?
                    `Load Details: ${selectedDrilldown.replace(/-/g, ' ')}` :
                    selectedChartType === 'overview' ? 'Inventory Distribution' :
                    selectedChartType === 'LocalStock' ? 'Local Stock Breakdown' :
                    selectedChartType === 'FG' ? 'FG Breakdown' : 'ASIS Breakdown'}
                </h2>
                {selectedDrilldown ? (
                  <Button
                    variant="ghost"
                    size="responsive"
                    onClick={() => setSelectedDrilldown(null)}
                  >
                    ← Back to {selectedChartType}
                  </Button>
                ) : selectedChartType !== 'overview' ? (
                  <Button
                    variant="ghost"
                    size="responsive"
                    onClick={() => setSelectedChartType('overview')}
                  >
                    ← Back to Overview
                  </Button>
                ) : null}
              </div>

              <div className="w-full aspect-square max-w-sm mx-auto">
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="80%"
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
                      <Legend
                        wrapperStyle={{
                          fontSize: 12,
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'center',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>

              {!selectedDrilldown && (
                <p className="text-sm text-muted-foreground text-center">
                  Click on a segment to view detailed breakdown
                </p>
              )}
            </div>
          </Card>
        </div>

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

              <Button size="responsive" variant="outline" className="w-full" onClick={() => navigateToInventory('LocalStock')}>
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

              <Button size="responsive" variant="outline" className="w-full" onClick={() => navigateToInventory('FG')}>
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
                <span className="text-2xl font-bold">{stats.asisLoads.total}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">For Sale loads</span>
                  <span className="font-medium">{stats.asisLoads.forSale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">For Sale to prep</span>
                  <span className="font-medium">{stats.asisLoads.forSaleNeedsWrap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sold loads</span>
                  <span className="font-medium">{stats.asisLoads.sold}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sold to prep</span>
                  <span className="font-medium">{stats.asisLoads.soldNeedsBoth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pickup soon (≤3d) needs prep</span>
                  <span className="font-medium">{stats.asisLoads.pickupSoonNeedsPrep}</span>
                </div>
              </div>

              <Button size="responsive" variant="outline" className="w-full" onClick={() => navigateToInventory('ASIS')}>
                View ASIS
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Load Summary */}
        {/* <div>
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
        </div> */}

        {/* Actions moved above */}
      </PageContainer>
    </div>
  );
}
