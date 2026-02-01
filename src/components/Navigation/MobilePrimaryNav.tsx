import { ScanBarcode, LayoutDashboard, TruckIcon, Map, MoreHorizontal, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { haptic } from '@/lib/feedback';
import type { AppView } from '@/lib/routes';

interface MobilePrimaryNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenMore: () => void;
}

const primaryItems = [
  {
    icon: ScanBarcode,
    label: 'Sessions',
    view: 'create-session' as AppView,
    description: 'Scanning sessions',
    action: 'route' as const,
  },
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    view: 'dashboard' as AppView,
    description: 'View overview',
    action: 'route' as const,
  },
  {
    icon: TruckIcon,
    label: 'ASIS Loads',
    view: 'loads' as AppView,
    description: 'Manage loads',
    action: 'route' as const,
  },
  {
    icon: Map,
    label: 'Warehouse Map',
    view: 'map' as AppView,
    description: 'View floor layout',
    action: 'route' as const,
  },
];

export function MobilePrimaryNav({
  currentView,
  onNavigate,
  onOpenMore,
}: MobilePrimaryNavProps) {
  const { user } = useAuth();

  const handleNavigate = (view: AppView) => {
    haptic('light');
    onNavigate(view);
  };

  const handleMoreClick = () => {
    haptic('light');
    onOpenMore();
  };

  const handleProfileClick = () => {
    haptic('light');
    onNavigate('settings-profile');
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
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

      {/* More button and User profile - 2 column grid */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-14 justify-start gap-3 text-base"
          onClick={handleMoreClick}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </Button>

        <Button
          variant={currentView === 'settings-profile' ? 'default' : 'outline'}
          className="h-14 justify-start gap-3 text-base"
          onClick={handleProfileClick}
        >
          <Avatar className="h-6 w-6">
            {user?.image && <AvatarImage src={user.image} alt={user.email || 'User'} />}
            <AvatarFallback className="text-xs">
              {user?.email ? getInitials(user.email) : <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">Profile</span>
        </Button>
      </div>
    </div>
  );
}
