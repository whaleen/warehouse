import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Info } from 'lucide-react';
import { getLoadItemCount, getLoadConflictCount, deleteLoad } from '@/lib/loadManager';
import { useLoads } from '@/hooks/queries/useLoads';
import type { LoadMetadata } from '@/types/inventory';
import { LoadDetailPanel } from './LoadDetailPanel';
import { LoadInfoModal } from './LoadInfoModal';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { PageContainer } from '@/components/Layout/PageContainer';
import { getPathForView } from '@/lib/routes';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoadDisplay } from '@/components/Loads/LoadDisplay';

interface LoadWithCount extends LoadMetadata {
  item_count: number;
  conflict_count: number;
}

interface LoadManagementViewProps {
  onMenuClick?: () => void;
}

export function LoadManagementView({ onMenuClick }: LoadManagementViewProps) {
  const isMobile = useIsMobile();
  const [loads, setLoads] = useState<LoadWithCount[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [showAway, setShowAway] = useState(false);
  const { data: loadsData, isLoading: loading, refetch } = useLoads(undefined, showAway);
  const [pendingLoadSelection, setPendingLoadSelection] = useState<string | null>(null);
  const [isStandaloneDetail, setIsStandaloneDetail] = useState(false);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const standaloneScrollRef = useRef<HTMLDivElement | null>(null);

  // Filter state
  type LoadFilter = 'all' | 'for_sale' | 'picked' | 'shipped' | 'delivered';
  const [loadFilter, setLoadFilter] = useState<LoadFilter>('all');

  // Dialog states
  const [selectedLoadForDetail, setSelectedLoadForDetail] = useState<LoadMetadata | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadPendingDelete, setLoadPendingDelete] = useState<LoadMetadata | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalLoad, setInfoModalLoad] = useState<LoadWithCount | null>(null);

  const fetchLoadCounts = async (baseLoads: LoadMetadata[]) => {
    setLoadingCounts(true);
    // Fetch item counts for each load
    const loadsWithCounts = await Promise.all(
      baseLoads.map(async (load) => {
        const [{ count: itemCount }, { count: conflictCount }] = await Promise.all([
          getLoadItemCount(load.inventory_type, load.sub_inventory_name),
          getLoadConflictCount(load.inventory_type, load.sub_inventory_name),
        ]);
        return { ...load, item_count: itemCount, conflict_count: conflictCount };
      })
    );
    setLoads(loadsWithCounts);
    setLoadingCounts(false);
  };

  useEffect(() => {
    if (loadsData) {
      fetchLoadCounts(loadsData);
    }
  }, [loadsData]);

  const syncLocationFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    const pathLoad = segments[0] === 'loads' && segments[1] ? decodeURIComponent(segments[1]) : null;
    const loadParam = pathLoad || params.get('load');
    if (loadParam) {
      setPendingLoadSelection(loadParam);
      setIsStandaloneDetail(params.get('from') !== 'loads');
    } else {
      setPendingLoadSelection(null);
      setSelectedLoadForDetail(null);
      setIsStandaloneDetail(false);
    }
  };

  useEffect(() => {
    syncLocationFromUrl();
    const handleLocationChange = () => syncLocationFromUrl();
    window.addEventListener('app:locationchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('app:locationchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (!pendingLoadSelection || loads.length === 0) return;
    const match = loads.find((load) => load.sub_inventory_name === pendingLoadSelection);
    if (match) {
      setSelectedLoadForDetail(match);
      setPendingLoadSelection(null);
    }
  }, [pendingLoadSelection, loads]);

  useEffect(() => {
    if (!selectedLoadForDetail) return;
    const updated = loads.find((load) => load.id === selectedLoadForDetail.id);
    if (!updated) {
      setSelectedLoadForDetail(null);
      return;
    }
    if (updated !== selectedLoadForDetail) {
      setSelectedLoadForDetail(updated);
    }
  }, [loads, selectedLoadForDetail]);

  useEffect(() => {
    if (!selectedLoadForDetail?.id) return;
    detailScrollRef.current?.scrollTo({ top: 0 });
    standaloneScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedLoadForDetail?.id]);

  const normalizeGeStatus = (status?: string | null) => status?.toLowerCase().trim() ?? '';

  const handleLoadClick = (load: LoadMetadata) => {
    setSelectedLoadForDetail((prev) => {
      const next = prev?.id === load.id ? null : load;
      const params = new URLSearchParams(window.location.search);
      params.delete('load');
        if (next) {
          params.set('from', 'loads');
          const path = `/loads/${encodeURIComponent(load.sub_inventory_name)}`;
        const nextUrl = params.toString() ? `${path}?${params.toString()}` : path;
        window.history.replaceState({}, '', nextUrl);
      } else {
        params.delete('from');
        const nextUrl = params.toString() ? `/loads?${params.toString()}` : '/loads';
        window.history.replaceState({}, '', nextUrl);
      }
      window.dispatchEvent(new Event('app:locationchange'));
      return next;
    });
  };

  const handleStandaloneClose = () => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    params.delete('from');
    params.delete('load');
    const target = from === 'dashboard' ? getPathForView('dashboard') : getPathForView('loads');
    const nextUrl = params.toString() ? `${target}?${params.toString()}` : target;
    window.history.replaceState({}, '', nextUrl);
    window.dispatchEvent(new Event('app:locationchange'));
  };


  const handleDeleteClick = (load: LoadMetadata) => {
    setLoadPendingDelete(load);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!loadPendingDelete) return;

    const { success, error } = await deleteLoad(
      loadPendingDelete.inventory_type,
      loadPendingDelete.sub_inventory_name,
      true // clearItems - set sub_inventory to null
    );

    if (success) {
      toast.success(`Deleted load "${loadPendingDelete.friendly_name || loadPendingDelete.sub_inventory_name}".`);
      if (selectedLoadForDetail?.id === loadPendingDelete.id) {
        setSelectedLoadForDetail(null);
      }
      refetch();
    } else {
      toast.error(`Failed to delete load: ${error?.message || 'Unknown error'}`);
    }

    setLoadPendingDelete(null);
  };

  const isAwayStatus = (status?: string | null) => {
    const normalized = normalizeGeStatus(status);
    // Only "delivered" is away - "shipped" means sold awaiting pickup (still on floor)
    return normalized === 'delivered';
  };

  const isVisibleLoad = (load: LoadMetadata) => {
    const source = normalizeGeStatus(load.ge_source_status);
    if (source !== 'for sale' && source !== 'sold') return false;
    if (!showAway && isAwayStatus(load.ge_cso_status)) return false;
    return true;
  };

  useEffect(() => {
    if (!showAway && loadFilter === 'delivered') {
      setLoadFilter('all');
    }
  }, [showAway, loadFilter]);

  return (
    <>
      <div className="h-screen bg-background flex flex-col">
        {!isMobile && (
          <AppHeader
            title={
              isStandaloneDetail
                ? `Load ${selectedLoadForDetail?.friendly_name || selectedLoadForDetail?.sub_inventory_name || ''}`.trim()
                : "ASIS Loads"
            }
            onMenuClick={onMenuClick}
          />
        )}

        <PageContainer className="py-4 pb-24 flex-1 min-h-0 overflow-hidden">
          <div className="flex min-h-0 flex-col gap-4 h-full">
            {/* Filter Tabs */}
            {!isStandaloneDetail && !loading && loads.length > 0 && (
              <div
                className={`sticky top-0 z-10 -mx-2 px-2 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${
                  selectedLoadForDetail ? 'hidden lg:flex' : 'flex'
                } flex-wrap gap-2`}
              >
                {([
                  { key: 'all', label: 'All' },
                  { key: 'for_sale', label: 'For Sale' },
                  { key: 'picked', label: 'Picked' },
                  { key: 'shipped', label: 'Shipped' },
                  { key: 'delivered', label: 'Delivered' },
                ] as const).map(({ key, label }) => {
                  // Only hide "delivered" when showAway is off (shipped is still on floor)
                  if (!showAway && key === 'delivered') {
                    return null;
                  }
                  const count = loads.filter((load) => {
                    if (!isVisibleLoad(load)) return false;
                    if (key === 'all') return true;
                    if (key === 'for_sale') return normalizeGeStatus(load.ge_source_status) === 'for sale';
                    return (
                      normalizeGeStatus(load.ge_source_status) === 'sold' &&
                      normalizeGeStatus(load.ge_cso_status) === key
                    );
                  }).length;
                  return (
                    <Button
                      key={key}
                      size="responsive"
                      variant={loadFilter === key ? 'default' : 'outline'}
                      onClick={() => setLoadFilter(key)}
                      className="h-8"
                    >
                      {label}
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">Show delivered</span>
                  <Switch checked={showAway} onCheckedChange={setShowAway} />
                </div>
              </div>
            )}

            {/* Load List */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {loading || loadingCounts ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : loads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p>No loads found</p>
                  <p className="text-sm mt-2">Use GE Sync in settings to import loads.</p>
                </div>
              ) : isStandaloneDetail ? (
                <div className="flex h-full min-h-0 flex-col gap-4">
                  <div>
                    <Button
                      variant="outline"
                      size="responsive"
                      onClick={() => {
                        const params = new URLSearchParams(window.location.search);
                        params.delete('from');
                        params.delete('load');
                        const nextUrl = params.toString() ? `/loads?${params.toString()}` : '/loads';
                        window.history.replaceState({}, '', nextUrl);
                        window.dispatchEvent(new Event('app:locationchange'));
                      }}
                    >
                      View all loads
                    </Button>
                  </div>
                  <div ref={standaloneScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                    {selectedLoadForDetail ? (
                      <LoadDetailPanel
                        load={selectedLoadForDetail}
                        allLoads={loads}
                        onClose={handleStandaloneClose}
                        onDelete={handleDeleteClick}
                        onMetaUpdated={(updates) => {
                          setLoads((prev) =>
                            prev.map((entry) =>
                              entry.id === selectedLoadForDetail.id
                                ? { ...entry, ...updates }
                                : entry
                            )
                          );
                          setSelectedLoadForDetail((prev) =>
                            prev ? { ...prev, ...updates } : prev
                          );
                        }}
                      />
                    ) : (
                      <Card className="p-6 text-sm text-muted-foreground">
                        Select a load to view details.
                      </Card>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
                  {/* Load List - hidden on mobile when a load is selected */}
                  <div
                    className={`min-h-0 overflow-y-auto space-y-2 ${
                      selectedLoadForDetail ? (isStandaloneDetail ? 'hidden' : 'hidden lg:block') : ''
                    }`}
                  >
                    {loads
                      .filter((load) => isVisibleLoad(load))
                      .filter((load) => {
                        if (loadFilter === 'all') return true;
                        if (loadFilter === 'for_sale') return normalizeGeStatus(load.ge_source_status) === 'for sale';
                        return (
                          normalizeGeStatus(load.ge_source_status) === 'sold' &&
                          normalizeGeStatus(load.ge_cso_status) === loadFilter
                        );
                      })
                      .map((load) => {
                      return (
                        <div
                          key={load.id}
                          className="relative cursor-pointer"
                          onClick={() => handleLoadClick(load)}
                          role="button"
                        >
                          <LoadDisplay
                            load={load}
                            variant="card"
                            showProgress={true}
                            showCSO={true}
                            showActions={false}
                            className={`transition ${
                              selectedLoadForDetail?.id === load.id
                                ? 'border-primary/50 bg-primary/5'
                                : 'hover:bg-accent'
                            }`}
                          />
                          {/* Info button overlay */}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfoModalLoad(load);
                              setInfoModalOpen(true);
                            }}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Load Detail Panel - on mobile, shown with back button when selected */}
                  <div
                    ref={detailScrollRef}
                    className={`min-h-0 overflow-y-auto ${
                      selectedLoadForDetail ? '' : isStandaloneDetail ? 'hidden' : 'hidden lg:block'
                    }`}
                  >
                    {selectedLoadForDetail ? (
                      <div className="space-y-3">
                        <LoadDetailPanel
                          load={selectedLoadForDetail}
                          allLoads={loads}
                          onClose={() => setSelectedLoadForDetail(null)}
                          onDelete={handleDeleteClick}
                          onMetaUpdated={(updates) => {
                            setLoads((prev) =>
                              prev.map((entry) =>
                                entry.id === selectedLoadForDetail.id
                                  ? { ...entry, ...updates }
                                  : entry
                              )
                            );
                            setSelectedLoadForDetail((prev) =>
                              prev ? { ...prev, ...updates } : prev
                            );
                          }}
                        />
                      </div>
                    ) : (
                      <Card className="p-6 text-sm text-muted-foreground">
                        Select a load to view details.
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </PageContainer>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setLoadPendingDelete(null);
        }}
        title={
          loadPendingDelete
            ? `Delete load "${loadPendingDelete.friendly_name || loadPendingDelete.sub_inventory_name}"?`
            : "Delete load?"
        }
        description={
          loadPendingDelete
            ? `This removes the load metadata but keeps all ${loadPendingDelete.inventory_type} items. Items will no longer be assigned to this load.`
            : undefined
        }
        confirmText="Delete Load"
        cancelText="Keep Load"
        destructive
        onConfirm={confirmDelete}
      />

      <LoadInfoModal
        load={infoModalLoad}
        open={infoModalOpen}
        onOpenChange={setInfoModalOpen}
        itemCount={infoModalLoad?.item_count}
      />
    </>
  );
}
