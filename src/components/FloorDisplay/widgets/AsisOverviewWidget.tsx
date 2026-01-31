import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { getActiveLocationContext } from '@/lib/tenant';
import { useInventoryRealtime } from '@/hooks/queries/useRealtimeSync';

type Props = {
  title?: string;
  locationId?: string;
  variant?: 'default' | 'compact';
  className?: string;
};

type OverviewStats = {
  totalItems: number;
  unassignedItems: number;
  onFloorLoads: number;
  forSaleLoads: number;
  pickedLoads: number;
};

const normalize = (value?: string | null) => value?.toLowerCase().trim() ?? '';

export function AsisOverviewWidget({ title = 'ASIS Overview', locationId, variant = 'default', className }: Props) {
  const { locationId: activeLocationId } = getActiveLocationContext();
  const effectiveLocationId = locationId ?? activeLocationId;

  const { data: stats, isLoading: loading } = useQuery<OverviewStats | null>({
    queryKey: ['asis-overview', effectiveLocationId],
    queryFn: async () => {
      if (!effectiveLocationId) {
        return null;
      }

      const [{ count: totalItems }, { count: unassignedItems }, loadsResult] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('*', { head: true, count: 'exact' })
          .eq('location_id', effectiveLocationId)
          .eq('inventory_type', 'ASIS'),
        supabase
          .from('inventory_items')
          .select('*', { head: true, count: 'exact' })
          .eq('location_id', effectiveLocationId)
          .eq('inventory_type', 'ASIS')
          .or('sub_inventory.is.null,sub_inventory.eq.""'),
        supabase
          .from('load_metadata')
          .select('ge_source_status, ge_cso_status')
          .eq('location_id', effectiveLocationId)
          .eq('inventory_type', 'ASIS'),
      ]);

      const loads = loadsResult.data ?? [];

      const forSaleLoads = loads.filter(
        (load) => normalize(load.ge_source_status) === 'for sale'
      ).length;
      const pickedLoads = loads.filter(
        (load) =>
          normalize(load.ge_source_status) === 'sold' &&
          normalize(load.ge_cso_status) === 'picked'
      ).length;

      const onFloorLoads = forSaleLoads + pickedLoads;

      return {
        totalItems: totalItems ?? 0,
        unassignedItems: unassignedItems ?? 0,
        onFloorLoads,
        forSaleLoads,
        pickedLoads,
      };
    },
    enabled: !!effectiveLocationId,
  });

  // Realtime sync for inventory changes
  useInventoryRealtime();

  const isCompact = variant === 'compact';

  return (
    <Card
      className={`flex flex-col ${isCompact ? 'px-4 py-3 gap-3' : 'p-4 h-full gap-4'} ${className ?? ''}`}
    >
      <h2 className={`${isCompact ? 'text-sm' : 'text-base'} uppercase tracking-wide text-muted-foreground`}>
        {title}
      </h2>
      <div className={`flex-1 ${isCompact ? '' : 'flex items-center justify-center'}`}>
        {loading ? (
          <p className="text-muted-foreground animate-pulse">Loading...</p>
        ) : !stats ? (
          <p className="text-muted-foreground">No data</p>
        ) : (
          <div className={`grid w-full ${isCompact ? 'grid-cols-4 gap-3' : 'grid-cols-2 gap-4'}`}>
            <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-1">
              <span className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
                {(stats ?? {}).unassignedItems ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">Unassigned items</span>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-1">
              <span className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
                {(stats ?? {}).onFloorLoads ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">On-floor loads</span>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-1">
              <span className={`${isCompact ? 'text-xl' : 'text-2xl'} font-semibold text-foreground`}>
                {(stats ?? {}).forSaleLoads ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">FOR SALE loads</span>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-1">
              <span className={`${isCompact ? 'text-xl' : 'text-2xl'} font-semibold text-foreground`}>
                {(stats ?? {}).pickedLoads ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">SOLD • Picked loads</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
