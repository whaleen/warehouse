import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search } from 'lucide-react';
import type { InventoryType } from '@/types/inventory';
import type { SessionSummary } from '@/types/session';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { MobileOverlay } from '@/components/Layout/MobileOverlay';
import { ScanningSessionView } from '@/components/Session/ScanningSessionView';
import { useAuth } from '@/context/AuthContext';
import {
  useSessionCreatorAvatars,
  useSessionLoadMetadata,
  useSessionSummaries,
  useUpdateSessionStatus,
} from '@/hooks/queries/useSessions';
import { useIsMobile } from '@/hooks/use-mobile';

interface SessionsViewProps {
  onMenuClick?: () => void;
  sessionId?: string | null;
  onSessionChange?: (sessionId: string | null) => void;
}

const inventoryTypeLabels: Record<InventoryType, string> = {
  ASIS: 'ASIS',
  BackHaul: 'BackHaul',
  Staged: 'Staged',
  Inbound: 'Inbound',
  STA: 'STA',
  FG: 'FG',
  LocalStock: 'LocalStock',
  Parts: 'Parts',
  WillCall: 'WillCall'
};

function formatSessionTimestamp(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function SessionsView({ onMenuClick, sessionId, onSessionChange }: SessionsViewProps) {
  const { user } = useAuth();
  const userDisplayName = user?.username ?? user?.email ?? null;
  const isMobile = useIsMobile();
  const [sessionListTab, setSessionListTab] = useState<'active' | 'closed' | 'all'>('active');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | InventoryType>('all');
  const [sessionsActionError, setSessionsActionError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);
  const sessionsQuery = useSessionSummaries();
  const updateStatusMutation = useUpdateSessionStatus();
  const sessions = sessionsQuery.data ?? [];
  const sessionsLoading = sessionsQuery.isLoading;
  const sessionsError = sessionsQuery.error instanceof Error ? sessionsQuery.error.message : null;
  const sessionsDisplayError = sessionsActionError ?? sessionsError;
  const sessionSubInventories = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.subInventory).filter(Boolean) as string[])),
    [sessions]
  );
  const sessionLoadMetadataQuery = useSessionLoadMetadata(sessionSubInventories);
  const sessionLoadMetadata = sessionLoadMetadataQuery.data ?? new Map();
  const createdByNames = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.createdBy).filter(Boolean) as string[])),
    [sessions]
  );
  const creatorAvatarsQuery = useSessionCreatorAvatars(createdByNames);
  const creatorAvatars = creatorAvatarsQuery.data ?? {};

  useEffect(() => {
    setActiveSessionId(sessionId ?? null);
  }, [sessionId]);

  const handleExitSession = () => {
    setActiveSessionId(null);
    onSessionChange?.(null);
    sessionsQuery.refetch();
  };

  const handleOpenSession = async (session: SessionSummary) => {
    if (session.status === 'draft') {
      setSessionsActionError(null);
      try {
        await updateStatusMutation.mutateAsync({
          sessionId: session.id,
          status: 'active',
          updatedBy: userDisplayName ?? undefined
        });
      } catch (err) {
        setSessionsActionError(err instanceof Error ? err.message : 'Failed to start session');
        return;
      }
    }
    setActiveSessionId(session.id);
    onSessionChange?.(session.id);
  };

  const renderSessionCard = (session: SessionSummary) => {
    const isClosed = session.status === 'closed';
    const progress = session.totalItems > 0 ? Math.round((session.scannedCount / session.totalItems) * 100) : 0;
    const timestamp = isClosed
      ? formatSessionTimestamp(session.closedAt || session.updatedAt || session.createdAt)
      : formatSessionTimestamp(session.createdAt);

    return (
      <Card key={session.id} className="p-4 space-y-4 border-border/60 bg-background/90">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{inventoryTypeLabels[session.inventoryType]}</Badge>
              {session.subInventory && (() => {
                const metadata = sessionLoadMetadata.get(session.subInventory);
                const friendlyName = metadata?.friendly_name;
                const color = metadata?.primary_color;
                const cso = metadata?.ge_cso;
                const csoDisplay = cso
                  ? isMobile
                    ? `...${cso.slice(-4)}`
                    : cso
                  : null;

                return (
                  <Badge variant="secondary" className="flex items-center gap-1.5">
                    {color && (
                      <div
                        className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <span>
                      {friendlyName || session.subInventory}
                      {csoDisplay && ` - ${csoDisplay}`}
                    </span>
                  </Badge>
                );
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden text-[10px] font-semibold text-foreground">
                {session.createdBy && creatorAvatars[session.createdBy] ? (
                  <img
                    src={creatorAvatars[session.createdBy] as string}
                    alt={session.createdBy}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span>{getInitials(session.createdBy ?? 'Unknown')}</span>
                )}
              </div>
              <span>{session.createdBy ?? 'Unknown'}</span>
              <span>•</span>
              <span>{timestamp}</span>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="text-lg font-semibold text-foreground">
              {session.scannedCount}/{session.totalItems}
            </div>
            <div>scanned</div>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{progress}% complete</span>
            <div className="flex items-center gap-2">
              <Button size="responsive" onClick={() => handleOpenSession(session)}>
                {isClosed ? 'View' : session.status === 'draft' ? 'Start' : 'Resume'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const activeSessions = sessions.filter(session => session.status !== 'closed');
  const closedSessions = sessions.filter(session => session.status === 'closed');

  const availableSessionTypes = useMemo(() => {
    const base =
      sessionListTab === 'active'
        ? activeSessions
        : sessionListTab === 'closed'
          ? closedSessions
          : sessions;
    const types = Array.from(new Set(base.map(session => session.inventoryType)));
    return types.sort((a, b) => inventoryTypeLabels[a].localeCompare(inventoryTypeLabels[b]));
  }, [activeSessions, closedSessions, sessions, sessionListTab]);

  const filteredActiveSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return activeSessions.filter(session => {
      const matchesType = sessionTypeFilter === 'all' || session.inventoryType === sessionTypeFilter;
      const matchesSearch =
        !query ||
        session.name.toLowerCase().includes(query) ||
        session.subInventory?.toLowerCase().includes(query) ||
        session.createdBy?.toLowerCase().includes(query) ||
        inventoryTypeLabels[session.inventoryType].toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [activeSessions, sessionSearch, sessionTypeFilter]);

  const filteredClosedSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return closedSessions.filter(session => {
      const matchesType = sessionTypeFilter === 'all' || session.inventoryType === sessionTypeFilter;
      const matchesSearch =
        !query ||
        session.name.toLowerCase().includes(query) ||
        session.subInventory?.toLowerCase().includes(query) ||
        session.createdBy?.toLowerCase().includes(query) ||
        inventoryTypeLabels[session.inventoryType].toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [closedSessions, sessionSearch, sessionTypeFilter]);

  const visibleActiveSessions =
    sessionListTab === 'active' || sessionListTab === 'all'
      ? filteredActiveSessions
      : [];
  const visibleClosedSessions =
    sessionListTab === 'closed' || sessionListTab === 'all'
      ? filteredClosedSessions
      : [];

  if (activeSessionId) {
    if (isMobile) {
      return (
        <MobileOverlay title="" onClose={handleExitSession} showHeader={false}>
          <ScanningSessionView
            sessionId={activeSessionId}
            onExit={handleExitSession}
          />
        </MobileOverlay>
      );
    }

    return (
      <ScanningSessionView
        sessionId={activeSessionId}
        onExit={handleExitSession}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader
          title="Scanning Sessions"
          onMenuClick={onMenuClick}
        />
      )}

      <PageContainer className="py-4 pb-24">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sessions"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              <div className="flex gap-2">
                <Select
                  value={sessionTypeFilter}
                  onValueChange={(value) => setSessionTypeFilter(value as 'all' | InventoryType)}
                >
                  <SelectTrigger className="h-10 flex-1 lg:w-[140px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableSessionTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {inventoryTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sessionListTab}
                  onValueChange={(value) => setSessionListTab(value as 'active' | 'closed' | 'all')}
                >
                  <SelectTrigger className="h-10 flex-1 lg:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Open ({activeSessions.length})</SelectItem>
                    <SelectItem value="closed">Closed ({closedSessions.length})</SelectItem>
                    <SelectItem value="all">All ({sessions.length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sessionsLoading && (
              <Card className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sessions…
              </Card>
            )}

            {sessionsDisplayError && !sessionsLoading && (
              <Alert variant="destructive">
                <AlertDescription>{sessionsDisplayError}</AlertDescription>
              </Alert>
            )}

            {!sessionsLoading &&
              !sessionsError &&
              visibleActiveSessions.length === 0 &&
              visibleClosedSessions.length === 0 && (
                <Card className="p-4 text-sm text-muted-foreground">
                  No sessions match the current filters.
                </Card>
              )}

            {visibleActiveSessions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">Open Sessions</span>
                  <span>{visibleActiveSessions.length} shown</span>
                </div>
                {visibleActiveSessions.map(renderSessionCard)}
              </div>
            )}

            {visibleClosedSessions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">Closed Sessions</span>
                  <span>{visibleClosedSessions.length} shown</span>
                </div>
                {visibleClosedSessions.map(renderSessionCard)}
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
