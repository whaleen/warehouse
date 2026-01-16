import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ArrowRightLeft, Plus } from 'lucide-react';
import { getLoadWithItems, getLoadConflicts } from '@/lib/loadManager';
import type { LoadMetadata, InventoryItem, LoadConflict } from '@/types/inventory';
import { AddItemsToLoadDialog } from './AddItemsToLoadDialog';
import { decodeHTMLEntities } from '@/lib/htmlUtils';
import { ChangeItemAssignmentDialog } from './ChangeItemAssignmentDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';

interface LoadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadMetadata;
  onUpdate?: () => void;
}

export function LoadDetailDialog({ open, onOpenChange, load, onUpdate }: LoadDetailDialogProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [conflicts, setConflicts] = useState<LoadConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const [{ data }, { data: conflictData }] = await Promise.all([
      getLoadWithItems(load.inventory_type, load.sub_inventory_name),
      getLoadConflicts(load.inventory_type, load.sub_inventory_name),
    ]);
    if (data) setItems(data.items);
    setConflicts(conflictData);
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
                  Assign Items
                </Button>
                {selectedItems.size > 0 && (
                  <Button size="sm" onClick={() => setChangeDialogOpen(true)}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Change Type/Load ({selectedItems.size})
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 p-4 bg-muted rounded-lg sm:grid-cols-3">
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
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="font-semibold text-destructive">
                {conflicts.length} serial conflict{conflicts.length === 1 ? '' : 's'}
              </div>
              <p className="text-muted-foreground">
                These serials also appear in another load.
              </p>
              <div className="mt-2 space-y-1">
                {conflicts.slice(0, 6).map(conflict => (
                  <div key={conflict.id ?? `${conflict.serial}-${conflict.load_number}`}>
                    <span className="font-medium">{conflict.serial}</span> already in{' '}
                    <span className="font-medium">{conflict.conflicting_load}</span>
                  </div>
                ))}
                {conflicts.length > 6 && (
                  <div className="text-xs text-muted-foreground">
                    +{conflicts.length - 6} more
                  </div>
                )}
              </div>
            </div>
          )}

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
              filteredItems.map((item) => {
                const normalizedItem =
                  item.products?.description
                    ? {
                        ...item,
                        products: {
                          ...item.products,
                          description: decodeHTMLEntities(item.products.description)
                        }
                      }
                    : item;

                return (
                  <InventoryItemCard
                    key={item.id}
                    item={normalizedItem}
                    leading={(
                      <Checkbox
                        checked={selectedItems.has(item.id!)}
                        onCheckedChange={() => toggleItemSelection(item.id!)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    )}
                    onClick={() => toggleItemSelection(item.id!)}
                    selected={selectedItems.has(item.id!)}
                    showInventoryTypeBadge={false}
                    showRouteBadge={false}
                    showProductMeta
                    showImage={Boolean((normalizedItem.products as any)?.image_url)}
                    badges={item.status ? <Badge className={getStatusColor(item.status)}>{item.status}</Badge> : null}
                  />
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      <ChangeItemAssignmentDialog
        open={changeDialogOpen}
        onOpenChange={setChangeDialogOpen}
        itemIds={Array.from(selectedItems)}
        currentInventoryType={load.inventory_type}
        currentSubInventory={load.sub_inventory_name}
        onSuccess={() => {
          setSelectedItems(new Set());
          fetchItems();
          onUpdate?.();
        }}
      />
    </>
  );
}
