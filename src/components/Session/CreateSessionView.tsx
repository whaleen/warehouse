import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, ArrowLeft, Search } from 'lucide-react';
import Papa from 'papaparse';
import type { InventoryType, InventoryItem } from '@/types/inventory';
import type { ScanningSession, SessionSummary } from '@/types/session';
import supabase from '@/lib/supabase';
import { createSession, deleteSession, getSessionSummaries, updateSessionStatus } from '@/lib/sessionManager';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { ScanningSessionView } from '@/components/Session/ScanningSessionView';
import { useAuth } from '@/context/AuthContext';
import { getActiveLocationContext } from '@/lib/tenant';
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
  FG: 'FG',
  LocalStock: 'LocalStock',
  Parts: 'Parts',
  WillCall: 'WillCall'
};

interface CSVRow {
  Date: string;
  Truck_Id: string;
  Stop: string;
  CSO: string;
  Consumer_Customer_Name: string;
  Model: string;
  Qty: string;
  Serial: string;
  Product_Type: string;
  Status: string;
}

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
  const { locationId, companyId } = getActiveLocationContext();
  const [activeTab, setActiveTab] = useState<'existing' | 'upload'>('existing');
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

  // CSV Upload state
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);

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
    if (activeTab === 'existing') {
      const name = generateSessionName(inventoryType, subInventory !== 'all' ? subInventory : undefined);
      setSessionName(name);
    }
  }, [inventoryType, subInventory, activeTab]);

  // Preview count
  useEffect(() => {
    if (activeTab !== 'existing') return;

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
  }, [inventoryType, subInventory, activeTab, locationId]);

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
            .from('users')
            .select('username, image')
            .in('username', createdByNames);

        if (!usersError && usersData) {
          const nextMap: Record<string, string | null> = {};
          usersData.forEach(userRecord => {
            nextMap[userRecord.username] = userRecord.image ?? null;
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
        updatedBy: user?.username
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
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => handleRequestDelete(session)}
              >
                Delete
              </Button>
              {!isClosed && (
                <Button size="sm" onClick={() => handleResumeSession(session)}>
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);

      Papa.parse(selectedFile, {
        header: true,
        preview: 5,
        complete: (results) => {
          setCsvPreview(results.data as CSVRow[]);
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`);
        }
      });
    }
  };

  const handleUploadAndCreateSession = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as CSVRow[];

          const inventoryItems: InventoryItem[] = rows.map(row => ({
            date: row.Date || undefined,
            route_id: row.Truck_Id || undefined,
            stop: parseInt(row.Stop) || undefined,
            cso: row.CSO,
            consumer_customer_name: row.Consumer_Customer_Name || undefined,
            model: row.Model,
            qty: parseInt(row.Qty) || 1,
            serial: row.Serial || undefined,
            product_type: row.Product_Type,
            status: row.Status || undefined,
            inventory_type: inventoryType,
            sub_inventory: inventoryType === 'Staged' ? row.Truck_Id : undefined,
            is_scanned: false
          }));

          const { data: insertedItems, error: insertError } = await supabase
            .from('inventory_items')
            .insert(
              inventoryItems.map(item => ({
                ...item,
                company_id: companyId,
                location_id: locationId,
              }))
            )
            .select('*');

          if (insertError) {
            setError(`Failed to upload: ${insertError.message}`);
            setLoading(false);
            return;
          }

          const name = generateSessionName(inventoryType);

          const { data: session, error: sessionError } = await createSession({
            name,
            inventoryType,
            items: (insertedItems || []) as InventoryItem[],
            createdBy: user?.username
          });

          if (sessionError || !session) {
            setError(`Failed to create session: ${sessionError?.message || 'Unknown error'}`);
            setLoading(false);
            return;
          }

          handleSessionCreated(session);
          setLoading(false);
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`);
          setLoading(false);
        }
      });
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

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
        createdBy: user?.username
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
        actions={
          <Button variant="ghost" size="icon" onClick={() => onViewChange('inventory')}>
            <ArrowLeft />
          </Button>
        }
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
              <Card className="p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Sessions</h2>
                    <p className="text-sm text-muted-foreground">
                      Track open scanning work and review completed sessions.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSessions}
                    disabled={sessionsLoading}
                  >
                    {sessionsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>

                <Tabs value={sessionListTab} onValueChange={(v) => setSessionListTab(v as 'active' | 'closed' | 'all')}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="active">Open ({activeSessions.length})</TabsTrigger>
                    <TabsTrigger value="closed">Closed ({closedSessions.length})</TabsTrigger>
                    <TabsTrigger value="all">All ({sessions.length})</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, type, or user"
                      value={sessionSearch}
                      onChange={(e) => setSessionSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
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
                    Start from existing inventory or upload a CSV.
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'existing' | 'upload')} className="w-full">
                  <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
                    <TabsTrigger value="existing">From Existing</TabsTrigger>
                    <TabsTrigger value="upload">Upload New</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-4 mt-4">
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
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="upload-inventory-type">Inventory Type</Label>
                      <Select value={inventoryType} onValueChange={(value) => setInventoryType(value as InventoryType)}>
                        <SelectTrigger id="upload-inventory-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ASIS">ASIS (As-Is Returns)</SelectItem>
                          <SelectItem value="BackHaul">Back Haul</SelectItem>
                          <SelectItem value="Staged">Staged (Routes)</SelectItem>
                          <SelectItem value="Inbound">Inbound</SelectItem>
                          <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                          <SelectItem value="LocalStock">Local Stock</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {inventoryType === 'Staged'
                          ? 'Truck IDs will be used as route names (sub-inventory)'
                          : 'All items will be tagged as ' + inventoryType}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="csv-file">CSV File</Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Expected columns: Date, Truck_Id, Stop, CSO, Consumer_Customer_Name, Model, Qty, Serial, Product_Type, Status
                      </p>
                    </div>

                    {csvPreview.length > 0 && (
                      <div className="space-y-2">
                        <Label>Preview (first 5 rows)</Label>
                        <div className="border rounded-md overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted">
                              <tr>
                                <th className="px-2 py-1 text-left">CSO</th>
                                <th className="px-2 py-1 text-left">Model</th>
                                <th className="px-2 py-1 text-left">Serial</th>
                                <th className="px-2 py-1 text-left">Product Type</th>
                                <th className="px-2 py-1 text-left">Truck ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.map((row, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="px-2 py-1">{row.CSO}</td>
                                  <td className="px-2 py-1">{row.Model}</td>
                                  <td className="px-2 py-1">{row.Serial || '-'}</td>
                                  <td className="px-2 py-1">{row.Product_Type}</td>
                                  <td className="px-2 py-1">{row.Truck_Id}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => onViewChange('inventory')} disabled={loading}>
                        Cancel
                      </Button>
                      <Button onClick={handleUploadAndCreateSession} disabled={!file || loading}>
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload & Start Scanning
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
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
