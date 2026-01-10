import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { createLoad } from '@/lib/loadManager';
import type { InventoryType } from '@/types/inventory';

interface CreateLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateLoadDialog({ open, onOpenChange, onSuccess }: CreateLoadDialogProps) {
  const [inventoryType, setInventoryType] = useState<InventoryType>('ASIS');
  const [loadName, setLoadName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLoadName = () => {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    return `LOAD-${date}-${suffix}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loadName.trim()) {
      setError('Load name is required');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: createError } = await createLoad(
      inventoryType,
      loadName.trim(),
      notes.trim() || undefined
    );

    setLoading(false);

    if (createError) {
      setError(createError.message || 'Failed to create load');
      return;
    }

    // Success - reset form and close
    setLoadName('');
    setNotes('');
    setInventoryType('ASIS');
    onOpenChange(false);
    onSuccess?.();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setLoadName('');
      setNotes('');
      setError(null);
      setInventoryType('ASIS');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Load</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inventory-type">Inventory Type</Label>
            <Select
              value={inventoryType}
              onValueChange={(v) => setInventoryType(v as InventoryType)}
            >
              <SelectTrigger id="inventory-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASIS">ASIS</SelectItem>
                <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                <SelectItem value="LocalStock">Local Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="load-name">Load Name *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLoadName(generateLoadName())}
              >
                Suggest Name
              </Button>
            </div>
            <Input
              id="load-name"
              value={loadName}
              onChange={(e) => setLoadName(e.target.value)}
              placeholder="e.g., LOAD-2026-01-09-A"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this load..."
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !loadName.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Load
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
