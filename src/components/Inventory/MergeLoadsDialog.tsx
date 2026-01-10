import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { mergeLoads } from '@/lib/loadManager';
import type { InventoryType, LoadMetadata } from '@/types/inventory';

interface MergeLoadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryType: InventoryType;
  sourceLoadIds: string[];
  loads: LoadMetadata[];
  onSuccess?: () => void;
}

export function MergeLoadsDialog({
  open,
  onOpenChange,
  inventoryType,
  sourceLoadIds,
  loads,
  onSuccess,
}: MergeLoadsDialogProps) {
  const [mergeType, setMergeType] = useState<'existing' | 'new'>('existing');
  const [targetLoadId, setTargetLoadId] = useState('');
  const [newLoadName, setNewLoadName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceLoads = loads.filter((l) => sourceLoadIds.includes(l.id!));
  const targetLoads = loads.filter((l) => !sourceLoadIds.includes(l.id!));

  useEffect(() => {
    if (open) {
      setMergeType('existing');
      setTargetLoadId('');
      setNewLoadName('');
      setError(null);
    }
  }, [open]);

  const generateLoadName = () => {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `MERGED-${date}-${suffix}`;
  };

  // const getTotalItems = () => {
  //   // This would need to be fetched from actual item counts
  //   // For now, just showing the count of loads being merged
  //   return sourceLoads.length;
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mergeType === 'existing' && !targetLoadId) {
      setError('Please select a target load');
      return;
    }

    if (mergeType === 'new' && !newLoadName.trim()) {
      setError('Please enter a new load name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalTargetName = '';

      if (mergeType === 'existing') {
        const targetLoad = loads.find((l) => l.id === targetLoadId);
        if (!targetLoad) {
          setError('Target load not found');
          setLoading(false);
          return;
        }
        finalTargetName = targetLoad.sub_inventory_name;
      } else {
        finalTargetName = newLoadName.trim();
      }

      const sourceNames = sourceLoads.map((l) => l.sub_inventory_name);

      const { success, error: mergeError } = await mergeLoads(
        inventoryType,
        sourceNames,
        finalTargetName,
        mergeType === 'new' // createTarget
      );

      if (!success) {
        setError(mergeError || 'Failed to merge loads');
        setLoading(false);
        return;
      }

      // Success
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge {sourceLoads.length} Loads</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source loads preview */}
          <div className="space-y-2">
            <Label>Loads to Merge</Label>
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              {sourceLoads.map((load) => (
                <div key={load.id} className="flex items-center justify-between">
                  <span>{load.sub_inventory_name}</span>
                  <span className="text-muted-foreground">{load.status}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>All items will be moved to the target load and source loads will be deleted</span>
            </div>
          </div>

          <RadioGroup value={mergeType} onValueChange={(v) => setMergeType(v as 'existing' | 'new')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing" />
              <Label htmlFor="existing">Merge into existing load</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new">Create new merged load</Label>
            </div>
          </RadioGroup>

          {mergeType === 'existing' ? (
            <div className="space-y-2">
              <Label htmlFor="target-load">Target Load</Label>
              {targetLoads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other loads available. Create a new load instead.
                </p>
              ) : (
                <Select value={targetLoadId} onValueChange={setTargetLoadId}>
                  <SelectTrigger id="target-load">
                    <SelectValue placeholder="Select target load..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targetLoads.map((load) => (
                      <SelectItem key={load.id} value={load.id!}>
                        {load.sub_inventory_name} ({load.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-load-name">New Load Name</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewLoadName(generateLoadName())}
                >
                  Suggest Name
                </Button>
              </div>
              <Input
                id="new-load-name"
                value={newLoadName}
                onChange={(e) => setNewLoadName(e.target.value)}
                placeholder="e.g., MERGED-2026-01-09-A"
              />
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge Loads
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
