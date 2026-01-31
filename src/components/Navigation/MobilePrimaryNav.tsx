import { ScanBarcode, LayoutDashboard, TruckIcon, Map, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { feedbackSuccess } from '@/lib/feedback';
import type { AppView } from '@/App';

interface MobilePrimaryNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenMore: () => void;
}

const primaryItems = [
  {
    icon: ScanBarcode,
    label: 'Scanner',
    view: 'create-session' as AppView,
    description: 'Start scanning session',
  },
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    view: 'dashboard' as AppView,
    description: 'View overview',
  },
  {
    icon: TruckIcon,
    label: 'ASIS Loads',
    view: 'loads' as AppView,
    description: 'Manage loads',
  },
  {
    icon: Map,
    label: 'Warehouse Map',
    view: 'map' as AppView,
    description: 'View floor layout',
  },
];

export function MobilePrimaryNav({
  currentView,
  onNavigate,
  onOpenMore,
}: MobilePrimaryNavProps) {
  const handleNavigate = (view: AppView) => {
    feedbackSuccess();
    onNavigate(view);
  };

  const handleMoreClick = () => {
    feedbackSuccess();
    onOpenMore();
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <SheetHeader>
        <SheetTitle>Main Navigation</SheetTitle>
      </SheetHeader>

      {/* Primary action buttons - 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;

          return (
            <Button
              key={item.view}
              variant={isActive ? 'default' : 'outline'}
              className="h-24 flex-col gap-2 text-base"
              onClick={() => handleNavigate(item.view)}
            >
              <Icon className="h-6 w-6" />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </div>

      {/* More button */}
      <Button
        variant="outline"
        className="h-14 justify-start gap-3 text-base"
        onClick={handleMoreClick}
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>More</span>
      </Button>
    </div>
  );
}
