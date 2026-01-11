import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { InventoryItem } from '@/types/inventory';

interface ItemSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  matchedField: 'serial' | 'cso' | 'model';
  matchedValue: string;
  onConfirm: (selectedIds: string[]) => void;
}

export function ItemSelectionDialog({
  open,
  onOpenChange,
  items,
  matchedField,
  matchedValue,
  onConfirm
}: ItemSelectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map(item => item.id!)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  const fieldLabel = {
    serial: 'Serial Number',
    cso: 'CSO',
    model: 'Model Number'
  }[matchedField];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Multiple Items Found</DialogTitle>
          <div className="text-sm text-gray-600 mt-2">
            Found {items.length} items matching <span className="font-semibold">{fieldLabel}</span>:{' '}
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{matchedValue}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Select All / Clear All */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>
              Select All
            </Button>
            <Button size="sm" variant="outline" onClick={clearAll}>
              Clear All
            </Button>
            <div className="ml-auto text-sm text-gray-600">
              {selectedIds.size} of {items.length} selected
            </div>
          </div>

          {/* Item List */}
          <div className="space-y-2">
            {items.map((item) => (
              <Card
                key={item.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedIds.has(item.id!)
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleSelection(item.id!)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(item.id!)}
                    onCheckedChange={() => toggleSelection(item.id!)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900">
                        {item.product_type}
                      </div>
                      <Badge variant="secondary">{item.inventory_type}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">CSO:</span>{' '}
                        <span className="font-mono">{item.cso}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Serial:</span>{' '}
                        <span className="font-mono">{item.serial || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Model:</span>{' '}
                        <span className="font-mono text-xs">{item.model}</span>
                      </div>
                      {item.sub_inventory && (
                        <div>
                          <span className="text-gray-500">Route:</span>{' '}
                          <span className="font-mono">{item.sub_inventory}</span>
                        </div>
                      )}
                    </div>
                    {item.consumer_customer_name && (
                      <div className="text-xs text-gray-600">
                        {item.consumer_customer_name}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
            Mark {selectedIds.size} as Scanned
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
