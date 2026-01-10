import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { renameLoad, updateLoadMetadata } from '@/lib/loadManager';
import type { LoadMetadata } from '@/types/inventory';

interface RenameLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadMetadata;
  onSuccess?: () => void;
}

export function RenameLoadDialog({ open, onOpenChange, load, onSuccess }: RenameLoadDialogProps) {
  const [newName, setNewName] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewName(load.sub_inventory_name);
      setCategory(load.category || '');
      setError(null);
    }
  }, [open, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      setError('Load name is required');
      return;
    }

    const nameChanged = newName.trim() !== load.sub_inventory_name;
    const categoryChanged = category.trim() !== (load.category || '');

    if (!nameChanged && !categoryChanged) {
      setError('No changes to save');
      return;
    }

    setLoading(true);
    setError(null);

    // If name changed, rename the load
    if (nameChanged) {
      const { success, error: renameError } = await renameLoad(
        load.inventory_type,
        load.sub_inventory_name,
        newName.trim()
      );

      if (!success) {
        setError(renameError || 'Failed to rename load');
        setLoading(false);
        return;
      }
    }

    // If category changed, update metadata
    if (categoryChanged) {
      const { success, error: updateError } = await updateLoadMetadata(
        load.inventory_type,
        nameChanged ? newName.trim() : load.sub_inventory_name,
        { category: category.trim() || undefined }
      );

      if (!success) {
        setError(updateError || 'Failed to update category');
        setLoading(false);
        return;
      }
    }

    setLoading(false);

    // Success
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Load</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-name">Current Name</Label>
            <Input id="current-name" value={load.sub_inventory_name} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-name">New Name *</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new load name..."
              required
            />
            <p className="text-xs text-muted-foreground">
              This will update the load metadata and all {load.inventory_type} items with this
              sub_inventory value.
            </p>
          </div>

          {(load.inventory_type === 'ASIS' || load.inventory_type === 'FG') && (
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {load.inventory_type === 'ASIS' && (
                    <>
                      <SelectItem value="Regular">Regular</SelectItem>
                      <SelectItem value="Salvage">Salvage</SelectItem>
                    </>
                  )}
                  {load.inventory_type === 'FG' && (
                    <SelectItem value="Back Haul">Back Haul</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {load.inventory_type === 'ASIS'
                  ? 'Categorize as Regular or Salvage ASIS load'
                  : 'Categorize as Back Haul load'}
              </p>
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
            <Button type="submit" disabled={loading || !newName.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
