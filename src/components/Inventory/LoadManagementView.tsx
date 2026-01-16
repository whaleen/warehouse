import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit, Merge, Trash2, ChevronRight } from 'lucide-react';
import { getAllLoads, getLoadItemCount, getLoadConflictCount, updateLoadStatus, deleteLoad } from '@/lib/loadManager';
import type { LoadMetadata, InventoryType, LoadStatus } from '@/types/inventory';
import { RenameLoadDialog } from './RenameLoadDialog';
import { MergeLoadsDialog } from './MergeLoadsDialog';
import { LoadDetailDialog } from './LoadDetailDialog';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { PageContainer } from '@/components/Layout/PageContainer';

interface LoadWithCount extends LoadMetadata {
  item_count: number;
  conflict_count: number;
}

interface LoadManagementViewProps {
  onViewChange: (view: 'dashboard' | 'inventory' | 'products' | 'settings' | 'loads' | 'create-load') => void;
  onMenuClick?: () => void;
}

export function LoadManagementView({ onViewChange, onMenuClick }: LoadManagementViewProps) {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState<InventoryType>('ASIS');
  const [loads, setLoads] = useState<LoadWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | LoadStatus>('all');
  const [subTypeFilter, setSubTypeFilter] = useState<'all' | InventoryType>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set());

  // Dialog states
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLoadForDetail, setSelectedLoadForDetail] = useState<LoadMetadata | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedLoadForRename, setSelectedLoadForRename] = useState<LoadMetadata | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadPendingDelete, setLoadPendingDelete] = useState<LoadMetadata | null>(null);

  const fetchLoads = async () => {
    setLoading(true);
    const { data, error } = await getAllLoads(selectedTab);

    if (!error && data) {
      // Fetch item counts for each load
      const loadsWithCounts = await Promise.all(
        data.map(async (load) => {
          const [{ count: itemCount }, { count: conflictCount }] = await Promise.all([
            getLoadItemCount(load.inventory_type, load.sub_inventory_name),
            getLoadConflictCount(load.inventory_type, load.sub_inventory_name),
          ]);
          return { ...load, item_count: itemCount, conflict_count: conflictCount };
        })
      );
      setLoads(loadsWithCounts);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLoads();
    setSelectedLoads(new Set());
    setSubTypeFilter('all');
    setCategoryFilter('all');
  }, [selectedTab]);

  const filteredLoads = loads.filter((load) => {
    const matchesStatus = statusFilter === 'all' || load.status === statusFilter;
    const matchesSubType = subTypeFilter === 'all' || load.inventory_type === subTypeFilter;
    const matchesCategory = categoryFilter === 'all' || load.category === categoryFilter;
    return matchesStatus && matchesSubType && matchesCategory;
  });

  const getCategoryOptions = () => {
    switch (selectedTab) {
      case 'ASIS':
        return ['Regular', 'Salvage'];
      case 'FG':
        return ['Back Haul'];
      default:
        return [];
    }
  };

  const getSubTypeOptions = () => {
    switch (selectedTab) {
      case 'ASIS':
        // ASIS has no sub-types, all loads are just ASIS inventory_type
        return [];
      case 'FG':
        return [
          { value: 'FG', label: 'FG' },
          { value: 'BackHaul', label: 'Back Haul' }
        ];
      case 'LocalStock':
        return [
          { value: 'LocalStock', label: 'Local Stock' },
          { value: 'Staged', label: 'Staged' },
          { value: 'Inbound', label: 'Inbound' },
          { value: 'WillCall', label: 'Will Call' }
        ];
      default:
        return [];
    }
  };

  const handleStatusChange = async (load: LoadMetadata, newStatus: LoadStatus) => {
    await updateLoadStatus(load.inventory_type, load.sub_inventory_name, newStatus);
    fetchLoads();
  };

  const handleLoadClick = (load: LoadMetadata) => {
    setSelectedLoadForDetail(load);
    setDetailDialogOpen(true);
  };

  const handleRenameClick = (load: LoadMetadata) => {
    setSelectedLoadForRename(load);
    setRenameDialogOpen(true);
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
      toast({
        message: `Deleted load "${loadPendingDelete.sub_inventory_name}".`,
        variant: 'success',
      });
      fetchLoads();
    } else {
      toast({
        message: `Failed to delete load: ${error?.message || 'Unknown error'}`,
        variant: 'error',
      });
    }

    setLoadPendingDelete(null);
  };

  const toggleLoadSelection = (loadId: string) => {
    const newSelection = new Set(selectedLoads);
    if (newSelection.has(loadId)) {
      newSelection.delete(loadId);
    } else {
      newSelection.add(loadId);
    }
    setSelectedLoads(newSelection);
  };

  const getStatusColor = (status: LoadStatus) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500';
      case 'staged':
        return 'bg-yellow-500';
      case 'in_transit':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: LoadStatus) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'staged':
        return 'Staged';
      case 'in_transit':
        return 'In Transit';
      case 'delivered':
        return 'Delivered';
      default:
        return status;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <AppHeader
          title="Load Management"
          onMenuClick={onMenuClick}
          actions={
            <div className="flex flex-wrap gap-2">
              {selectedLoads.size >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMergeDialogOpen(true)}
                >
                  <Merge className="mr-2 h-4 w-4" />
                  Merge ({selectedLoads.size})
                </Button>
              )}
              <Button size="sm" onClick={() => onViewChange('create-load')}>
                <Plus className="mr-2 h-4 w-4" />
                New Load
              </Button>
            </div>
          }
        />

        <PageContainer className="py-4 space-y-4 pb-24">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as InventoryType)} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="ASIS">ASIS</TabsTrigger>
              <TabsTrigger value="FG">FG</TabsTrigger>
              <TabsTrigger value="LocalStock">Local Stock</TabsTrigger>
            </TabsList>

            <div className="px-1 py-3 border-b flex flex-wrap gap-3">
              {getSubTypeOptions().length > 0 && (
                <Select value={subTypeFilter} onValueChange={(v) => setSubTypeFilter(v as 'all' | InventoryType)}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {getSubTypeOptions().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {getCategoryOptions().length > 0 && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {getCategoryOptions().map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | LoadStatus)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="staged">Staged</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <TabsContent value={selectedTab} className="flex-1 overflow-y-auto mt-4 p-1">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredLoads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <p>No loads found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => onViewChange('create-load')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Load
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLoads.map((load) => (
                    <Card
                      key={load.id}
                      className="p-4 hover:bg-accent/30 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedLoads.has(load.id!)}
                            onChange={() => toggleLoadSelection(load.id!)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{load.sub_inventory_name}</h3>
                              <Badge variant="outline">{load.inventory_type}</Badge>
                              {load.category && (
                                <Badge variant="secondary">{load.category}</Badge>
                              )}
                              <Badge className={getStatusColor(load.status)}>
                                {getStatusLabel(load.status)}
                              </Badge>
                              {load.conflict_count > 0 && (
                                <Badge variant="destructive">
                                  {load.conflict_count} conflict{load.conflict_count === 1 ? '' : 's'}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>{load.item_count} items</span>
                              <span>Created {new Date(load.created_at!).toLocaleDateString()}</span>
                            </div>
                            {load.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{load.notes}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoadClick(load)}
                          >
                            View
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                          <Select
                            value={load.status}
                            onValueChange={(v) => handleStatusChange(load, v as LoadStatus)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="staged">Staged</SelectItem>
                              <SelectItem value="in_transit">In Transit</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRenameClick(load)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(load)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </PageContainer>
      </div>

      

      {selectedLoadForDetail && (
        <LoadDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          load={selectedLoadForDetail}
          onUpdate={fetchLoads}
        />
      )}

      {selectedLoadForRename && (
        <RenameLoadDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          load={selectedLoadForRename}
          onSuccess={fetchLoads}
        />
      )}

      {selectedLoads.size >= 2 && (
        <MergeLoadsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          inventoryType={selectedTab}
          sourceLoadIds={Array.from(selectedLoads)}
          loads={loads.filter((l) => selectedLoads.has(l.id!))}
          onSuccess={() => {
            setSelectedLoads(new Set());
            fetchLoads();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setLoadPendingDelete(null);
        }}
        title={
          loadPendingDelete
            ? `Delete load "${loadPendingDelete.sub_inventory_name}"?`
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
    </>
  );
}
