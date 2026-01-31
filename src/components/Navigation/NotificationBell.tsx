import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useReorderAlerts } from '@/hooks/queries/useParts';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { data: alerts = [], refetch } = useReorderAlerts();
  const [open, setOpen] = useState(false);
  const { locationId } = getActiveLocationContext();

  // Subscribe to real-time updates
  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel('parts-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracked_parts',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          // Refetch alerts when tracked parts change
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, refetch]);

  const activeAlerts = alerts.filter(alert => !alert.reordered_at);
  const alertCount = activeAlerts.length;
  const displayAlerts = activeAlerts.slice(0, 10);

  const handleViewAll = () => {
    setOpen(false);
    window.location.href = '/parts?status=reorder';
  };

  const handleAlertClick = (alertId: string) => {
    setOpen(false);
    window.location.href = `/parts?status=reorder#${alertId}`;
  };

  return (
    <div className={cn(className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {alertCount > 9 ? '9+' : alertCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          <div className="flex items-center justify-between">
            <span>Reorder Alerts</span>
            {alertCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {alertCount}
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {displayAlerts.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No parts need reordering
          </div>
        ) : (
          <>
            {displayAlerts.map((alert) => (
              <DropdownMenuItem
                key={alert.tracked_part_id}
                onClick={() => handleAlertClick(alert.tracked_part_id)}
                className="cursor-pointer flex-col items-start py-3"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-mono font-medium text-sm">
                    {alert.model ?? 'Unknown'}
                  </span>
                  {alert.current_qty === 0 && (
                    <Badge variant="destructive" className="text-xs">
                      OUT
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Qty: {alert.current_qty} (reorder at {alert.reorder_threshold})
                </div>
                {alert.description && (
                  <div className="text-xs text-muted-foreground truncate w-full mt-0.5">
                    {alert.description}
                  </div>
                )}
              </DropdownMenuItem>
            ))}
            {alertCount > 10 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 text-xs text-center text-muted-foreground">
                  +{alertCount - 10} more alerts
                </div>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleViewAll}
              className="cursor-pointer justify-center font-medium"
            >
              View All Alerts
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
