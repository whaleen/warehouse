import { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { InventoryType, InventoryItem } from '@/types/inventory';
import type { ScanningSession, SessionSummary } from '@/types/session';
import supabase from '@/lib/supabase';
import { createSession, deleteSession, getSessionSummaries, updateSessionStatus } from '@/lib/sessionManager';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { MobileOverlay } from '@/components/Layout/MobileOverlay';
import { ScanningSessionView } from '@/components/Session/ScanningSessionView';
import { useAuth } from '@/context/AuthContext';
import { getActiveLocationContext } from '@/lib/tenant';
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
  const { locationId } = getActiveLocationContext();
  const isMobile = useIsMobile();
  const [pageTab, setPageTab] = useState<'sessions' | 'new'>('sessions');
  const [sessionListTab, setSessionListTab] = useState<'active' | 'closed' | 'all'>('active');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | InventoryType>('all');
  const [sessionName, setSessionName] = useState('');
  const [inventoryType, setInventoryType] = useState<InventoryType>('FG');
  const [subInventory, setSubInventory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [subInventories, setSubInventories] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);
  const [creatorAvatars, setCreatorAvatars] = useState<Record<string, string | null>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionSummary | null>(null);

  // Fetch available sub-inventories when inventory type changes
  useEffect(() => {
    const fetchSubInventories = async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('sub_inventory')
        .eq('location_id', locationId)
        .eq('inventory_type', inventoryType)
        .not('sub_inventory', 'is', null);

      if (data) {
        const unique = [...new Set(data.map(d => d.sub_inventory))].filter(Boolean) as string[];
        setSubInventories(unique);
      }
    };

    fetchSubInventories();
  }, [inventoryType, locationId]);

  // Auto-generate session name when inventory type or sub-inventory changes
  useEffect(() => {
    const name = generateSessionName(inventoryType, subInventory !== 'all' ? subInventory : undefined);
    setSessionName(name);
  }, [inventoryType, subInventory]);

  // Preview count
  useEffect(() => {

    const fetchPreview = async () => {
      let query = supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('inventory_type', inventoryType);

      if (subInventory !== 'all') {
        query = query.eq('sub_inventory', subInventory);
      }

      const { count } = await query;
      setPreviewCount(count || 0);
    };

    fetchPreview();
  }, [inventoryType, subInventory, locationId]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    const { data, error: sessionsFetchError } = await getSessionSummaries();
    if (sessionsFetchError) {
      setSessionsError(sessionsFetchError.message || 'Failed to load sessions');
      setSessions([]);
    } else {
      const summaries = data ?? [];
      setSessions(summaries);

      const createdByNames = Array.from(
        new Set(summaries.map(session => session.createdBy).filter(Boolean) as string[])
      );

      if (createdByNames.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('username, email, image')
          .in('username', createdByNames);

        const { data: usersByEmail, error: emailError } = await supabase
          .from('profiles')
          .select('username, email, image')
          .in('email', createdByNames);

        if (!usersError && !emailError) {
          const nextMap: Record<string, string | null> = {};
          [...(usersData ?? []), ...(usersByEmail ?? [])].forEach((userRecord) => {
            if (userRecord.username) nextMap[userRecord.username] = userRecord.image ?? null;
            if (userRecord.email) nextMap[userRecord.email] = userRecord.image ?? null;
          });
          setCreatorAvatars(prev => ({ ...prev, ...nextMap }));
        }
      }
    }
    setSessionsLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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
    fetchSessions();
  };

  const handleResumeSession = async (session: SessionSummary) => {
    if (session.status === 'closed') return;
    if (session.status === 'draft') {
      const { error: statusError } = await updateSessionStatus({
        sessionId: session.id,
        status: 'active',
        updatedBy: userDisplayName ?? undefined
      });
      if (statusError) {
        setSessionsError(statusError.message || 'Failed to start session');
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
    const { error: deleteError } = await deleteSession(sessionToDelete.id);
    if (deleteError) {
      setSessionsError(deleteError.message || 'Failed to delete session');
    } else {
      setSessionsError(null);
      fetchSessions();
    }
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  const renderSessionCard = (session: SessionSummary) => {
    const isClosed = session.status === 'closed';
    const isComplete = session.totalItems > 0 && session.scannedCount === session.totalItems;
    const progress = session.totalItems > 0 ? Math.round((session.scannedCount / session.totalItems) * 100) : 0;
    const statusLabel = isClosed ? 'Closed' : session.status === 'draft' ? 'Draft' : 'Active';
    const statusVariant = isClosed ? 'secondary' : session.status === 'draft' ? 'outline' : 'default';
    const timestamp = isClosed
      ? formatSessionTimestamp(session.closedAt || session.updatedAt || session.createdAt)
      : formatSessionTimestamp(session.createdAt);

    return (
      <Card key={session.id} className="p-4 space-y-4 border-border/60 bg-background/90">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold truncate">{session.name}</h3>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              {isClosed && !isComplete && (
                <Badge variant="destructive">Incomplete</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{inventoryTypeLabels[session.inventoryType]}</Badge>
              {session.subInventory && (
                <Badge variant="secondary">{session.subInventory}</Badge>
              )}
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

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('inventory_items')
        .select('*')
        .eq('location_id', locationId)
        .eq('inventory_type', inventoryType);

      if (subInventory !== 'all') {
        query = query.eq('sub_inventory', subInventory);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(`Failed to fetch items: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError('No items found for this inventory type');
        setLoading(false);
        return;
      }

      const { data: session, error: sessionError } = await createSession({
        name: sessionName,
        inventoryType,
        subInventory: subInventory !== 'all' ? subInventory : undefined,
        items: data as InventoryItem[],
        createdBy: userDisplayName ?? undefined
      });

      if (sessionError || !session) {
        setError(`Failed to create session: ${sessionError?.message || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      handleSessionCreated(session);
    } catch (err) {
      setError(`Failed to create session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
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
      <AppHeader
        title="Scanning Sessions"
        onMenuClick={onMenuClick}
      />

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
            <div className={`${pageTab === 'sessions' ? 'block' : 'hidden'} lg:block space-y-4`}>
              <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Sessions</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Track open scanning work and review completed sessions.
                  </p>
                </div>

                <div className="grid gap-3 grid-cols-2">
                  <Select
                    value={sessionTypeFilter}
                    onValueChange={(value) => setSessionTypeFilter(value as 'all' | InventoryType)}
                  >
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Open ({activeSessions.length})</SelectItem>
                      <SelectItem value="closed">Closed ({closedSessions.length})</SelectItem>
                      <SelectItem value="all">All ({sessions.length})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, type, or user"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </Card>

              {sessionsLoading && (
                <Card className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading sessions…
                </Card>
              )}

              {sessionsError && !sessionsLoading && (
                <Alert variant="destructive">
                  <AlertDescription>{sessionsError}</AlertDescription>
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
                            {subInventories.map(sub => (
                              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
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
