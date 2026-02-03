import { ScanBarcode, LayoutDashboard, TruckIcon, Map, MoreHorizontal, User, Moon, Sun, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { haptic } from '@/lib/feedback';
import { useTheme } from '@/components/theme-provider';
import type { AppView } from '@/lib/routes';

interface MobilePrimaryNavProps {
  onNavigate: (view: AppView) => void;
  onOpenMore: () => void;
}

const primaryItems = [
  {
    icon: ScanBarcode,
    label: 'Sessions',
    view: 'sessions' as AppView,
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
  onNavigate,
  onOpenMore,
}: MobilePrimaryNavProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

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

  const handleThemeToggle = () => {
    haptic('light');
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSearchClick = () => {
    haptic('light');
    onNavigate('products');
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

          return (
            <Button
              key={item.view}
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => handleNavigate(item.view)}
            >
              <Icon className="h-10 w-10" />
              <span className="text-sm">{item.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Bottom row - 4 equal buttons */}
      <div className="grid grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="h-14 flex-col gap-1 p-0"
          onClick={handleMoreClick}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-xs">More</span>
        </Button>

        <Button
          variant="outline"
          className="h-14 p-0"
          onClick={handleSearchClick}
        >
          <Search className="h-5 w-5" />
        </Button>

        <Button
          variant="outline"
          className="h-14 p-0"
          onClick={handleProfileClick}
        >
          <Avatar className="h-8 w-8">
            {user?.image && <AvatarImage src={user.image} alt={user.email || 'User'} />}
            <AvatarFallback className="text-xs">
              {user?.email ? getInitials(user.email) : <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>

        <Button
          variant="outline"
          className="h-14 p-0"
          onClick={handleThemeToggle}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
