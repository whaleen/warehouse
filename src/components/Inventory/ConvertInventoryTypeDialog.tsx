import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowRight } from 'lucide-react';
import { convertInventoryType } from '@/lib/inventoryConverter';
import type { InventoryType } from '@/types/inventory';

interface ConvertInventoryTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemIds: string[];
  currentInventoryType: InventoryType;
  currentSubInventory?: string;
  onSuccess?: () => void;
}

export function ConvertInventoryTypeDialog({
  open,
  onOpenChange,
  itemIds,
  currentInventoryType,
  currentSubInventory,
  onSuccess,
}: ConvertInventoryTypeDialogProps) {
  const [toInventoryType, setToInventoryType] = useState<InventoryType>('LocalStock');
  const [toSubInventory, setToSubInventory] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setToInventoryType(currentInventoryType === 'FG' ? 'LocalStock' : 'FG');
      setToSubInventory('');
      setNotes('');
      setError(null);
    }
  }, [open, currentInventoryType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const { success, error: convertError } = await convertInventoryType(
      itemIds,
      toInventoryType,
      toSubInventory.trim() || undefined,
      notes.trim() || undefined
    );

    setLoading(false);

    if (!success) {
      setError(convertError?.message || 'Failed to convert inventory type');
      return;
    }

    // Success
    onOpenChange(false);
    onSuccess?.();
  };

  const getCommonConversions = () => {
    switch (currentInventoryType) {
      case 'FG':
        return [
          { to: 'LocalStock', label: 'FG → Local Stock' },
          { to: 'BackHaul', label: 'FG → Back Haul' },
        ];
      case 'ASIS':
        return [
          { to: 'LocalStock', label: 'ASIS → Local Stock' },
          { to: 'BackHaul', label: 'ASIS → Back Haul' },
        ];
      case 'LocalStock':
        return [
          { to: 'BackHaul', label: 'Local Stock → Back Haul' },
          { to: 'FG', label: 'Local Stock → FG' },
        ];
      default:
        return [];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert {itemIds.length} Items</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current state */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Current Type</Label>
              <div className="font-medium">{currentInventoryType}</div>
            </div>
            {currentSubInventory && (
              <div>
                <Label className="text-xs text-muted-foreground">Current Sub-Inventory</Label>
                <div className="font-medium">{currentSubInventory}</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Target type */}
          <div className="space-y-2">
            <Label htmlFor="to-type">Convert To *</Label>
            <Select value={toInventoryType} onValueChange={(v) => setToInventoryType(v as InventoryType)}>
              <SelectTrigger id="to-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASIS">ASIS</SelectItem>
                <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                <SelectItem value="LocalStock">Local Stock</SelectItem>
                <SelectItem value="BackHaul">Back Haul</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
                <SelectItem value="Staged">Staged</SelectItem>
                <SelectItem value="Parts">Parts</SelectItem>
              </SelectContent>
            </Select>

            {getCommonConversions().length > 0 && (
              <div className="text-xs text-muted-foreground">
                Common:{' '}
                {getCommonConversions().map((conv, idx) => (
                  <span key={conv.to}>
                    {idx > 0 && ', '}
                    <button
                      type="button"
                      className="underline hover:text-foreground"
                      onClick={() => setToInventoryType(conv.to as InventoryType)}
                    >
                      {conv.label}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Target sub-inventory */}
          <div className="space-y-2">
            <Label htmlFor="to-sub">New Sub-Inventory (Optional)</Label>
            <Input
              id="to-sub"
              value={toSubInventory}
              onChange={(e) => setToSubInventory(e.target.value)}
              placeholder="Leave blank to clear sub-inventory"
            />
            <p className="text-xs text-muted-foreground">
              For ASIS: load name. For Local Stock: route name. Leave blank to clear.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for conversion..."
              rows={3}
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          {/* Preview */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="font-medium mb-1">Preview:</div>
            <div className="space-y-1 text-muted-foreground">
              <div>
                • {itemIds.length} items will change from {currentInventoryType} to {toInventoryType}
              </div>
              {toSubInventory && <div>• Sub-inventory will be set to: {toSubInventory}</div>}
              {!toSubInventory && currentSubInventory && (
                <div>• Sub-inventory will be cleared</div>
              )}
              <div>• Conversion will be logged to history</div>
            </div>
          </div>

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
              Convert Items
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
