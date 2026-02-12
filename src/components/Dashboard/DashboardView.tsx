import { useMemo, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, TruckIcon, PackageOpen, ScanBarcode, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useLoadData } from '@/hooks/useLoadData';
import { useRecentActivityRealtime } from '@/hooks/queries/useRealtimeSync';
import { useDashboardInventoryItems, useDashboardLoadConflicts, useRecentActivity } from '@/hooks/queries/useDashboard';
import { useSessionSummaries } from '@/hooks/queries/useSessions';
import { useInventoryScanCounts } from '@/hooks/queries/useMap';
import { useFogOfWar } from '@/hooks/queries/useFogOfWar';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { ReorderAlertsCard } from './ReorderAlertsCard';
import { SyncStatusCard } from './SyncStatusCard';
import { PageContainer } from '@/components/Layout/PageContainer';
import { getPathForView } from '@/lib/routes';
import type { AppView } from '@/lib/routes';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoadDisplay } from '@/components/Loads/LoadDisplay';
import type { LoadMetadata } from '@/types/inventory';

interface DashboardViewProps {
  onViewChange?: (view: AppView) => void;
  onMenuClick?: () => void;
}

interface DetailedStats {
  totalItems: number;

  // STA = Staged/Crated bucket
  sta: {
    total: number;
    inAsisLoads: number; // STA items assigned to ASIS loads
    unassigned: number;  // STA items not in any load
  };

  // LocalStock = Normal crated STA ready for ordering (floor terminology)
  localStock: {
    total: number;
    inOrders: number;    // Assigned to CSOs
    unassigned: number;  // Not assigned to CSOs
  };

  // Staged = Items in staged state
  staged: {
    total: number;
    assigned: number;
    unassigned: number;
  };

  // Inbound = Incoming items
  inbound: {
    total: number;
    assigned: number;
    unassigned: number;
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
  };

  asisLoads: {
    total: number;
    forSale: number;
    sold: number;
    forSaleNeedsWrap: number;
    soldNeedsTag: number;
    soldNeedsWrap: number;
    soldNeedsPrep: number;
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

const EMPTY_STATS: DetailedStats = {
  totalItems: 0,
  sta: { total: 0, inAsisLoads: 0, unassigned: 0 },
  localStock: { total: 0, inOrders: 0, unassigned: 0 },
  staged: { total: 0, assigned: 0, unassigned: 0 },
  inbound: { total: 0, assigned: 0, unassigned: 0 },
  fg: { total: 0, regular: 0, backhaul: 0 },
  asis: { total: 0, unassigned: 0, regular: 0, salvage: 0 },
  asisLoads: {
    total: 0,
    forSale: 0,
    sold: 0,
    forSaleNeedsWrap: 0,
    soldNeedsTag: 0,
    soldNeedsWrap: 0,
    soldNeedsPrep: 0,
    pickupSoonNeedsPrep: 0,
  },
  loads: { total: 0, active: 0, byType: { localStock: 0, fg: 0, asis: 0 } },
};

const EMPTY_LOAD_DETAILS: Record<string, { loadName: string; count: number; category?: string }[]> = {
  'LocalStock-routes': [],
  'FG-backhaul': [],
  'ASIS-regular': [],
  'ASIS-salvage': [],
};

const EMPTY_ASIS_ACTION_LOADS = {
  forSaleNeedsWrap: [] as AsisActionLoad[],
  soldNeedsPrep: [] as AsisActionLoad[],
  sanityCheckRequested: [] as AsisActionLoad[],
  pickupSoonNeedsPrep: [] as AsisActionLoad[],
};

type AsisActionLoad = LoadMetadata;

type ActivityLogEntry = {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  actor_name?: string | null;
  actor_image?: string | null;
  created_at: string;
};

export function DashboardView({ onViewChange, onMenuClick }: DashboardViewProps) {
  const isMobile = useIsMobile();

  const { loads: loadsData, isLoading: loadsLoading } = useLoadData();
  useRecentActivityRealtime(20);
  const inventoryItemsQuery = useDashboardInventoryItems();
  const conflictsQuery = useDashboardLoadConflicts();
  const recentActivityQuery = useRecentActivity(20);
  const sessionsQuery = useSessionSummaries();
  const scanCountsQuery = useInventoryScanCounts();
  const fogOfWarQuery = useFogOfWar();

  const [selectedChartType, setSelectedChartType] = useState<'overview' | 'LocalStock' | 'FG' | 'ASIS' | 'STA'>('overview');
  const [selectedDrilldown, setSelectedDrilldown] = useState<string | null>(null);
  // const [isCompact, setIsCompact] = useState(false);

  // Helper to navigate to inventory with filter - use path-based URLs
  const navigateToInventory = (filterType?: 'LocalStock' | 'FG' | 'ASIS' | 'Parts') => {
    if (filterType) {
      const params = new URLSearchParams(window.location.search);
      params.delete('view');
      params.delete('type'); // Remove legacy query param
      // Build path-based URL
      const path = getPathForView('inventory', undefined, undefined, {
        inventoryType: filterType
      });
      const newUrl = params.toString() ? `${path}?${params.toString()}` : path;
      window.history.replaceState({}, '', newUrl);
      window.dispatchEvent(new Event('app:locationchange'));
    }
    onViewChange?.('inventory');
  };

  // Helper to navigate to Parts inventory - use path-based URLs
  const navigateToPartsInventory = (status?: 'reorder') => {
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    params.delete('type');
    params.delete('tab');
    // Status is kept as query param
    if (status === 'reorder') {
      params.set('status', 'reorder');
    } else {
      params.delete('status');
    }
    // Build path-based URL for parts/inventory
    const path = getPathForView('parts', undefined, undefined, {
      partsTab: 'inventory'
    });
    const newUrl = params.toString() ? `${path}?${params.toString()}` : path;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
    onViewChange?.('parts');
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

  // useEffect(() => {
  //   const updateLayout = () => {
  //     setIsCompact(window.innerWidth < 640);
  //   };
  //   updateLayout();
  //   window.addEventListener('resize', updateLayout);
  //   return () => window.removeEventListener('resize', updateLayout);
  // }, []);

  const { stats, loadDetails, asisActionLoads } = useMemo(() => {
    const allItems = inventoryItemsQuery.data ?? [];
    const conflictCountMap = conflictsQuery.data ?? new Map<string, number>();
    const loads = (loadsData ?? []).map((load) => ({
      ...load,
      conflict_count: conflictCountMap.get(load.sub_inventory_name) ?? 0,
    }));

    if (allItems.length === 0 && loads.length === 0) {
      return { stats: EMPTY_STATS, loadDetails: EMPTY_LOAD_DETAILS, asisActionLoads: EMPTY_ASIS_ACTION_LOADS };
    }

    // Filter out orphaned items (items no longer in GE) from all calculations
    const itemsData = allItems.filter(item => item.ge_orphaned !== true);
    const activeItemCount = itemsData.length;

    const newStats: DetailedStats = {
      totalItems: activeItemCount,
      sta: { total: 0, inAsisLoads: 0, unassigned: 0 },
      localStock: { total: 0, inOrders: 0, unassigned: 0 },
      staged: { total: 0, assigned: 0, unassigned: 0 },
      inbound: { total: 0, assigned: 0, unassigned: 0 },
      fg: { total: 0, regular: 0, backhaul: 0 },
       asis: { total: 0, unassigned: 0, regular: 0, salvage: 0 },
      asisLoads: {
        total: 0,
        forSale: 0,
        sold: 0,
        forSaleNeedsWrap: 0,
        soldNeedsTag: 0,
        soldNeedsWrap: 0,
        soldNeedsPrep: 0,
        pickupSoonNeedsPrep: 0,
      },
      loads: { total: loads.length || 0, active: 0, byType: { localStock: 0, fg: 0, asis: 0 } },
    };

    const loadCategoryMap = new Map<string, string>();
    const loadTypeMap = new Map<string, string>();
    loads.forEach(load => {
      if (load.category && load.sub_inventory_name) {
        loadCategoryMap.set(load.sub_inventory_name, load.category);
      }
      if (load.inventory_type && load.sub_inventory_name) {
        loadTypeMap.set(load.sub_inventory_name, load.inventory_type);
      }
    });

    itemsData.forEach((item) => {
      const bucket = item.inventory_bucket || item.inventory_type;

      if (item.inventory_state === 'staged') {
        newStats.staged.total++;
        if (!item.sub_inventory) {
          newStats.staged.unassigned++;
        } else {
          newStats.staged.assigned++;
        }
      }

      // STA bucket
      if (bucket === 'STA') {
        newStats.sta.total++;
        if (!item.sub_inventory) {
          newStats.sta.unassigned++;
        } else {
          if (loadTypeMap.get(item.sub_inventory) === 'ASIS') {
            newStats.sta.inAsisLoads++;
          }
        }
      }
      // LocalStock = Normal crated STA ready for ordering
      else if (bucket === 'LocalStock') {
        newStats.localStock.total++;
        if (!item.sub_inventory) {
          newStats.localStock.unassigned++;
        } else {
          newStats.localStock.inOrders++;
        }
      }
      // Inbound = Incoming items
      else if (bucket === 'Inbound') {
        newStats.inbound.total++;
        if (!item.sub_inventory) {
          newStats.inbound.unassigned++;
        } else {
          newStats.inbound.assigned++;
        }
      }
      // FG = Finished Goods
      else if (bucket === 'FG') {
        newStats.fg.total++;
        newStats.fg.regular++;
      }
      // BackHaul
      else if (bucket === 'BackHaul') {
        newStats.fg.total++;
        newStats.fg.backhaul++;
      }
      // ASIS = Uncrated items in loads
      else if (bucket === 'ASIS') {
        newStats.asis.total++;

        if (!item.sub_inventory) {
          newStats.asis.unassigned++;
        } else {
          const category = loadCategoryMap.get(item.sub_inventory);
          if (category === 'Salvage') {
            newStats.asis.salvage++;
          } else {
            // ASIS Loads = any load not marked Salvage (includes null/undefined category)
            newStats.asis.regular++;
          }
        }
      }
    });

    const now = new Date();
    const pickupSoonThreshold = new Date(now);
    pickupSoonThreshold.setDate(pickupSoonThreshold.getDate() + 3);
    const normalizeStatus = (value?: string | null) => value?.toLowerCase().trim() ?? '';

    const loadsByCategory: Record<string, { loadName: string; count: number; category?: string }[]> = {
      'LocalStock-routes': [],
      'FG-backhaul': [],
      'ASIS-regular': [],
      'ASIS-salvage': [],
    };
    const nextAsisActions = {
      forSaleNeedsWrap: [] as AsisActionLoad[],
      soldNeedsPrep: [] as AsisActionLoad[],
      sanityCheckRequested: [] as AsisActionLoad[],
      pickupSoonNeedsPrep: [] as AsisActionLoad[],
    };

    loads.forEach((load) => {
      if (load.status === 'active') newStats.loads.active++;

      const itemsInLoad = itemsData.filter(
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

        const pickupDateValue = load.pickup_date ? new Date(load.pickup_date) : null;
        const pickupSoon =
          pickupDateValue && pickupDateValue <= pickupSoonThreshold && pickupDateValue >= now;

        const csoStatus = normalizeStatus(load.ge_cso_status);
        const isShippedOrDelivered = csoStatus === 'delivered' || csoStatus === 'shipped';

        // Only show action items for loads still in the building (not delivered)
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
            if (needsTag || needsWrap) {
              newStats.asisLoads.soldNeedsPrep += 1;
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
        }
      } else if (load.inventory_type === 'BackHaul') {
        newStats.loads.byType.fg++;
        loadsByCategory['FG-backhaul'].push({
          loadName: load.friendly_name || load.sub_inventory_name,
          count: itemsInLoad
        });
      } else if (
        load.inventory_type === 'LocalStock' ||
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

    return { stats: newStats, loadDetails: loadsByCategory, asisActionLoads: nextAsisActions };
  }, [conflictsQuery.data, inventoryItemsQuery.data, loadsData]);

  const activityLogs = (recentActivityQuery.data ?? []) as ActivityLogEntry[];
  const activityLoading = recentActivityQuery.isLoading;
  const loading = loadsLoading || inventoryItemsQuery.isLoading || conflictsQuery.isLoading;

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
        { name: 'STA', value: stats.sta.total, fill: 'var(--color-chart-1)' },
        { name: 'LocalStock', value: stats.localStock.total, fill: 'var(--color-chart-2)' },
        { name: 'FG', value: stats.fg.total, fill: 'var(--color-chart-3)' },
        { name: 'ASIS', value: stats.asis.total, fill: 'var(--color-chart-4)' },
      ];
    } else if (selectedChartType === 'STA') {
      return [
        { name: 'In ASIS Loads', value: stats.sta.inAsisLoads, fill: 'var(--color-chart-1)' },
        { name: 'Unassigned', value: stats.sta.unassigned, fill: 'var(--color-chart-2)' },
      ];
    } else if (selectedChartType === 'LocalStock') {
      return [
        { name: 'In Orders', value: stats.localStock.inOrders, fill: 'var(--color-chart-1)' },
        { name: 'Unassigned', value: stats.localStock.unassigned, fill: 'var(--color-chart-2)' },
      ];
    } else if (selectedChartType === 'FG') {
      return [
        { name: 'Regular FG', value: stats.fg.regular, fill: 'var(--color-chart-2)' },
        { name: 'BackHaul', value: stats.fg.backhaul, fill: 'var(--color-chart-3)' },
      ];
    } else if (selectedChartType === 'ASIS') {
        return [
          { name: 'Loose ASIS', value: stats.asis.unassigned, fill: 'var(--color-chart-3)' },
          { name: 'ASIS Loads', value: stats.asis.regular, fill: 'var(--color-chart-1)' },
          { name: 'ASIS Salvage', value: stats.asis.salvage, fill: 'var(--color-chart-2)' },
        ];
    }
    return [];
  }, [stats, selectedChartType, selectedDrilldown, loadDetails]);

  const chartConfig = {
    value: {
      label: 'Items',
    },
  };

  const formatPickupDate = useCallback((value?: string | null) => {
    if (!value) return '';
    const base = value.slice(0, 10);
    const [year, month, day] = base.split('-').map(Number);
    if (!year || !month || !day) return base;
    return new Date(year, month - 1, day).toLocaleDateString();
  }, []);

  // Generate action items from various sources
  const actionItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'sanity' | 'wrap' | 'tag' | 'pickup' | 'session';
      priority: number;
      title: string;
      subtitle?: string;
      description: string;
      load?: AsisActionLoad;
      sessionId?: string;
      icon: typeof AlertTriangle;
      color: string;
      loadColor?: string | null;
    }> = [];

    // Unfinished scanning sessions for sold/for sale loads (high priority)
    const sessions = sessionsQuery.data ?? [];
    const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'draft');
    const loadsMap = new Map((loadsData ?? []).map(l => [l.sub_inventory_name, l]));

    activeSessions.forEach((session) => {
      // Only show sessions for ASIS loads that are for sale or sold AND not delivered
      if (session.subInventory) {
        const load = loadsMap.get(session.subInventory);
        const status = load?.ge_source_status?.toLowerCase().trim();
        const csoStatus = load?.ge_cso_status?.toLowerCase().trim();
        const isDelivered = csoStatus === 'delivered';

        if (!status || (status !== 'for sale' && status !== 'sold') || isDelivered) {
          return; // Skip delivered loads or non-ASIS loads
        }
        const friendly = load?.friendly_name?.trim() || session.subInventory;
        const csoValue = load?.ge_cso?.trim() || '';
        const csoTail = csoValue ? csoValue.slice(-4) : '';
        const loadLabel = csoTail ? `${friendly} · ${csoTail}` : friendly;

        const loadKey = load?.sub_inventory_name ?? session.subInventory;
        const key = `load:${loadKey}`;
        const scanned = scanCountsQuery.data?.scannedByKey.get(key) ?? 0;
        const total = scanCountsQuery.data?.totalByKey.get(key) ?? 0;
        const progress = total > 0
          ? Math.round((scanned / total) * 100)
          : 0;
        const progressDesc = progress < 25
          ? 'Just getting started - continue scanning items'
          : progress < 75
          ? 'Making progress - keep scanning to complete this load'
          : 'Almost done - finish scanning the remaining items';
        items.push({
          id: `session-${session.id}`,
          type: 'session',
          priority: 2,
          title: `Scan ${loadLabel}`,
          subtitle: `${scanned}/${total} scanned (${progress}%)`,
          description: progressDesc,
          sessionId: session.id,
          icon: ScanBarcode,
          color: 'text-blue-600 dark:text-blue-400',
          loadColor: load?.primary_color ?? null,
        });
        return;
      }

      const key = session.subInventory
        ? `load:${session.subInventory}`
        : `type:${session.inventoryType}`;
      const scanned = scanCountsQuery.data?.scannedByKey.get(key) ?? 0;
      const total = scanCountsQuery.data?.totalByKey.get(key) ?? 0;
      const progress = total > 0
        ? Math.round((scanned / total) * 100)
        : 0;
      const progressDesc = progress < 25
        ? 'Just getting started - continue scanning items'
        : progress < 75
        ? 'Making progress - keep scanning to complete this session'
        : 'Almost done - finish scanning the remaining items';
      items.push({
        id: `session-${session.id}`,
        type: 'session',
        priority: 2,
        title: `Scan ${session.name}`,
        subtitle: `${scanned}/${total} scanned (${progress}%)`,
        description: progressDesc,
        sessionId: session.id,
        icon: ScanBarcode,
        color: 'text-blue-600 dark:text-blue-400',
      });
    });

    // Sanity checks (highest priority)
    asisActionLoads.sanityCheckRequested.forEach((load) => {
      const friendly = load.friendly_name?.trim() || load.sub_inventory_name;
      const csoValue = load.ge_cso?.trim() || '';
      const csoTail = csoValue ? csoValue.slice(-4) : '';
      const loadLabel = csoTail ? `${friendly} · ${csoTail}` : friendly;
      items.push({
        id: `sanity-${load.sub_inventory_name}`,
        type: 'sanity',
        priority: 1,
        title: `Sanity check ${loadLabel}`,
        subtitle: csoTail ? `CSO ${csoTail}` : `Load ${load.sub_inventory_name}`,
        description: 'Verify that the items in this load match GE records',
        load,
        icon: AlertTriangle,
        color: 'text-amber-600 dark:text-amber-400',
        loadColor: load.primary_color ?? null,
      });
    });

    // Pickup soon needs prep (high priority)
    asisActionLoads.pickupSoonNeedsPrep.forEach((load) => {
      const friendly = load.friendly_name?.trim() || load.sub_inventory_name;
      const csoValue = load.ge_cso?.trim() || '';
      const csoTail = csoValue ? csoValue.slice(-4) : '';
      const loadLabel = csoTail ? `${friendly} · ${csoTail}` : friendly;
      const needsWrap = !load.prep_wrapped;
      const needsTag = !load.prep_tagged;
      const actions = [needsWrap && 'wrap', needsTag && 'tag'].filter(Boolean).join(' & ');
      const pickupDate = load.pickup_date ? new Date(load.pickup_date) : null;
      const daysUntilPickup = pickupDate
        ? Math.ceil((pickupDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const urgencyText = daysUntilPickup === 0
        ? 'Pickup is today'
        : daysUntilPickup === 1
        ? 'Pickup is tomorrow'
        : daysUntilPickup
        ? `Pickup in ${daysUntilPickup} days`
        : 'Pickup soon';
      const taskText = needsWrap && needsTag
        ? 'wrap and apply a sold tag to'
        : needsWrap
        ? 'wrap'
        : 'apply a sold tag to';
      items.push({
        id: `pickup-${load.sub_inventory_name}`,
        type: 'pickup',
        priority: 2,
        title: `Prep ${loadLabel} for pickup`,
        subtitle: `Needs ${actions} · Pickup ${formatPickupDate(load.pickup_date)}`,
        description: `${urgencyText} - ${taskText} this load now`,
        load,
        icon: TruckIcon,
        color: 'text-red-600 dark:text-red-400',
        loadColor: load.primary_color ?? null,
      });
    });

    // Tag sold loads (medium priority)
    asisActionLoads.soldNeedsPrep.forEach((load) => {
      if (asisActionLoads.pickupSoonNeedsPrep.some(p => p.sub_inventory_name === load.sub_inventory_name)) {
        return; // Skip if already in pickup soon
      }
      const friendly = load.friendly_name?.trim() || load.sub_inventory_name;
      const csoValue = load.ge_cso?.trim() || '';
      const csoTail = csoValue ? csoValue.slice(-4) : '';
      const loadLabel = csoTail ? `${friendly} · ${csoTail}` : friendly;
      const needsWrap = !load.prep_wrapped;
      const needsTag = !load.prep_tagged;
      const actions = [needsWrap && 'wrap', needsTag && 'tag'].filter(Boolean).join(' & ');
      const taskDesc = needsWrap && needsTag
        ? 'Wrap and apply a sold tag to this load before pickup'
        : needsWrap
        ? 'Wrap this sold load to protect it for pickup'
        : 'Apply a sold tag to this load';
      items.push({
        id: `prep-${load.sub_inventory_name}`,
        type: 'tag',
        priority: 3,
        title: `Prep ${loadLabel}`,
        subtitle: `Needs ${actions}`,
        description: taskDesc,
        load,
        icon: Package,
        color: 'text-orange-600 dark:text-orange-400',
        loadColor: load.primary_color ?? null,
      });
    });

    // Wrap for sale loads (lower priority)
    asisActionLoads.forSaleNeedsWrap.forEach((load) => {
      const friendly = load.friendly_name?.trim() || load.sub_inventory_name;
      const csoValue = load.ge_cso?.trim() || '';
      const csoTail = csoValue ? csoValue.slice(-4) : '';
      const loadLabel = csoTail ? `${friendly} · ${csoTail}` : friendly;
      items.push({
        id: `wrap-${load.sub_inventory_name}`,
        type: 'wrap',
        priority: 4,
        title: `Wrap ${loadLabel}`,
        subtitle: 'For Sale',
        description: 'Wrap this for-sale load to prepare it for potential buyers',
        load,
        icon: PackageOpen,
        color: 'text-blue-600 dark:text-blue-400',
        loadColor: load.primary_color ?? null,
      });
    });

    return items.sort((a, b) => a.priority - b.priority);
  }, [asisActionLoads, formatPickupDate, sessionsQuery.data, loadsData, scanCountsQuery.data]);

  const formatActivityDate = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const formatActivityMessage = (entry: ActivityLogEntry) => {
    if (entry.action === 'asis_sync') {
      const stats = entry.details?.stats as { totalGEItems?: number; totalItems?: number } | undefined;
      const total = stats?.totalGEItems ?? stats?.totalItems;
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
      {!isMobile && (
        <AppHeader title="Dashboard" onMenuClick={onMenuClick} />
      )}

      <PageContainer className="py-4 space-y-6 pb-24">
        {/* Reorder Alerts */}
        <ReorderAlertsCard onViewParts={() => navigateToPartsInventory('reorder')} />

        {/* Mobile: Action-focused */}
        {isMobile && (
          <>
            {/* Action Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Action Items</h2>
                {actionItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewChange?.('actions')}
                    className="h-7 text-xs"
                  >
                    View all
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
              {actionItems.length === 0 ? (
                <Card className="p-6 text-center">
                  <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No action items at this time.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {actionItems.slice(0, 5).map((item) => {
                    if (item.load) {
                      return (
                        <div key={item.id} className="cursor-pointer" onClick={() => navigateToLoad(item.load!.sub_inventory_name)}>
                          <LoadDisplay
                            load={item.load}
                            variant="compact"
                            showProgress={true}
                            showActions={false}
                          />
                        </div>
                      );
                    }
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onViewChange?.('actions')}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 text-left transition hover:bg-accent w-full"
                      >
                        <Icon className={`h-5 w-5 flex-shrink-0 ${item.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                          )}
                          <div className="text-xs text-foreground mt-1">{item.description}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    );
                  })}
                  {actionItems.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewChange?.('actions')}
                      className="w-full mt-2"
                    >
                      View {actionItems.length - 5} more action{actionItems.length - 5 !== 1 ? 's' : ''}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ASIS Stats */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">ASIS Loads</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewChange?.('loads')}
                  className="h-7 text-xs"
                >
                  View all
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold">{stats.asisLoads.forSale}</div>
                  <div className="text-xs text-muted-foreground">For Sale</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.asisLoads.sold}</div>
                  <div className="text-xs text-muted-foreground">Sold</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.asisLoads.total - stats.asisLoads.forSale - stats.asisLoads.sold}</div>
                  <div className="text-xs text-muted-foreground">Shipped</div>
                </div>
              </div>
            </Card>

          {/* Sync Status */}
          <SyncStatusCard onViewChange={onViewChange} />

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <Card className="p-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start whitespace-normal text-left h-auto py-3"
                  onClick={() => onViewChange?.('actions')}
                >
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  View actions
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
                    <div className="h-9 w-9 flex-shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-semibold">
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
          </>
        )}

        {/* Desktop: 3-Column Grid Layout */}
        {!isMobile && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
            {/* Left Column: Chart & Stats */}
            <div className="md:col-span-1 lg:col-span-3 space-y-6">
              {/* Interactive Donut Chart */}
              <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Inventory</h3>
                {selectedChartType !== 'overview' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedChartType('overview')}
                    className="h-6 text-xs"
                  >
                    ← Back
                  </Button>
                )}
              </div>

              <div className="w-full aspect-square">
                <ChartContainer config={chartConfig} className="w-full h-full">
                    <PieChart width={354} height={354}>
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
                            if (data.name === 'STA') setSelectedChartType('STA');
                            else if (data.name === 'LocalStock') setSelectedChartType('LocalStock');
                            else if (data.name === 'FG') setSelectedChartType('FG');
                            else if (data.name === 'ASIS') setSelectedChartType('ASIS');
                          }
                          // Level 2: Sub-inventories -> drill to loads
                          else if (!selectedDrilldown) {
                            // STA and LocalStock don't have drilldowns yet
                            if (selectedChartType === 'FG' && data.name === 'BackHaul') {
                              setSelectedDrilldown('FG-backhaul');
                            } else if (selectedChartType === 'ASIS') {
                              if (data.name === 'ASIS Loads') setSelectedDrilldown('ASIS-regular');
                              else if (data.name === 'ASIS Salvage') setSelectedDrilldown('ASIS-salvage');
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
                </ChartContainer>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Click to explore
              </p>
            </div>
              </Card>

              {/* STA - Compact */}
              <Card className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded" style={{ backgroundColor: 'oklch(var(--chart-1) / 0.1)' }}>
                        <PackageOpen className="h-4 w-4" style={{ color: 'oklch(var(--chart-1))' }} />
                      </div>
                      <h4 className="text-sm font-semibold">STA</h4>
                    </div>
                    <span className="text-lg font-bold">{stats.sta.total}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In ASIS Loads</span>
                      <span className="font-medium">{stats.sta.inAsisLoads}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unassigned</span>
                      <span className="font-medium">{stats.sta.unassigned}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* FG - Compact */}
              <Card className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded" style={{ backgroundColor: 'oklch(var(--chart-2) / 0.1)' }}>
                        <TruckIcon className="h-4 w-4" style={{ color: 'oklch(var(--chart-2))' }} />
                      </div>
                      <h4 className="text-sm font-semibold">FG</h4>
                    </div>
                    <span className="text-lg font-bold">{stats.fg.total}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Regular</span>
                      <span className="font-medium">{stats.fg.regular}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BackHaul</span>
                      <span className="font-medium">{stats.fg.backhaul}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* ASIS - Compact */}
              <Card className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded" style={{ backgroundColor: 'oklch(var(--chart-3) / 0.1)' }}>
                        <Package className="h-4 w-4" style={{ color: 'oklch(var(--chart-3))' }} />
                      </div>
                      <h4 className="text-sm font-semibold">ASIS</h4>
                    </div>
                    <span className="text-lg font-bold">{stats.asis.total}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ASIS Loads</span>
                      <span className="font-medium">{stats.asis.regular}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ASIS Salvage</span>
                      <span className="font-medium">{stats.asis.salvage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loose ASIS</span>
                      <span className="font-medium">{stats.asis.unassigned}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Center Column: Action Items */}
            <div className="md:col-span-1 lg:col-span-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Action Items</h2>
                {actionItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewChange?.('actions')}
                    className="h-8"
                  >
                    View all
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
              {actionItems.length === 0 ? (
                <Card className="p-8 text-center">
                  <Check className="h-16 w-16 mx-auto mb-3 text-green-500" />
                  <p className="text-base font-medium">All caught up!</p>
                  <p className="text-sm text-muted-foreground mt-2">No action items at this time.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {actionItems.slice(0, 5).map((item) => {
                    if (item.load) {
                      return (
                        <div key={item.id} className="cursor-pointer" onClick={() => navigateToLoad(item.load!.sub_inventory_name)}>
                          <LoadDisplay
                            load={item.load}
                            variant="compact"
                            showProgress={true}
                            showActions={false}
                          />
                        </div>
                      );
                    }
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onViewChange?.('actions')}
                        className="flex items-center gap-4 rounded-lg border border-border/60 bg-card px-4 py-3 text-left transition hover:bg-accent w-full"
                      >
                        <Icon className={`h-5 w-5 flex-shrink-0 ${item.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-base">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-sm text-muted-foreground">{item.subtitle}</div>
                          )}
                          <div className="text-sm text-foreground mt-1">{item.description}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    );
                  })}
                  {actionItems.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewChange?.('actions')}
                      className="w-full mt-2"
                    >
                      View {actionItems.length - 5} more action{actionItems.length - 5 !== 1 ? 's' : ''}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: ASIS Stats + Quick Actions + Activity */}
            <div className="md:col-span-2 lg:col-span-3 space-y-6">
              {/* ASIS Load Stats */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">ASIS Loads</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewChange?.('loads')}
                    className="h-8"
                  >
                    View all
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <Card className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold">{stats.asisLoads.forSale}</div>
                      <div className="text-sm text-muted-foreground mt-1">For Sale</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold">{stats.asisLoads.sold}</div>
                      <div className="text-sm text-muted-foreground mt-1">Sold</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold">{stats.asisLoads.total - stats.asisLoads.forSale - stats.asisLoads.sold}</div>
                      <div className="text-sm text-muted-foreground mt-1">Shipped</div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Fog of War - Warehouse Mapping Progress */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Warehouse Map</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewChange?.('map')}
                    className="h-8"
                  >
                    View map
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <Card className="p-4">
                  {fogOfWarQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Package className="h-4 w-4 animate-pulse" />
                      Loading map data…
                    </div>
                  ) : fogOfWarQuery.data ? (
                    <div className="space-y-4">
                      {/* Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Coverage</span>
                          <span className="text-2xl font-bold">{fogOfWarQuery.data.coveragePercent}%</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-500"
                            style={{ width: `${fogOfWarQuery.data.coveragePercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{fogOfWarQuery.data.mappedItems.toLocaleString()} mapped</span>
                          <span>{fogOfWarQuery.data.totalItems.toLocaleString()} total</span>
                        </div>
                      </div>

                      {/* Recent Scans */}
                      {fogOfWarQuery.data.recentScans.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2">Recent Scans</div>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {fogOfWarQuery.data.recentScans.slice(0, 5).map((scan) => (
                              <div
                                key={scan.id}
                                className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    {scan.productType || 'Unknown'}
                                    {scan.subInventory && (
                                      <span className="text-muted-foreground ml-1">· {scan.subInventory}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-muted-foreground text-[10px] ml-2 flex-shrink-0">
                                  {new Date(scan.createdAt).toLocaleTimeString(undefined, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4">No map data available</div>
                  )}
                </Card>
              </div>

              {/* Sync Status */}
              <SyncStatusCard onViewChange={onViewChange} />

              {/* Quick Actions */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <Card className="p-4">
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start whitespace-normal text-left h-auto py-3"
                      onClick={() => onViewChange?.('actions')}
                    >
                      <ScanBarcode className="mr-2 h-4 w-4" />
                      View actions
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

              {/* Recent Activity */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
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
                        <div className="h-9 w-9 flex-shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-semibold">
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
            </div>
          </div>
        )}

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
