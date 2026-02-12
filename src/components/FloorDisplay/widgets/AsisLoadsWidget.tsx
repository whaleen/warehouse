import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLoadData } from '@/hooks/useLoadData';
import type { LoadBoardConfig } from '@/types/display';
import { CheckCircle2, Circle } from 'lucide-react';

type Props = {
  title?: string;
  locationId?: string;
  className?: string;
  config?: LoadBoardConfig;
};

type LoadRow = {
  id: string;
  sub_inventory_name: string | null;
  friendly_name: string | null;
  ge_source_status: string | null;
  ge_cso_status: string | null;
  ge_cso: string | null;
  ge_units: number | null;
  ge_submitted_date: string | null;
  primary_color: string | null;
  prep_tagged: boolean | null;
  prep_wrapped: boolean | null;
  pickup_date: string | null;
  pickup_tba: boolean | null;
};

const normalize = (value?: string | null) => value?.toLowerCase().trim() ?? '';

const getPickupRank = (load: LoadRow) => {
  if (load.pickup_date) return 0;
  return 1;
};

const getPickupTime = (load: LoadRow) => {
  if (!load.pickup_date) return Number.POSITIVE_INFINITY;
  const time = Date.parse(load.pickup_date);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

const getSubmittedTime = (load: LoadRow) => {
  if (!load.ge_submitted_date) return 0;
  const time = Date.parse(load.ge_submitted_date);
  return Number.isNaN(time) ? 0 : time;
};

const sortLoads = (a: LoadRow, b: LoadRow) => {
  const pickupRank = getPickupRank(a) - getPickupRank(b);
  if (pickupRank !== 0) return pickupRank;

  const pickupTime = getPickupTime(a) - getPickupTime(b);
  if (pickupTime !== 0) return pickupTime;

  const statusRank = normalize(a.ge_source_status) === 'sold' ? 0 : 1;
  const statusRankB = normalize(b.ge_source_status) === 'sold' ? 0 : 1;
  if (statusRank !== statusRankB) return statusRank - statusRankB;

  return getSubmittedTime(b) - getSubmittedTime(a);
};

const formatPickup = (load: LoadRow) => {
  if (load.pickup_date) {
    const base = load.pickup_date.slice(0, 10);
    const [year, month, day] = base.split('-').map(Number);
    if (!year || !month || !day) return 'TBA';
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  return 'TBA';
};

const formatCso = (cso?: string | null) => {
  const trimmed = (cso ?? '').toString().trim();
  if (!trimmed) {
    return { lead: '', last4: '' };
  }
  if (trimmed.length <= 4) {
    return { lead: '', last4: trimmed };
  }
  return {
    lead: trimmed.slice(0, -4),
    last4: trimmed.slice(-4),
  };
};

export function AsisLoadsWidget({ title = 'ASIS Loads', locationId, className, config }: Props) {
  const { loads: data, isLoading: loading } = useLoadData({ inventoryType: 'ASIS' });
  const loads = useMemo(() => (data ?? []) as LoadRow[], [data]);
  const [pageIndex, setPageIndex] = useState(0);

  const statusFilter = config?.statusFilter ?? 'both';
  const rawPageSize = Number(config?.pageSize ?? 8);
  const safePageSize = Number.isFinite(rawPageSize) ? rawPageSize : 8;
  const pageSize = Math.min(20, Math.max(1, Math.floor(safePageSize)));
  const autoRotate = config?.autoRotate ?? false;
  const rawRotateInterval = Number(config?.rotateIntervalSec ?? 12);
  const safeRotateInterval = Number.isFinite(rawRotateInterval) ? rawRotateInterval : 12;
  const rotateIntervalSec = Math.min(60, Math.max(5, Math.floor(safeRotateInterval)));

  const filteredLoads = useMemo(() => {
    const onFloorLoads = loads.filter(
      (load) =>
        normalize(load.ge_source_status) === 'for sale' ||
        (normalize(load.ge_source_status) === 'sold' &&
          normalize(load.ge_cso_status) === 'picked')
    );

    const narrowed =
      statusFilter === 'for-sale'
        ? onFloorLoads.filter((load) => normalize(load.ge_source_status) === 'for sale')
        : statusFilter === 'sold-picked'
        ? onFloorLoads.filter((load) => normalize(load.ge_source_status) === 'sold')
        : onFloorLoads;

    return narrowed.sort(sortLoads);
  }, [loads, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLoads.length / pageSize));
  const pageLoads = filteredLoads.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const pageLabel = totalPages > 1 ? `Page ${pageIndex + 1} of ${totalPages}` : null;

  useEffect(() => {
    setPageIndex(0);
  }, [pageSize, statusFilter, locationId]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(0);
    }
  }, [pageIndex, totalPages]);

  useEffect(() => {
    if (!autoRotate || totalPages <= 1) return;

    const interval = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, rotateIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [autoRotate, rotateIntervalSec, totalPages]);

  const renderLoad = (load: LoadRow) => {
    const label = load.friendly_name || load.sub_inventory_name || 'Unknown Load';
    const subLabel =
      load.friendly_name && load.sub_inventory_name ? load.sub_inventory_name : null;
    const isPicked = normalize(load.ge_source_status) === 'sold';
    const prepTagged = Boolean(load.prep_tagged);
    const prepWrapped = Boolean(load.prep_wrapped);
    const prepReady = prepTagged && prepWrapped;
    const csoParts = formatCso(load.ge_cso);

    return (
      <div key={load.id} className="grid grid-cols-12 items-center gap-4 px-6 py-4">
        <div className="col-span-2">
          <Badge
            variant={isPicked ? 'secondary' : 'outline'}
            className="text-sm uppercase tracking-wide px-3 py-1"
          >
            {isPicked ? 'SOLD • PICKED' : 'FOR SALE'}
          </Badge>
        </div>
        <div className="col-span-3 min-w-0">
          <div className="text-xl font-semibold text-foreground truncate">{label}</div>
          {subLabel && <div className="text-sm text-muted-foreground truncate">{subLabel}</div>}
        </div>
        <div className="col-span-3 flex items-center gap-3 min-w-0">
          <div
            className="h-10 w-10 rounded-md flex-shrink-0 shadow-sm border border-border"
            style={{ backgroundColor: load.primary_color || '#9CA3AF' }}
          />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">CSO</div>
            <div className="text-2xl font-semibold text-foreground tracking-widest">
              {csoParts.lead && <span className="text-muted-foreground/70">{csoParts.lead}</span>}
                {csoParts.last4 ? (
                  <span className="font-bold underline decoration-dotted decoration-2 underline-offset-4">
                    {csoParts.last4}
                  </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-foreground">
            {prepTagged ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50" />
            )}
            <span>Tag</span>
          </div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-foreground">
            {prepWrapped ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50" />
            )}
            <span>Wrap</span>
          </div>
          {prepReady && (
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Ready</span>
          )}
        </div>
        <div className="col-span-2 text-base font-medium text-foreground">
          <div>{formatPickup(load)}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Units {typeof load.ge_units === 'number' ? load.ge_units : '—'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={`flex flex-col gap-0 py-0 overflow-hidden ${className ?? ''}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-xl font-semibold uppercase tracking-wide">{title}</h2>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {filteredLoads.length} on-floor load{filteredLoads.length === 1 ? '' : 's'}
          </span>
          {pageLabel && <span className="text-xs uppercase tracking-wide">{pageLabel}</span>}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0">
        {loading ? (
          <p className="text-muted-foreground animate-pulse">Loading...</p>
        ) : filteredLoads.length === 0 ? (
          <p className="text-muted-foreground">No on-floor loads</p>
        ) : (
          <div className="w-full h-full flex flex-col min-h-0">
            <div className="grid grid-cols-12 gap-4 text-sm uppercase tracking-widest text-muted-foreground px-6 py-3 bg-muted border-b border-border">
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Load</div>
              <div className="col-span-3">CSO</div>
              <div className="col-span-2">Prep</div>
              <div className="col-span-2">Pickup / Units</div>
            </div>
            <div
              key={pageIndex}
              className="flex-1 min-h-0 divide-y divide-border overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            >
              {pageLoads.map(renderLoad)}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
