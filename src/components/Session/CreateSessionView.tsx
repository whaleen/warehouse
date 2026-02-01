import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search } from 'lucide-react';
import type { InventoryType } from '@/types/inventory';
import type { ScanningSession, SessionSummary } from '@/types/session';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { MobileOverlay } from '@/components/Layout/MobileOverlay';
import { ScanningSessionView } from '@/components/Session/ScanningSessionView';
import { useAuth } from '@/context/AuthContext';
import {
  useCreateSessionFromInventory,
  useDeleteSession,
  useInventoryPreviewCount,
  useSessionCreatorAvatars,
  useSessionLoadMetadata,
  useSessionSummaries,
  useSubInventoryNames,
  useUpdateSessionStatus,
} from '@/hooks/queries/useSessions';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AppView } from '@/lib/routes';

interface CreateSessionViewProps {
  onViewChange: (view: AppView) => void;
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

function generateSessionName(inventoryType: InventoryType, subInventory?: string): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (inventoryType === 'Staged' && subInventory && subInventory !== 'all') {
    return `Route ${subInventory} - ${date} ${time}`;
  }
  return `${inventoryTypeLabels[inventoryType]} - ${date} ${time}`;
}

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

export function CreateSessionView({ onViewChange, onMenuClick, sessionId, onSessionChange }: CreateSessionViewProps) {
  const { user } = useAuth();
  const userDisplayName = user?.username ?? user?.email ?? null;
  const isMobile = useIsMobile();
  const [pageTab, setPageTab] = useState<'sessions' | 'new'>('sessions');
  const [sessionListTab, setSessionListTab] = useState<'active' | 'closed' | 'all'>('active');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | InventoryType>('all');
  const [sessionName, setSessionName] = useState('');
  const [inventoryType, setInventoryType] = useState<InventoryType>('FG');
  const [subInventory, setSubInventory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [sessionsActionError, setSessionsActionError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionSummary | null>(null);
  const sessionsQuery = useSessionSummaries();
  const createSessionMutation = useCreateSessionFromInventory();
  const deleteSessionMutation = useDeleteSession();
  const updateStatusMutation = useUpdateSessionStatus();
  const subInventoryQuery = useSubInventoryNames(inventoryType);
  const previewCountQuery = useInventoryPreviewCount(inventoryType, subInventory);
  const subInventories = subInventoryQuery.data ?? [];
  const previewCount = previewCountQuery.data ?? 0;
  const loadMetadataQuery = useSessionLoadMetadata(subInventories, inventoryType);
  const loadMetadata = loadMetadataQuery.data ?? new Map();
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
  const loading = createSessionMutation.isPending;

  // Auto-generate session name when inventory type or sub-inventory changes
  useEffect(() => {
    const name = generateSessionName(inventoryType, subInventory !== 'all' ? subInventory : undefined);
    setSessionName(name);
  }, [inventoryType, subInventory]);

  useEffect(() => {
    setActiveSessionId(sessionId ?? null);
  }, [sessionId]);

  const handleSessionCreated = (session: ScanningSession) => {
    setActiveSessionId(session.id);
    onSessionChange?.(session.id);
  };

  const handleExitSession = () => {
    setActiveSessionId(null);
    onSessionChange?.(null);
    sessionsQuery.refetch();
  };

  const handleResumeSession = async (session: SessionSummary) => {
    if (session.status === 'closed') return;
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

  const handleRequestDelete = (session: SessionSummary) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setSessionsActionError(null);
    try {
      await deleteSessionMutation.mutateAsync(sessionToDelete.id);
    } catch (err) {
      setSessionsActionError(err instanceof Error ? err.message : 'Failed to delete session');
    }
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
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
              <Button
                size="responsive"
                variant="ghost"
                className="text-destructive"
                onClick={() => handleRequestDelete(session)}
              >
                Delete
              </Button>
              {!isClosed && (
                <Button size="responsive" onClick={() => handleResumeSession(session)}>
                  {session.status === 'draft' ? 'Start' : 'Resume'}
                </Button>
              )}
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

  const handleCreate = async () => {
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }
    setError(null);

    try {
      const session = await createSessionMutation.mutateAsync({
        name: sessionName,
        inventoryType,
        subInventory: subInventory !== 'all' ? subInventory : undefined,
        createdBy: userDisplayName ?? undefined
      });
      handleSessionCreated(session);
    } catch (err) {
      setError(`Failed to create session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (activeSessionId) {
    // Mobile: Full-screen overlay for camera-focused scanning
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

    // Desktop: Keep in-page for keyboard-friendly manual entry
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
          <div className="lg:hidden">
            <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as 'sessions' | 'new')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="new">New Session</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
            <div className={`${pageTab === 'sessions' ? 'block' : 'hidden'} lg:block space-y-3`}>
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

            <div className={`${pageTab === 'new' ? 'block' : 'hidden'} lg:block space-y-4`}>
              <Card className="p-5 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">New Session</h2>
                  <p className="text-sm text-muted-foreground">
                    Create a new scanning session from existing inventory.
                  </p>
                </div>

                <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-name">Session Name</Label>
                      <Input
                        id="session-name"
                        type="text"
                        placeholder="e.g., Sanity Check - FG"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="inventory-type">Inventory Type</Label>
                      <Select value={inventoryType} onValueChange={(value) => setInventoryType(value as InventoryType)}>
                        <SelectTrigger id="inventory-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ASIS">ASIS (As-Is Returns)</SelectItem>
                          <SelectItem value="BackHaul">Back Haul</SelectItem>
                          <SelectItem value="Staged">Staged (Routes)</SelectItem>
                          <SelectItem value="Inbound">Inbound</SelectItem>
                          <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                          <SelectItem value="LocalStock">Local Stock</SelectItem>
                          <SelectItem value="Parts">Parts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {subInventories.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="sub-inventory">Filter by Route/Location (Optional)</Label>
                        <Select value={subInventory} onValueChange={setSubInventory}>
                          <SelectTrigger id="sub-inventory" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Items</SelectItem>
                            {subInventories.map(sub => {
                              const metadata = loadMetadata.get(sub);
                              const friendlyName = metadata?.friendly_name;
                              const color = metadata?.primary_color;
                              const cso = metadata?.ge_cso;
                              const csoLast4 = cso ? cso.slice(-4) : null;

                              return (
                                <SelectItem key={sub} value={sub}>
                                  <div className="flex items-center gap-2">
                                    {color && (
                                      <div
                                        className="h-3 w-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: color }}
                                      />
                                    )}
                                    <span>
                                      {friendlyName || sub}
                                      {csoLast4 && ` [${csoLast4}]`}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{previewCount} items</span> will be included in this session
                      </p>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => onViewChange('inventory')} disabled={loading}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreate} disabled={loading || previewCount === 0}>
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Start Scanning'
                        )}
                      </Button>
                    </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </PageContainer>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this session?"
        description="This will permanently remove the session and its scan history."
        confirmText="Delete Session"
        cancelText="Cancel"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
