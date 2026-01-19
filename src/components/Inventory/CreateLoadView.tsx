import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft } from 'lucide-react';
import { createLoad } from '@/lib/loadManager';
import type { InventoryType } from '@/types/inventory';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import type { AppView } from '@/lib/routes';

interface CreateLoadViewProps {
  onViewChange: (view: AppView) => void;
  onMenuClick?: () => void;
}

export function CreateLoadView({ onViewChange, onMenuClick }: CreateLoadViewProps) {
  const [inventoryType, setInventoryType] = useState<InventoryType>('ASIS');
  const [loadName, setLoadName] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [category, setCategory] = useState('');
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
      notes.trim() || undefined,
      undefined, // createdBy
      category && category !== 'none' ? category.trim() : undefined,
      friendlyName.trim() || undefined
    );

    setLoading(false);

    if (createError) {
      setError(createError.message || 'Failed to create load');
      return;
    }

    // Success - navigate back to loads view
    onViewChange('loads');
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Create New Load"
        onMenuClick={onMenuClick}
        actions={
          <Button variant="ghost" size="icon" onClick={() => onViewChange('loads')}>
            <ArrowLeft />
          </Button>
        }
      />
      <PageContainer className="py-4 pb-24">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="inventory-type">Inventory Type</Label>
            <Select
              value={inventoryType}
              onValueChange={(v) => setInventoryType(v as InventoryType)}
            >
              <SelectTrigger id="inventory-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASIS">ASIS</SelectItem>
                <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                <SelectItem value="BackHaul">Back Haul (FG)</SelectItem>
                <SelectItem value="LocalStock">Local Stock</SelectItem>
                <SelectItem value="Staged">Staged (Local Stock)</SelectItem>
                <SelectItem value="Inbound">Inbound (Local Stock)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(inventoryType === 'ASIS' || inventoryType === 'FG') && (
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {inventoryType === 'ASIS' && (
                    <>
                      <SelectItem value="Regular">Regular</SelectItem>
                      <SelectItem value="Salvage">Salvage</SelectItem>
                    </>
                  )}
                  {inventoryType === 'FG' && (
                    <SelectItem value="Back Haul">Back Haul</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inventoryType === 'ASIS'
                  ? 'Categorize as Regular or Salvage ASIS load'
                  : 'Categorize as Back Haul load'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="load-name">Load Number *</Label>
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
            <Label htmlFor="friendly-name">Friendly Name (Optional)</Label>
            <Input
              id="friendly-name"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="e.g., Costco Run - East"
            />
            <p className="text-xs text-muted-foreground">
              Friendly names are display-only and do not change the load number.
            </p>
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
              onClick={() => onViewChange('loads')}
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
        </div>
      </PageContainer>
    </div>
  );
}
