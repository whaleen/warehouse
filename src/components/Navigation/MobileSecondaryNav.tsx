import {
  ClipboardList,
  Package,
  History,
  MapPin,
  Settings2,
  Users,
  Database,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { haptic } from '@/lib/feedback';
import type { AppView } from '@/lib/routes';

interface MobileSecondaryNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onBack: () => void;
}

interface NavGroup {
  title: string;
  items: Array<{
    icon: typeof ClipboardList;
    label: string;
    view: AppView;
  }>;
}

const secondaryGroups: NavGroup[] = [
  {
    title: 'Inventory',
    items: [
      {
        icon: ClipboardList,
        label: 'All Inventory',
        view: 'inventory',
      },
      {
        icon: Package,
        label: 'Parts',
        view: 'parts',
      },
      {
        icon: History,
        label: 'Activity Log',
        view: 'activity',
      },
      {
        icon: MapPin,
        label: 'Warehouse Map',
        view: 'map',
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        icon: Settings2,
        label: 'Location Settings',
        view: 'settings-location',
      },
      {
        icon: Users,
        label: 'Team',
        view: 'settings-users',
      },
      {
        icon: Database,
        label: 'GE Sync',
        view: 'settings-gesync',
      },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        icon: Database,
        label: 'Products',
        view: 'products',
      },
    ],
  },
];

export function MobileSecondaryNav({
  currentView,
  onNavigate,
  onBack,
}: MobileSecondaryNavProps) {
  const handleNavigate = (view: AppView) => {
    haptic('light');
    onNavigate(view);
  };

  const handleBack = () => {
    haptic('light');
    onBack();
  };

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Back button - fixed at top */}
      <div className="p-4 pb-0 shrink-0">
        <Button
          variant="ghost"
          className="h-12 justify-start gap-2 text-base"
          onClick={handleBack}
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Back to Main Menu</span>
        </Button>
        <Separator className="mt-4" />
      </div>

      {/* Grouped navigation items - scrollable */}
      <div className="overflow-y-auto p-4 pb-8">
        <div className="flex flex-col gap-6">
          {secondaryGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground px-2">
                {group.title}
              </h3>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.view;

                  return (
                    <Button
                      key={item.view}
                      variant={isActive ? 'secondary' : 'ghost'}
                      className="h-12 justify-start gap-3 text-base"
                      onClick={() => handleNavigate(item.view)}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
