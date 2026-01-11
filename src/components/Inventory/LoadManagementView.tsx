import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit, Merge, Trash2 } from 'lucide-react';
import { getAllLoads, getLoadItemCount, updateLoadStatus, deleteLoad } from '@/lib/loadManager';
import type { LoadMetadata, InventoryType, LoadStatus } from '@/types/inventory';
import { RenameLoadDialog } from './RenameLoadDialog';
import { MergeLoadsDialog } from './MergeLoadsDialog';
import { LoadDetailDialog } from './LoadDetailDialog';
import { AppHeader } from '@/components/Navigation/AppHeader';

interface LoadWithCount extends LoadMetadata {
  item_count: number;
}

interface LoadManagementViewProps {
  onSettingsClick: () => void;
  onViewChange: (view: 'dashboard' | 'inventory' | 'products' | 'settings' | 'loads' | 'create-load') => void;
}

export function LoadManagementView({ onSettingsClick, onViewChange }: LoadManagementViewProps) {
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

  const fetchLoads = async () => {
    setLoading(true);
    const { data, error } = await getAllLoads(selectedTab);

    if (!error && data) {
      // Fetch item counts for each load
      const loadsWithCounts = await Promise.all(
        data.map(async (load) => {
          const { count } = await getLoadItemCount(load.inventory_type, load.sub_inventory_name);
          return { ...load, item_count: count };
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

  const handleRenameClick = (load: LoadMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLoadForRename(load);
    setRenameDialogOpen(true);
  };

  const handleDeleteClick = async (load: LoadMetadata, e: React.MouseEvent) => {
    e.stopPropagation();

    const confirmed = confirm(
      `Delete load "${load.sub_inventory_name}"?\n\n` +
      `This will remove the load metadata but keep all ${load.inventory_type} items. ` +
      `Items will no longer be assigned to this load.`
    );

    if (!confirmed) return;

    const { success, error } = await deleteLoad(
      load.inventory_type,
      load.sub_inventory_name,
      true // clearItems - set sub_inventory to null
    );

    if (success) {
      fetchLoads();
    } else {
      alert(`Failed to delete load: ${error?.message || 'Unknown error'}`);
    }
  };

  const toggleLoadSelection = (loadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedLoads);
    if (newSelection.has(loadId)) {
      newSelection.delete(loadId);
    } else {
      newSelection.add(loadId);
    }
    setSelectedLoads(newSelection);
  };

  const getStatusVariant = (status: LoadStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active':
      case 'delivered':
        return 'default'; // Primary color for active/positive statuses
      case 'staged':
        return 'outline'; // Less prominent for staged
      case 'in_transit':
        return 'secondary'; // Neutral for in transit
      default:
        return 'secondary'; // Fallback to neutral
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
          onSettingsClick={onSettingsClick}
          actions={
            <div className="flex gap-2">
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

        <div className="p-4 space-y-4 pb-24">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as InventoryType)} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="ASIS">ASIS</TabsTrigger>
              <TabsTrigger value="FG">FG</TabsTrigger>
              <TabsTrigger value="LocalStock">Local Stock</TabsTrigger>
            </TabsList>

            <div className="px-1 py-3 border-b flex gap-3">
              {getSubTypeOptions().length > 0 && (
                <Select value={subTypeFilter} onValueChange={(v) => setSubTypeFilter(v as 'all' | InventoryType)}>
                  <SelectTrigger className="w-[200px]">
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
                  <SelectTrigger className="w-[200px]">
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
                <SelectTrigger className="w-[200px]">
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
                      className="p-4 cursor-pointer hover:bg-accent transition"
                      onClick={() => handleLoadClick(load)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedLoads.has(load.id!)}
                            onChange={(e) => toggleLoadSelection(load.id!, e as any)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{load.sub_inventory_name}</h3>
                              <Badge variant="outline">{load.inventory_type}</Badge>
                              {load.category && (
                                <Badge variant="secondary">{load.category}</Badge>
                              )}
                              <Badge variant={getStatusVariant(load.status)}>
                                {getStatusLabel(load.status)}
                              </Badge>
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

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                            onClick={(e) => handleRenameClick(load, e)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleDeleteClick(load, e)}
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
        </div>
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
    </>
  );
}
