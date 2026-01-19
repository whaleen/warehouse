import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Card } from '@/components/ui/card';

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
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      if (!locationId) {
        setStats(null);
        setLoading(false);
        return;
      }

      const [{ count: totalItems }, { count: unassignedItems }, loadsResult] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('*', { head: true, count: 'exact' })
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS'),
        supabase
          .from('inventory_items')
          .select('*', { head: true, count: 'exact' })
          .eq('location_id', locationId)
          .eq('inventory_type', 'ASIS')
          .or('sub_inventory.is.null,sub_inventory.eq.""'),
        supabase
          .from('load_metadata')
          .select('ge_source_status, ge_cso_status')
          .eq('location_id', locationId)
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

      if (!cancelled) {
        setStats({
          totalItems: totalItems ?? 0,
          unassignedItems: unassignedItems ?? 0,
          onFloorLoads,
          forSaleLoads,
          pickedLoads,
        });
        setLoading(false);
      }
    };

    fetchStats();
    const inventoryChannel = locationId
      ? supabase
          .channel(`asis-overview-items:${locationId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'inventory_items',
              filter: `location_id=eq.${locationId}`,
            },
            (payload) => {
              const nextType = (payload.new as { inventory_type?: string } | null)?.inventory_type;
              const prevType = (payload.old as { inventory_type?: string } | null)?.inventory_type;
              if (nextType !== 'ASIS' && prevType !== 'ASIS') return;
              if (!cancelled) {
                fetchStats();
              }
            }
          )
          .subscribe()
      : null;
    const loadsChannel = locationId
      ? supabase
          .channel(`asis-overview-loads:${locationId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'load_metadata',
              filter: `location_id=eq.${locationId}`,
            },
            (payload) => {
              const nextType = (payload.new as { inventory_type?: string } | null)?.inventory_type;
              const prevType = (payload.old as { inventory_type?: string } | null)?.inventory_type;
              if (nextType !== 'ASIS' && prevType !== 'ASIS') return;
              if (!cancelled) {
                fetchStats();
              }
            }
          )
          .subscribe()
      : null;
    return () => {
      cancelled = true;
      if (inventoryChannel) {
        supabase.removeChannel(inventoryChannel);
      }
      if (loadsChannel) {
        supabase.removeChannel(loadsChannel);
      }
    };
  }, [locationId]);

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
                {stats.unassignedItems}
              </span>
              <span className="text-xs text-muted-foreground">Unassigned items</span>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-1">
              <span className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
                {stats.onFloorLoads}
              </span>
              <span className="text-xs text-muted-foreground">On-floor loads</span>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-1">
              <span className={`${isCompact ? 'text-xl' : 'text-2xl'} font-semibold text-foreground`}>
                {stats.forSaleLoads}
              </span>
              <span className="text-xs text-muted-foreground">FOR SALE loads</span>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-1">
              <span className={`${isCompact ? 'text-xl' : 'text-2xl'} font-semibold text-foreground`}>
                {stats.pickedLoads}
              </span>
              <span className="text-xs text-muted-foreground">SOLD • Picked loads</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
