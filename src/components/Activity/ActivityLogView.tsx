import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useActivityLog } from '@/hooks/queries/useActivity';
import { useActivityRealtime } from '@/hooks/queries/useRealtimeSync';

type ActivityLogEntry = {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: ActivityDetails | null;
  actor_name?: string | null;
  actor_image?: string | null;
  created_at: string;
};

type ActivityDetails = {
  stats?: {
    totalGEItems?: number;
    totalItems?: number;
  };
  loadNumber?: string;
  friendlyName?: string;
  fields?: string[];
};

export function ActivityLogView() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useActivityLog();

  useActivityRealtime();

  const logs = data?.pages.flatMap((page) => page.data) ?? [];

  const formatActivityDate = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const formatActivityMessage = (entry: ActivityLogEntry) => {
    if (entry.action === 'asis_sync') {
      const total = entry.details?.stats?.totalGEItems ?? entry.details?.stats?.totalItems;
      return total ? `Synced ASIS (${total} items)` : 'Synced ASIS from GE';
    }
    if (entry.action === 'asis_wipe') {
      return 'Wiped ASIS data';
    }
    if (entry.action === 'sanity_check_requested' || entry.action === 'sanity_check_completed') {
      const loadNumber = entry.details?.loadNumber ?? entry.entity_id ?? '';
      const friendly = entry.details?.friendlyName ?? '';
      const label = friendly ? `${friendly} (${loadNumber})` : loadNumber;
      return entry.action === 'sanity_check_requested'
        ? `Requested sanity check for load ${label}`
        : `Completed sanity check for load ${label}`;
    }
    if (entry.action === 'load_update') {
      const loadNumber = entry.details?.loadNumber ?? entry.entity_id ?? '';
      const friendly = entry.details?.friendlyName ?? '';
      const fields = Array.isArray(entry.details?.fields) ? entry.details?.fields : [];
      const fieldLabels: Record<string, string> = {
        friendly_name: 'friendly name',
        notes: 'notes',
        primary_color: 'color',
        category: 'salvage',
        prep_tagged: 'tagged',
        prep_wrapped: 'wrapped',
        sanity_check_requested: 'sanity check requested',
        pickup_date: 'pickup date',
        pickup_tba: 'pickup TBA',
      };
      const fieldsLabel = fields.length
        ? ` (${fields.map((field: string) => fieldLabels[field] ?? field).join(', ')})`
        : '';
      const label = friendly ? `${friendly} (${loadNumber})` : loadNumber;
      return `Updated load ${label}${fieldsLabel}`;
    }
    return entry.action.replace(/_/g, ' ');
  };


  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Activity Log" />
      <PageContainer className="py-4 pb-24 space-y-4">
        <Card className="p-4">
          <div className="space-y-3">
            {isLoading && logs.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading activity…
              </div>
            ) : logs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-semibold">
                    {entry.actor_image ? (
                      <img
                        src={entry.actor_image}
                        alt={entry.actor_name ?? 'User'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{(entry.actor_name ?? 'U').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{entry.actor_name ?? 'Unknown'}</div>
                    <div className="text-sm text-foreground">{formatActivityMessage(entry)}</div>
                    <div className="text-xs text-muted-foreground">{formatActivityDate(entry.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          {hasNextPage && (
            <div className="pt-3">
              <Button
                variant="outline"
                size="responsive"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    Load more
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
