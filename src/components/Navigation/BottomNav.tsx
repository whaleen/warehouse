import { Button } from "@/components/ui/button";
import { Truck, Package, ScanBarcode, Database } from "lucide-react";

interface BottomNavProps {
  currentView: 'deliveries' | 'trucks' | 'inventory' | 'products';
  onViewChange: (view: 'deliveries' | 'trucks' | 'inventory' | 'products') => void;
}

export function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb">
      <div className="grid grid-cols-4 gap-2">
        <Button
          variant={currentView === 'deliveries' ? 'default' : 'outline'}
          onClick={() => onViewChange('deliveries')}
          size="sm"
        >
          <Package className="h-4 w-4 mr-1" />
          Deliveries
        </Button>

        <Button
          variant={currentView === 'trucks' ? 'default' : 'outline'}
          onClick={() => onViewChange('trucks')}
          size="sm"
        >
          <Truck className="h-4 w-4 mr-1" />
          Trucks
        </Button>

        <Button
          variant={currentView === 'inventory' ? 'default' : 'outline'}
          onClick={() => onViewChange('inventory')}
          size="sm"
        >
          <ScanBarcode className="h-4 w-4 mr-1" />
          Inventory
        </Button>

        <Button
          variant={currentView === 'products' ? 'default' : 'outline'}
          onClick={() => onViewChange('products')}
          size="sm"
        >
          <Database className="h-4 w-4 mr-1" />
          Products
        </Button>
      </div>
    </div>
  );
}