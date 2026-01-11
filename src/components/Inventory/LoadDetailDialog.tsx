import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Move, Plus } from 'lucide-react';
import { getLoadWithItems } from '@/lib/loadManager';
import type { LoadMetadata, InventoryItem } from '@/types/inventory';
import { MoveItemsDialog } from './MoveItemsDialog';
import { AddItemsToLoadDialog } from './AddItemsToLoadDialog';
import { decodeHTMLEntities } from '@/lib/htmlUtils';

interface LoadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadMetadata;
  onUpdate?: () => void;
}

export function LoadDetailDialog({ open, onOpenChange, load, onUpdate }: LoadDetailDialogProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await getLoadWithItems(load.inventory_type, load.sub_inventory_name);
    if (data) {
      setItems(data.items);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchItems();
      setSelectedItems(new Set());
      setSearchTerm('');
    }
  }, [open, load]);

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.cso?.toLowerCase().includes(q) ||
      item.serial?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q) ||
      (item.products as any)?.brand?.toLowerCase().includes(q)
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

  const uniqueCSOs = new Set(items.map((i) => i.cso)).size;
  const productTypeBreakdown = items.reduce((acc, item) => {
    acc[item.product_type] = (acc[item.product_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'picked':
        return 'bg-blue-500';
      case 'shipped':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>{load.sub_inventory_name}</DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{load.inventory_type}</Badge>
                  <Badge className={getStatusColor(load.status)}>{load.status}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Move Items Here
                </Button>
                {selectedItems.size > 0 && (
                  <Button size="sm" onClick={() => setMoveDialogOpen(true)}>
                    <Move className="mr-2 h-4 w-4" />
                    Move {selectedItems.size}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Total Items</div>
              <div className="text-2xl font-bold">{items.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unique CSOs</div>
              <div className="text-2xl font-bold">{uniqueCSOs}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Product Types</div>
              <div className="text-sm mt-1">
                {Object.entries(productTypeBreakdown).map(([type, count]) => (
                  <div key={type}>
                    {type}: {count}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Search and selection */}
          <div className="flex items-center gap-2 border-b pb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No items found
              </div>
            ) : (
              filteredItems.map((item) => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id!)}
                      onChange={() => toggleItemSelection(item.id!)}
                      className="mt-1"
                    />

                    {(item.products as any)?.image_url && (
                      <img
                        src={(item.products as any).image_url}
                        alt={item.model}
                        className="w-16 h-16 object-contain rounded"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-sm font-semibold">{item.model}</div>
                          {(item.products as any)?.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {decodeHTMLEntities((item.products as any).description)}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary">{item.product_type}</Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>CSO: {item.cso}</span>
                        {item.serial && <span>Serial: {item.serial}</span>}
                        {(item.products as any)?.brand && (
                          <Badge variant="outline" className="text-xs">
                            {(item.products as any).brand}
                          </Badge>
                        )}
                        {item.status && (
                          <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MoveItemsDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        inventoryType={load.inventory_type}
        currentLoadName={load.sub_inventory_name}
        selectedItemIds={Array.from(selectedItems)}
        onSuccess={() => {
          setSelectedItems(new Set());
          fetchItems();
          onUpdate?.();
        }}
      />

      <AddItemsToLoadDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        inventoryType={load.inventory_type}
        currentLoadName={load.sub_inventory_name}
        onSuccess={() => {
          fetchItems();
          onUpdate?.();
        }}
      />
    </>
  );
}
