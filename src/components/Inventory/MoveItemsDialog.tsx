import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { getAllLoads, createLoad } from '@/lib/loadManager';
import supabase from '@/lib/supabase';
import type { InventoryType, LoadMetadata } from '@/types/inventory';

interface MoveItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryType: InventoryType;
  currentLoadName?: string;
  selectedItemIds: string[];
  onSuccess?: () => void;
}

export function MoveItemsDialog({
  open,
  onOpenChange,
  inventoryType,
  currentLoadName,
  selectedItemIds,
  onSuccess,
}: MoveItemsDialogProps) {
  const [moveType, setMoveType] = useState<'existing' | 'new'>('existing');
  const [targetLoadName, setTargetLoadName] = useState('');
  const [newLoadName, setNewLoadName] = useState('');
  const [availableLoads, setAvailableLoads] = useState<LoadMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchLoads();
      setMoveType('existing');
      setTargetLoadName('');
      setNewLoadName('');
      setError(null);
    }
  }, [open, inventoryType]);

  const fetchLoads = async () => {
    const { data } = await getAllLoads(inventoryType);
    if (data) {
      // Filter out the current load
      const filtered = currentLoadName
        ? data.filter((l) => l.sub_inventory_name !== currentLoadName)
        : data;
      setAvailableLoads(filtered);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (moveType === 'existing' && !targetLoadName) {
      setError('Please select a target load');
      return;
    }

    if (moveType === 'new' && !newLoadName.trim()) {
      setError('Please enter a new load name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalLoadName = targetLoadName;

      // Create new load if needed
      if (moveType === 'new') {
        const { error: createError } = await createLoad(inventoryType, newLoadName.trim());
        if (createError) {
          setError(createError.message || 'Failed to create load');
          setLoading(false);
          return;
        }
        finalLoadName = newLoadName.trim();
      }

      // Update items' sub_inventory
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          sub_inventory: finalLoadName,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedItemIds);

      if (updateError) {
        setError(updateError.message || 'Failed to move items');
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

  const generateLoadName = () => {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `LOAD-${date}-${suffix}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {selectedItemIds.length} Items</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <RadioGroup value={moveType} onValueChange={(v) => setMoveType(v as 'existing' | 'new')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing" />
              <Label htmlFor="existing">Move to existing load</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new">Create new load</Label>
            </div>
          </RadioGroup>

          {moveType === 'existing' ? (
            <div className="space-y-2">
              <Label htmlFor="target-load">Target Load</Label>
              {availableLoads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other loads available. Create a new load instead.
                </p>
              ) : (
                <Select value={targetLoadName} onValueChange={setTargetLoadName}>
                  <SelectTrigger id="target-load">
                    <SelectValue placeholder="Select a load..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLoads.map((load) => (
                      <SelectItem key={load.id} value={load.sub_inventory_name}>
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
                placeholder="e.g., LOAD-2026-01-09-A"
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
              Move Items
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
