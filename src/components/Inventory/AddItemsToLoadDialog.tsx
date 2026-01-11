import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { InventoryType, InventoryItem } from '@/types/inventory';
import { decodeHTMLEntities } from '@/lib/htmlUtils';

interface AddItemsToLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryType: InventoryType;
  currentLoadName: string;
  onSuccess?: () => void;
}

type InventoryItemWithProduct = InventoryItem & {
  products: {
    id: string;
    model: string;
    product_type: string;
    brand?: string;
    description?: string;
    image_url?: string;
  } | null;
};

export function AddItemsToLoadDialog({
  open,
  onOpenChange,
  inventoryType,
  currentLoadName,
  onSuccess,
}: AddItemsToLoadDialogProps) {
  const [items, setItems] = useState<InventoryItemWithProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchAvailableItems = async () => {
    setLoading(true);
    try {
      // Fetch items of the same inventory type that are NOT already in this load
      const { data, error } = await supabase
        .from('inventory_items')
        .select(
          `
          *,
          products:product_fk (
            id,
            model,
            product_type,
            brand,
            description,
            image_url
          )
        `,
        )
        .eq('inventory_type', inventoryType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out items already in this load
      const available = (data ?? []).filter(
        (item) => item.sub_inventory !== currentLoadName,
      );

      setItems(available);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAvailableItems();
      setSelectedItems(new Set());
      setSearchTerm('');
      setError(null);
    }
  }, [open, inventoryType, currentLoadName]);

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.cso?.toLowerCase().includes(q) ||
      item.serial?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q) ||
      item.products?.brand?.toLowerCase().includes(q) ||
      item.products?.description?.toLowerCase().includes(q)
    );
  });

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const toggleAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.id!)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.size === 0) {
      setError('Please select at least one item');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Update selected items' sub_inventory to add them to this load
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          sub_inventory: currentLoadName,
          updated_at: new Date().toISOString(),
        })
        .in('id', Array.from(selectedItems));

      if (updateError) throw updateError;

      // Success
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add items to load');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Move Items to {currentLoadName}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Items will be moved from their current load to this load. Each item can only belong to one load at a time.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Search and selection */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search CSO, Serial, Model, Brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
              {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground mb-2">
            Showing {inventoryType} items not already in this load. {selectedItems.size} selected.
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto space-y-2 border rounded-lg p-3">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p>No available items found</p>
                <p className="text-xs mt-1">
                  {items.length === 0
                    ? `All ${inventoryType} items are already in this load`
                    : 'Try a different search term'}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className={`p-3 cursor-pointer transition ${
                    selectedItems.has(item.id!) ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => toggleItemSelection(item.id!)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id!)}
                      onChange={() => toggleItemSelection(item.id!)}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    />

                    {item.products?.image_url && (
                      <img
                        src={item.products.image_url}
                        alt={item.model}
                        className="w-16 h-16 object-contain rounded"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-sm font-semibold">{item.model}</div>
                          {item.products?.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {decodeHTMLEntities(item.products.description)}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary">{item.product_type}</Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-muted-foreground">CSO: {item.cso}</span>
                        {item.serial && (
                          <span className="text-muted-foreground">Serial: {item.serial}</span>
                        )}
                        {item.products?.brand && (
                          <Badge variant="outline" className="text-xs">
                            {item.products.brand}
                          </Badge>
                        )}
                        {item.sub_inventory && (
                          <Badge variant="outline" className="text-xs">
                            Current load: {item.sub_inventory}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {error && <div className="text-sm text-destructive mt-2">{error}</div>}

          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || selectedItems.size === 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Move {selectedItems.size} Items to Load
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
