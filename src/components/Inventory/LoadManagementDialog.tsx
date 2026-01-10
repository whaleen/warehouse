import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit, Merge } from 'lucide-react';
import { getAllLoads, getLoadItemCount, updateLoadStatus } from '@/lib/loadManager';
import type { LoadMetadata, InventoryType, LoadStatus } from '@/types/inventory';
import { CreateLoadDialog } from './CreateLoadDialog';
import { LoadDetailDialog } from './LoadDetailDialog';
import { RenameLoadDialog } from './RenameLoadDialog';
import { MergeLoadsDialog } from './MergeLoadsDialog';

interface LoadManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LoadWithCount extends LoadMetadata {
  item_count: number;
}

export function LoadManagementDialog({ open, onOpenChange }: LoadManagementDialogProps) {
  const [selectedTab, setSelectedTab] = useState<InventoryType>('ASIS');
  const [loads, setLoads] = useState<LoadWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | LoadStatus>('all');
  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set());

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
    if (open) {
      fetchLoads();
      setSelectedLoads(new Set());
    }
  }, [open, selectedTab]);

  const filteredLoads = loads.filter(
    (load) => statusFilter === 'all' || load.status === statusFilter
  );

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Load Management</DialogTitle>
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
                <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Load
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as InventoryType)} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="ASIS">ASIS</TabsTrigger>
              <TabsTrigger value="FG">FG</TabsTrigger>
              <TabsTrigger value="LocalStock">Local Stock</TabsTrigger>
            </TabsList>

            <div className="px-1 py-3 border-b">
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

            <TabsContent value={selectedTab} className="flex-1 overflow-y-auto mt-0 p-1">
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
                    onClick={() => setCreateDialogOpen(true)}
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
                              <Badge className={getStatusColor(load.status)}>
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
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CreateLoadDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchLoads}
      />

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
