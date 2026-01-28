import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Check, Package, ShoppingCart, Camera, Plus, Trash2 } from 'lucide-react';
import { snapshotTrackedParts } from '@/lib/partsManager';
import {
  useTrackedParts,
  useUpdatePartCount,
  useMarkAsReordered,
  useUpdateThreshold,
  useRemoveTrackedPart
} from '@/hooks/queries/useParts';
import { PartsTrackingDialog } from './PartsTrackingDialog';
import type { TrackedPartWithDetails } from '@/types/inventory';
import { usePartsListView } from '@/hooks/usePartsListView';
import { PartsListViewToggle } from './PartsListViewToggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface PartsInventoryTabProps {
  searchTerm: string;
  statusFilter?: 'all' | 'reorder';
  onRefresh?: () => void;
}

export function PartsInventoryTab({ searchTerm, statusFilter = 'all', onRefresh }: PartsInventoryTabProps) {
  const { data: parts, isLoading: loading, refetch } = useTrackedParts();
  const updatePartCountMutation = useUpdatePartCount();
  const markAsReorderedMutation = useMarkAsReordered();
  const updateThresholdMutation = useUpdateThreshold();
  const removeTrackedPartMutation = useRemoveTrackedPart();

  const [updating, setUpdating] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [pendingPart, setPendingPart] = useState<TrackedPartWithDetails | null>(null);
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<'usage' | 'return' | 'restock' | ''>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState<string>('');
  const { view, setView } = usePartsListView();
  const effectiveView = view === 'table' ? 'compact' : view;
  const isImageView = effectiveView === 'images';

  const handleStartEdit = (part: TrackedPartWithDetails) => {
    setEditingId(part.id);
    setEditValue(part.current_qty.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleSaveCount = async (part: TrackedPartWithDetails) => {
    const newQty = parseInt(editValue, 10);
    if (isNaN(newQty) || newQty < 0) {
      handleCancelEdit();
      return;
    }

    if (newQty === part.current_qty) {
      handleCancelEdit();
      return;
    }

    setPendingPart(part);
    setPendingQty(newQty);
    setSelectedReason('');
    setReasonDialogOpen(true);
    handleCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent, part: TrackedPartWithDetails) => {
    if (e.key === 'Enter') {
      handleSaveCount(part);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleMarkReordered = async (part: TrackedPartWithDetails) => {
    setMarkingId(part.id);
    try {
      await markAsReorderedMutation.mutateAsync(part.id);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to mark as reordered:', error);
    }
    setMarkingId(null);
  };

  const handleSnapshotAll = async () => {
    if (!parts || parts.length === 0 || snapshotting) return;

    setSnapshotting(true);
    const { success, error } = await snapshotTrackedParts(parts);
    if (!success) {
      console.error('Failed to snapshot counts:', error);
    }
    setSnapshotting(false);
  };

  const handleConfirmReason = async () => {
    if (!pendingPart || pendingQty === null || !selectedReason) return;

    setUpdating(pendingPart.id);
    try {
      await updatePartCountMutation.mutateAsync({
        productId: pendingPart.product_id,
        newQty: pendingQty,
        reason: selectedReason
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to update count:', error);
    }

    setUpdating(null);
    setReasonDialogOpen(false);
    setPendingPart(null);
    setPendingQty(null);
    setSelectedReason('');
  };

  const handleCancelReason = () => {
    setReasonDialogOpen(false);
    setPendingPart(null);
    setPendingQty(null);
    setSelectedReason('');
  };

  // Threshold editing
  const handleStartEditThreshold = (part: TrackedPartWithDetails) => {
    setEditingThresholdId(part.id);
    setThresholdValue(part.reorder_threshold.toString());
  };

  const handleCancelEditThreshold = () => {
    setEditingThresholdId(null);
    setThresholdValue('');
  };

  const handleSaveThreshold = async (part: TrackedPartWithDetails) => {
    const newThreshold = parseInt(thresholdValue, 10);
    if (isNaN(newThreshold) || newThreshold < 0) {
      handleCancelEditThreshold();
      return;
    }

    if (newThreshold === part.reorder_threshold) {
      handleCancelEditThreshold();
      return;
    }

    setUpdating(part.id);
    try {
      await updateThresholdMutation.mutateAsync({
        trackedPartId: part.id,
        threshold: newThreshold
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to update threshold:', error);
    }

    setUpdating(null);
    handleCancelEditThreshold();
  };

  const handleThresholdKeyDown = (
    e: React.KeyboardEvent,
    part: TrackedPartWithDetails
  ) => {
    if (e.key === 'Enter') {
      handleSaveThreshold(part);
    } else if (e.key === 'Escape') {
      handleCancelEditThreshold();
    }
  };

  const handleRemovePart = async (part: TrackedPartWithDetails) => {
    if (!confirm(`Stop tracking ${part.products?.model ?? 'this part'}?`)) {
      return;
    }

    setUpdating(part.id);
    try {
      await removeTrackedPartMutation.mutateAsync(part.id);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to remove tracked part:', error);
    }

    setUpdating(null);
  };

  const handlePartAdded = () => {
    refetch();
    onRefresh?.();
  };

  const getStatusBadge = (part: TrackedPartWithDetails) => {
    const { current_qty, reorder_threshold, reordered_at } = part;

    if (reordered_at && current_qty <= reorder_threshold) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          Reordered
        </Badge>
      );
    }

    if (current_qty === 0) {
      return <Badge variant="destructive">OUT</Badge>;
    }
    if (current_qty <= reorder_threshold) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
          <AlertTriangle className="h-3 w-3 mr-1" />
          LOW
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Check className="h-3 w-3 mr-1" />
        OK
      </Badge>
    );
  };

  const needsReorder = (part: TrackedPartWithDetails) => {
    return part.current_qty <= part.reorder_threshold && !part.reordered_at;
  };

  const filteredParts = (parts ?? []).filter(part => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      part.products?.model?.toLowerCase().includes(q) ||
      part.products?.description?.toLowerCase().includes(q) ||
      part.products?.brand?.toLowerCase().includes(q)
    );
  });
  const statusFilteredParts =
    statusFilter === 'reorder'
      ? filteredParts.filter(part => needsReorder(part))
      : filteredParts;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading tracked parts...</span>
      </div>
    );
  }

  if (!parts || parts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Parts
          </Button>
        </div>
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Parts Being Tracked</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
            Add parts you want to monitor for inventory counts and reorder alerts.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Part
          </Button>
        </Card>
        <PartsTrackingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onPartAdded={handlePartAdded}
        />
      </div>
    );
  }

  if (statusFilteredParts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PartsListViewToggle view={view} onChange={setView} />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Parts
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {statusFilter === 'reorder'
              ? searchTerm
                ? 'No parts needing reorder match your search.'
                : 'No parts need reordering right now.'
              : 'No parts match your search.'}
          </p>
        </div>
        <PartsTrackingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onPartAdded={handlePartAdded}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PartsListViewToggle view={effectiveView} onChange={setView} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="responsive"
            onClick={handleSnapshotAll}
            disabled={snapshotting || parts.length === 0}
          >
            {snapshotting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Snapshotting...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Snapshot All
              </>
            )}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Parts
          </Button>
        </div>
      </div>
      {statusFilteredParts.map(part => (
        <Card key={part.id} className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {isImageView && (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {part.products?.image_url ? (
                    <img
                      src={part.products.image_url}
                      alt={part.products?.model ?? 'Part image'}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-medium truncate">
                    {part.products?.model ?? 'Unknown'}
                  </span>
                  {part.products?.brand && (
                    <Badge variant="outline" className="shrink-0">
                      {part.products.brand}
                    </Badge>
                  )}
                </div>
                {part.products?.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {part.products.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>Reorder at:</span>
                  {editingThresholdId === part.id ? (
                    <Input
                      type="number"
                      min="0"
                      value={thresholdValue}
                      onChange={e => setThresholdValue(e.target.value)}
                      onKeyDown={e => handleThresholdKeyDown(e, part)}
                      onBlur={() => handleSaveThreshold(part)}
                      autoFocus
                      className="w-14 h-6 text-center text-xs"
                      disabled={updating === part.id}
                    />
                  ) : (
                    <button
                      onClick={() => handleStartEditThreshold(part)}
                      className="font-mono px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-primary hover:text-primary transition-colors"
                      title="Click to edit threshold"
                    >
                      {part.reorder_threshold}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {editingId === part.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, part)}
                    onBlur={() => handleSaveCount(part)}
                    autoFocus
                    className="w-20 text-center"
                    disabled={updating === part.id}
                  />
                  {updating === part.id && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="responsive"
                  onClick={() => handleStartEdit(part)}
                  className="w-20 font-mono text-lg"
                >
                  {part.current_qty}
                </Button>
              )}

              {getStatusBadge(part)}

              {needsReorder(part) && (
                <Button
                  variant="outline"
                  size="responsive"
                  onClick={() => handleMarkReordered(part)}
                  disabled={markingId === part.id}
                  title="Mark as reordered"
                >
                  {markingId === part.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-3 w-3" />
                  )}
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemovePart(part)}
                disabled={updating === part.id}
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                title="Stop tracking"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <Dialog open={reasonDialogOpen} onOpenChange={(open) => {
        if (!open) handleCancelReason();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Why did this count change?</DialogTitle>
            <DialogDescription>
              Pick a reason so we can estimate usage rates later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup
              value={selectedReason}
              onValueChange={(value) =>
                setSelectedReason(value as 'usage' | 'return' | 'restock')
              }
              className="gap-3"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem id="reason-usage" value="usage" />
                <Label htmlFor="reason-usage">Usage</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem id="reason-return" value="return" />
                <Label htmlFor="reason-return">Return</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem id="reason-restock" value="restock" />
                <Label htmlFor="reason-restock">Restock</Label>
              </div>
            </RadioGroup>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelReason}>
                Cancel
              </Button>
              <Button onClick={handleConfirmReason} disabled={!selectedReason || updating !== null}>
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PartsTrackingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPartAdded={handlePartAdded}
      />
    </div>
  );
}
