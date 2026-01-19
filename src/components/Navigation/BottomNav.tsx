import { Button } from "@/components/ui/button";
import { ScanBarcode, Database, LayoutDashboard, TruckIcon } from "lucide-react";
import { PageContainer } from "@/components/Layout/PageContainer";
import type { AppView } from "@/lib/routes";

interface BottomNavProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-pb">
      <PageContainer className="py-2">
        <div className="grid grid-cols-4 gap-1">
          <Button
            variant={currentView === 'dashboard' ? 'default' : 'ghost'}
            onClick={() => onViewChange('dashboard')}
            size="sm"
            className="flex-col h-auto py-2 px-1"
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-xs mt-1">Dashboard</span>
          </Button>

          <Button
            variant={currentView === 'inventory' ? 'default' : 'ghost'}
            onClick={() => onViewChange('inventory')}
            size="sm"
            className="flex-col h-auto py-2 px-1"
          >
            <ScanBarcode className="h-5 w-5" />
            <span className="text-xs mt-1">Inventory</span>
          </Button>

          <Button
            variant={currentView === 'loads' ? 'default' : 'ghost'}
            onClick={() => onViewChange('loads')}
            size="sm"
            className="flex-col h-auto py-2 px-1"
          >
            <TruckIcon className="h-5 w-5" />
            <span className="text-xs mt-1">Loads</span>
          </Button>

          <Button
            variant={currentView === 'products' ? 'default' : 'ghost'}
            onClick={() => onViewChange('products')}
            size="sm"
            className="flex-col h-auto py-2 px-1"
          >
            <Database className="h-5 w-5" />
            <span className="text-xs mt-1">Products</span>
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
