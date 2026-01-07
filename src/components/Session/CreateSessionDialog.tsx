import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import type { InventoryType, InventoryItem } from '@/types/inventory';
import type { ScanningSession } from '@/types/session';
import supabase from '@/lib/supabase';
import { generateSessionId } from '@/lib/sessionManager';

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCreated: (session: ScanningSession) => void;
}

export function CreateSessionDialog({ open, onOpenChange, onSessionCreated }: CreateSessionDialogProps) {
  const [sessionName, setSessionName] = useState('');
  const [inventoryType, setInventoryType] = useState<InventoryType>('FG');
  const [subInventory, setSubInventory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [subInventories, setSubInventories] = useState<string[]>([]);

  // Fetch available sub-inventories when inventory type changes
  useEffect(() => {
    if (!open) return;

    const fetchSubInventories = async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('sub_inventory')
        .eq('inventory_type', inventoryType)
        .not('sub_inventory', 'is', null);

      if (data) {
        const unique = [...new Set(data.map(d => d.sub_inventory))].filter(Boolean) as string[];
        setSubInventories(unique);
      }
    };

    fetchSubInventories();
  }, [inventoryType, open]);

  // Preview count
  useEffect(() => {
    if (!open) return;

    const fetchPreview = async () => {
      let query = supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('inventory_type', inventoryType);

      if (subInventory !== 'all') {
        query = query.eq('sub_inventory', subInventory);
      }

      const { count } = await query;
      setPreviewCount(count || 0);
    };

    fetchPreview();
  }, [inventoryType, subInventory, open]);

  const handleCreate = async () => {
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch items for this session
      let query = supabase
        .from('inventory_items')
        .select('*')
        .eq('inventory_type', inventoryType);

      if (subInventory !== 'all') {
        query = query.eq('sub_inventory', subInventory);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(`Failed to fetch items: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError('No items found for this inventory type');
        setLoading(false);
        return;
      }

      // Create session
      const session: ScanningSession = {
        id: generateSessionId(),
        name: sessionName,
        inventoryType,
        subInventory: subInventory !== 'all' ? subInventory : undefined,
        createdAt: new Date().toISOString(),
        items: data as InventoryItem[],
        scannedItemIds: []
      };

      onSessionCreated(session);

      // Reset form
      setSessionName('');
      setInventoryType('FG');
      setSubInventory('all');
      onOpenChange(false);
    } catch (err) {
      setError(`Failed to create session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Scanning Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session Name */}
          <div className="space-y-2">
            <Label htmlFor="session-name">Session Name</Label>
            <Input
              id="session-name"
              type="text"
              placeholder="e.g., Sanity Check - FG"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Inventory Type */}
          <div className="space-y-2">
            <Label htmlFor="inventory-type">Inventory Type</Label>
            <Select value={inventoryType} onValueChange={(value) => setInventoryType(value as InventoryType)}>
              <SelectTrigger id="inventory-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASIS">ASIS (As-Is Returns)</SelectItem>
                <SelectItem value="BackHaul">Back Haul</SelectItem>
                <SelectItem value="Salvage">Salvage</SelectItem>
                <SelectItem value="Staged">Staged (Routes)</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
                <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                <SelectItem value="LocalStock">Local Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Inventory Filter (if available) */}
          {subInventories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="sub-inventory">Filter by Route/Location (Optional)</Label>
              <Select value={subInventory} onValueChange={setSubInventory}>
                <SelectTrigger id="sub-inventory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  {subInventories.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview Count */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">{previewCount} items</span> will be included in this session
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || previewCount === 0}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              `Start Session`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
