import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BucketPill } from '@/components/ui/bucket-pill';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search } from 'lucide-react';
import type { InventoryType } from '@/types/inventory';
import type { SessionSummary } from '@/types/session';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import {
  useSessionCreatorAvatars,
  useSessionLoadMetadata,
  useSessionSummaries,
} from '@/hooks/queries/useSessions';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AppView } from '@/lib/routes';

interface SessionsViewProps {
  onViewChange?: (view: AppView) => void;
  onMenuClick?: () => void;
}

const inventoryTypeLabels: Record<InventoryType, string> = {
  ASIS: 'ASIS',
  BackHaul: 'BackHaul',
  Staged: 'Staged',
  Inbound: 'Inbound',
  STA: 'STA',
  FG: 'FG',
  LocalStock: 'LocalStock',
  Parts: 'Parts',
  WillCall: 'WillCall'
};

const getInventoryTypeLabel = (value: InventoryType) => inventoryTypeLabels[value] ?? value;

function formatSessionTimestamp(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function SessionsView({ onViewChange, onMenuClick }: SessionsViewProps) {
  const isMobile = useIsMobile();
  const { locationId } = getActiveLocationContext();
  const [sessionListTab, setSessionListTab] = useState<'active' | 'closed' | 'all'>('active');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | InventoryType>('all');
  const sessionsActionError = null;
  const sessionsQuery = useSessionSummaries();
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const sessionsLoading = sessionsQuery.isLoading;
  const sessionsError = sessionsQuery.error instanceof Error ? sessionsQuery.error.message : null;
  const sessionsDisplayError = sessionsActionError ?? sessionsError;
  const sessionSubInventories = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.subInventory).filter(Boolean) as string[])),
    [sessions]
  );
  const sessionLoadMetadataQuery = useSessionLoadMetadata(sessionSubInventories);
  const sessionLoadMetadata = useMemo(
    () => sessionLoadMetadataQuery.data ?? new Map(),
    [sessionLoadMetadataQuery.data]
  );
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (session.inventoryType !== 'ASIS' || !session.subInventory) return true;
      const load = sessionLoadMetadata.get(session.subInventory);
      if (!load) return true;
      const rawStatus = load.ge_source_status || (load as { status?: string | null }).status || '';
      return !rawStatus.trim().toLowerCase().includes('delivered');
    });
  }, [sessionLoadMetadata, sessions]);
  const createdByNames = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.createdBy).filter(Boolean) as string[])),
    [sessions]
  );
  const creatorAvatarsQuery = useSessionCreatorAvatars(createdByNames);
  const creatorAvatars = creatorAvatarsQuery.data ?? {};

  const sessionCountsQuery = useQuery({
    queryKey: ['session-scan-counts', locationId ?? 'missing'],
    enabled: !!locationId,
    queryFn: async () => {
      if (!locationId) {
        return {
          totalsByKey: new Map<string, number>(),
          scannedByKey: new Map<string, number>(),
        };
      }

      const { data: inventoryItems, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('id, sub_inventory, inventory_type, inventory_bucket')
        .eq('location_id', locationId)
        .limit(50000); // Override default 1000 row limit

      if (inventoryError) throw inventoryError;

      const itemMap = new Map<string, { sub_inventory: string | null; inventory_bucket: string | null }>();
      const totalsByKey = new Map<string, number>();

      for (const item of inventoryItems ?? []) {
        if (!item.id) continue;
        const bucket = item.inventory_bucket || item.inventory_type || 'unknown';
        const key = item.sub_inventory
          ? `load:${item.sub_inventory}`
          : `bucket:${bucket}`;
        totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + 1);
        itemMap.set(item.id, {
          sub_inventory: item.sub_inventory ?? null,
          inventory_bucket: bucket,
        });
      }

      const { data: scanRows, error: scanError } = await supabase
        .from('product_location_history')
        .select('inventory_item_id')
        .eq('location_id', locationId)
        .not('inventory_item_id', 'is', null);

      if (scanError) throw scanError;

      const scannedByKey = new Map<string, number>();
      const scannedIds = new Set<string>();
      for (const row of scanRows ?? []) {
        if (row.inventory_item_id) {
          scannedIds.add(row.inventory_item_id);
        }
      }

      for (const id of scannedIds) {
        const item = itemMap.get(id);
        if (!item) continue;
        const bucket = item.inventory_bucket || 'unknown';
        const key = item.sub_inventory
          ? `load:${item.sub_inventory}`
          : `bucket:${bucket}`;
        scannedByKey.set(key, (scannedByKey.get(key) ?? 0) + 1);
      }

      return { totalsByKey, scannedByKey };
    },
  });

  const sessionCounts = sessionCountsQuery.data;
  const getCountsForSession = (session: SessionSummary) => {
    if (!sessionCounts) {
      // No stale snapshot fallback - query is loading, use 0 until data arrives
      return { total: 0, scanned: session.scannedCount };
    }
    const key = session.subInventory
      ? `load:${session.subInventory}`
      : `bucket:${session.inventoryType}`;
    const total = sessionCounts.totalsByKey.get(key) ?? 0;
    const scanned = sessionCounts.scannedByKey.get(key) ?? 0;
    return { total, scanned };
  };


  const renderSessionCard = (session: SessionSummary) => {
    const counts = getCountsForSession(session);
    const totalItems = counts.total;
    const scannedCount = counts.scanned;
    const isClosed = session.status === 'closed';
    const progress = totalItems > 0 ? Math.round((scannedCount / totalItems) * 100) : 0;
    const timestamp = isClosed
      ? formatSessionTimestamp(session.closedAt || session.updatedAt || session.createdAt)
      : formatSessionTimestamp(session.createdAt);

    return (
      <Card key={session.id} className="p-4 space-y-4 border-border/60 bg-background/90">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <BucketPill bucket={session.inventoryType} />
              {session.subInventory && (() => {
                const metadata = sessionLoadMetadata.get(session.subInventory);
                const friendlyName = metadata?.friendly_name;
                const color = metadata?.primary_color;
                const csoValue = metadata?.ge_cso?.trim() || '';
                const csoTail = csoValue ? csoValue.slice(-4) : '';
                const csoPrefix = csoValue.length > 4
                  ? (isMobile ? '...' : csoValue.slice(0, -4))
                  : '';

                return (
                  <Badge variant="secondary" className="flex items-center gap-1.5">
                    {color && (
                      <div
                        className="h-6 w-6 rounded-md flex-shrink-0 shadow-sm border border-border"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <span>
                      {friendlyName || session.subInventory}
                      {csoValue && (
                        <span>
                          {' - '}
                          {csoPrefix}
                          <span className="underline decoration-dotted underline-offset-2">
                            {csoTail || csoValue}
                          </span>
                        </span>
                      )}
                    </span>
                  </Badge>
                );
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden text-[10px] font-semibold text-foreground">
                {session.createdBy && creatorAvatars[session.createdBy] ? (
                  <img
                    src={creatorAvatars[session.createdBy] as string}
                    alt={session.createdBy}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span>{getInitials(session.createdBy ?? 'Unknown')}</span>
                )}
              </div>
              <span>{session.createdBy ?? 'Unknown'}</span>
              <span>•</span>
              <span>{timestamp}</span>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="text-lg font-semibold text-foreground">
              {scannedCount}/{totalItems}
            </div>
            <div>scanned</div>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{progress}% complete</span>
            <div className="flex items-center gap-2">
              <Button
                size="responsive"
                onClick={() => onViewChange?.('map')}
              >
                View Map
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const activeSessions = filteredSessions.filter(session => session.status !== 'closed');
  const closedSessions = filteredSessions.filter(session => session.status === 'closed');

  const availableSessionTypes = useMemo(() => {
    const base =
      sessionListTab === 'active'
        ? activeSessions
        : sessionListTab === 'closed'
          ? closedSessions
        : filteredSessions;
    const types = Array.from(new Set(base.map(session => session.inventoryType)));
    return types.sort((a, b) => getInventoryTypeLabel(a).localeCompare(getInventoryTypeLabel(b)));
  }, [activeSessions, closedSessions, filteredSessions, sessionListTab]);

  const filteredActiveSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return activeSessions.filter(session => {
      const matchesType = sessionTypeFilter === 'all' || session.inventoryType === sessionTypeFilter;
      const matchesSearch =
        !query ||
        session.name.toLowerCase().includes(query) ||
        session.subInventory?.toLowerCase().includes(query) ||
        session.createdBy?.toLowerCase().includes(query) ||
        getInventoryTypeLabel(session.inventoryType).toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [activeSessions, sessionSearch, sessionTypeFilter]);

  const filteredClosedSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return closedSessions.filter(session => {
      const matchesType = sessionTypeFilter === 'all' || session.inventoryType === sessionTypeFilter;
      const matchesSearch =
        !query ||
        session.name.toLowerCase().includes(query) ||
        session.subInventory?.toLowerCase().includes(query) ||
        session.createdBy?.toLowerCase().includes(query) ||
        getInventoryTypeLabel(session.inventoryType).toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [closedSessions, sessionSearch, sessionTypeFilter]);

  const visibleActiveSessions =
    sessionListTab === 'active' || sessionListTab === 'all'
      ? filteredActiveSessions
      : [];
  const visibleClosedSessions =
    sessionListTab === 'closed' || sessionListTab === 'all'
      ? filteredClosedSessions
      : [];

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader
          title="Scanning Sessions"
          onMenuClick={onMenuClick}
        />
      )}

      <PageContainer className="py-4 pb-24">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sessions"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              <div className="flex gap-2">
                <Select
                  value={sessionTypeFilter}
                  onValueChange={(value) => setSessionTypeFilter(value as 'all' | InventoryType)}
                >
                  <SelectTrigger className="h-10 flex-1 lg:w-[140px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableSessionTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {getInventoryTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sessionListTab}
                  onValueChange={(value) => setSessionListTab(value as 'active' | 'closed' | 'all')}
                >
                  <SelectTrigger className="h-10 flex-1 lg:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Open ({activeSessions.length})</SelectItem>
                    <SelectItem value="closed">Closed ({closedSessions.length})</SelectItem>
                    <SelectItem value="all">All ({filteredSessions.length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sessionsLoading && (
              <Card className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sessions…
              </Card>
            )}

            {sessionsDisplayError && !sessionsLoading && (
              <Alert variant="destructive">
                <AlertDescription>{sessionsDisplayError}</AlertDescription>
              </Alert>
            )}

            {!sessionsLoading &&
              !sessionsError &&
              visibleActiveSessions.length === 0 &&
              visibleClosedSessions.length === 0 && (
                <Card className="p-4 text-sm text-muted-foreground">
                  No sessions match the current filters.
                </Card>
              )}

            {visibleActiveSessions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">Open Sessions</span>
                  <span>{visibleActiveSessions.length} shown</span>
                </div>
                {visibleActiveSessions.map(renderSessionCard)}
              </div>
            )}

            {visibleClosedSessions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">Closed Sessions</span>
                  <span>{visibleClosedSessions.length} shown</span>
                </div>
                {visibleClosedSessions.map(renderSessionCard)}
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
