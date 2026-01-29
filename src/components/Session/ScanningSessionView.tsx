import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageContainer } from '@/components/Layout/PageContainer';
import { BarcodeScanner } from '@/components/Scanner/BarcodeScanner';
import { ItemSelectionDialog } from '@/components/Scanner/ItemSelectionDialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScanBarcode, CheckCircle2, Circle, Loader2, Search, MapPin, X } from 'lucide-react';
import type { InventoryItem } from '@/types/inventory';
import type { ScanningSession } from '@/types/session';
import { getSession, updateSessionScannedItems } from '@/lib/sessionManager';
import { findMatchingItemsInSession } from '@/lib/sessionScanner';
// import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/AuthContext';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';
import { getCurrentPosition, logProductLocation } from '@/lib/mapManager';

interface ScanningSessionViewProps {
  sessionId: string;
  onExit: () => void;
}

function matchesItemSearch(item: InventoryItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.product_type?.toLowerCase().includes(q) ||
    item.cso?.toLowerCase().includes(q) ||
    item.serial?.toLowerCase().includes(q) ||
    item.model?.toLowerCase().includes(q) ||
    item.route_id?.toLowerCase().includes(q) ||
    item.sub_inventory?.toLowerCase().includes(q) ||
    item.consumer_customer_name?.toLowerCase().includes(q)
  );
}

/**
 * Capture GPS position for a scan and log to map system
 * Non-blocking - runs async without blocking scan success
 *
 * Note: inventoryItemId is optional since session items are snapshots
 * and may not have valid references in the inventory_items table.
 * We snapshot product_type and sub_inventory for map visualization.
 */
async function capturePositionForScan(
  productId: string | undefined,
  inventoryItemId: string | undefined,
  sessionId: string,
  scannedBy: string | undefined,
  productType: string | undefined,
  subInventory: string | undefined
) {
  try {
    const position = await getCurrentPosition();

    if (!position) {
      console.warn('Position capture failed - GPS unavailable or denied');
      return;
    }

    // Log position to map system
    const { success, error } = await logProductLocation({
      product_id: productId,
      inventory_item_id: inventoryItemId,
      scanning_session_id: sessionId,
      raw_lat: position.latitude,
      raw_lng: position.longitude,
      accuracy: position.accuracy,
      scanned_by: scannedBy,
      product_type: productType,
      sub_inventory: subInventory,
    });

    if (success) {
      console.log(
        `Position captured: (${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}) ±${Math.round(position.accuracy)}m`
      );
    } else {
      console.error('Failed to log position:', error);
    }
  } catch (err) {
    console.error('Position capture error:', err);
  }
}

export function ScanningSessionView({ sessionId, onExit }: ScanningSessionViewProps) {
  // const { toast } = useToast();
  const { user } = useAuth();
  const userDisplayName = user?.username ?? user?.email ?? undefined;
  const [session, setSession] = useState<ScanningSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [matchedItems, setMatchedItems] = useState<InventoryItem[]>([]);
  const [matchedField, setMatchedField] = useState<'serial' | 'cso' | 'model'>('serial');
  const [scannedValue, setScannedValue] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [itemTab, setItemTab] = useState<'pending' | 'scanned' | 'all'>('pending');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await getSession(sessionId);
      if (!isMounted) return;
      if (error || !data) {
        setLoadError(error?.message || 'Session not found');
        setSession(null);
      } else {
        setSession(data);
      }
      setLoading(false);
    };

    fetchSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedItems(new Set());
  }, [itemTab]);


  const handleScan = async (barcode: string) => {
    setScannerOpen(false);
    setScannedValue(barcode);

    if (!session) return;

    if (session.status === 'closed') {
      setAlert({
        type: 'error',
        message: 'This session is closed and cannot be updated.'
      });
      setTimeout(() => setAlert(null), 4000);
      return;
    }

    const result = findMatchingItemsInSession(barcode, session);

    if (result.type === 'not_found') {
      setAlert({
        type: 'error',
        message: `No matching items found for: ${barcode}`
      });
      setTimeout(() => setAlert(null), 5000);
      return;
    }

    if (result.type === 'unique' && result.items && result.items.length === 1) {
      const itemId = result.items[0].id!;
      if (session.scannedItemIds.includes(itemId)) {
        setAlert({
          type: 'error',
          message: 'Item already scanned in this session.'
        });
        setTimeout(() => setAlert(null), 3000);
        return;
      }

      const nextScanned = [...session.scannedItemIds, itemId];
      const { data: updatedSession, error } = await updateSessionScannedItems({
        sessionId: session.id,
        scannedItemIds: nextScanned,
        updatedBy: userDisplayName
      });

      if (error || !updatedSession) {
        setAlert({
          type: 'error',
          message: error?.message || 'Failed to update session'
        });
        setTimeout(() => setAlert(null), 4000);
        return;
      }

      setSession(updatedSession);

      // Capture position for fog of war map (non-blocking)
      capturePositionForScan(
        result.items[0].products?.id ?? result.items[0].product_fk,
        itemId, // May not exist in inventory_items table (session snapshot)
        session.id,
        userDisplayName,
        result.items[0].product_type,
        result.items[0].sub_inventory ?? undefined
      );

      setAlert({
        type: 'success',
        message: `Scanned: ${result.items[0].product_type} (${result.matchedField?.toUpperCase()})`
      });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    if (result.type === 'multiple' && result.items && result.matchedField) {
      setMatchedItems(result.items);
      setMatchedField(result.matchedField);
      setSelectionDialogOpen(true);
    }
  };

  const handleMultiSelectConfirm = async (selectedIds: string[]) => {
    if (selectedIds.length === 0 || !session) return;
    if (session.status === 'closed') return;

    const uniqueIds = selectedIds.filter(id => !session.scannedItemIds.includes(id));
    if (uniqueIds.length === 0) {
      setAlert({
        type: 'error',
        message: 'Selected items already scanned.'
      });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    const nextScanned = [...session.scannedItemIds, ...uniqueIds];
    const { data: updatedSession, error } = await updateSessionScannedItems({
      sessionId: session.id,
      scannedItemIds: nextScanned,
      updatedBy: userDisplayName
    });

    if (error || !updatedSession) {
      setAlert({
        type: 'error',
        message: error?.message || 'Failed to update session'
      });
      setTimeout(() => setAlert(null), 4000);
      return;
    }

    setSession(updatedSession);

    // Capture position for all selected items (they're at the same location)
    const markedItems = updatedSession.items.filter(item => item.id && uniqueIds.includes(item.id));
    for (const item of markedItems) {
      capturePositionForScan(
        item.products?.id ?? item.product_fk,
        item.id, // May not exist in inventory_items table (session snapshot)
        updatedSession.id,
        userDisplayName,
        item.product_type,
        item.sub_inventory ?? undefined
      );
    }

    setAlert({
      type: 'success',
      message: `Marked ${uniqueIds.length} items as scanned`
    });
    setTimeout(() => setAlert(null), 3000);
  };

  const progress = useMemo(() => {
    if (!session) return { total: 0, scanned: 0, percentage: 0 };
    const total = session.items.length;
    const scanned = session.scannedItemIds.length;
    const percentage = total > 0 ? (scanned / total) * 100 : 0;
    return { total, scanned, percentage };
  }, [session]);

  const { scannedItems, unscannedItems } = useMemo(() => {
    if (!session) return { scannedItems: [], unscannedItems: [] };

    const scanned = session.items.filter(item => session.scannedItemIds.includes(item.id!));
    const unscanned = session.items.filter(item => !session.scannedItemIds.includes(item.id!));

    return { scannedItems: scanned, unscannedItems: unscanned };
  }, [session]);

  const filteredPending = useMemo(() => {
    return unscannedItems.filter(item => matchesItemSearch(item, itemSearch));
  }, [unscannedItems, itemSearch]);

  const filteredScanned = useMemo(() => {
    return scannedItems.filter(item => matchesItemSearch(item, itemSearch));
  }, [scannedItems, itemSearch]);

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllPending = () => {
    setSelectedItems(new Set(filteredPending.map(item => item.id!).filter(Boolean)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleMarkSelected = async () => {
    const selected = Array.from(selectedItems);
    if (selected.length > 0) {
      await handleMultiSelectConfirm(selected);
      setSelectedItems(new Set());
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <p>{loadError || 'No active session'}</p>
        <Button variant="outline" onClick={onExit}>Return to sessions</Button>
      </div>
    );
  }

  const statusLabel = session.status === 'closed' ? 'Closed' : session.status === 'draft' ? 'Draft' : 'Active';
  const statusVariant = session.status === 'closed' ? 'secondary' : session.status === 'draft' ? 'outline' : 'default';
  const remainingCount = Math.max(progress.total - progress.scanned, 0);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-background/95 border-b sticky top-0 z-10 backdrop-blur">
        <PageContainer className="py-3 space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold truncate">{session.name}</h1>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onExit}>
              <X className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Exit</span>
            </Button>
          </div>

          {/* Progress bar with inline stats */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="font-medium text-foreground">{progress.scanned} / {progress.total}</span>
                <span>{Math.round(progress.percentage)}%</span>
                {session.status !== 'closed' && navigator.geolocation && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    GPS
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{remainingCount} remaining</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>

          {/* Tabs and search */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Tabs value={itemTab} onValueChange={(v) => setItemTab(v as 'pending' | 'scanned' | 'all')}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="pending" className="text-xs sm:text-sm">Pending ({unscannedItems.length})</TabsTrigger>
                <TabsTrigger value="scanned" className="text-xs sm:text-sm">Scanned ({scannedItems.length})</TabsTrigger>
                <TabsTrigger value="all" className="text-xs sm:text-sm">All ({progress.total})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search items..."
                className="pl-9"
              />
            </div>
          </div>
        </PageContainer>
      </div>

      {session.status === 'closed' && (
        <PageContainer className="pt-4">
          <Alert>
            <AlertDescription>
              This session is closed. Scanning is disabled.
            </AlertDescription>
          </Alert>
        </PageContainer>
      )}

      {alert && (
        <PageContainer className="pt-4">
          <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        </PageContainer>
      )}

      <PageContainer className="py-6 pb-32 space-y-6">
        {(itemTab === 'pending' || itemTab === 'all') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {itemTab === 'all' && (
                  <span className="uppercase tracking-wide text-muted-foreground">Pending Items</span>
                )}
                {session.status !== 'closed' && (
                  <>
                    <Button size="sm" variant="outline" onClick={selectAllPending}>
                      Select All
                    </Button>
                    <Button size="sm" variant="outline" onClick={clearSelection}>
                      Clear
                    </Button>
                  </>
                )}
              </div>
              <span className="text-muted-foreground">
                {selectedItems.size > 0 ? `${selectedItems.size} selected • ` : ''}{filteredPending.length} shown
              </span>
            </div>
            {filteredPending.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">No pending items found.</Card>
            ) : (
              <div className="space-y-2">
                {filteredPending.map(item => (
                  <InventoryItemCard
                    key={item.id}
                    item={item}
                    leading={
                      session.status !== 'closed' ? (
                        <Checkbox
                          checked={selectedItems.has(item.id!)}
                          onCheckedChange={() => toggleItemSelection(item.id!)}
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/70" />
                      )
                    }
                    onClick={session.status !== 'closed' ? () => toggleItemSelection(item.id!) : undefined}
                    variant="pending"
                    selected={selectedItems.has(item.id!)}
                    showInventoryTypeBadge={false}
                    showProductMeta={false}
                    routeValue={item.route_id ?? item.sub_inventory}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {(itemTab === 'scanned' || itemTab === 'all') && (
          <div className="space-y-3">
            {itemTab === 'all' && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-wide">Scanned Items</span>
                <span>{filteredScanned.length} shown</span>
              </div>
            )}
            {filteredScanned.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">No scanned items found.</Card>
            ) : (
              <div className="space-y-2">
                {filteredScanned.map(item => (
                  <InventoryItemCard
                    key={item.id}
                    item={item}
                    leading={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    variant="scanned"
                    showInventoryTypeBadge={false}
                    showProductMeta={false}
                    routeValue={item.route_id ?? item.sub_inventory}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {progress.scanned === progress.total && progress.total > 0 && (
          <Card className="p-6 bg-emerald-500/10 border-emerald-500/30 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Session Complete!
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              All {progress.total} items have been scanned
            </p>
            <Button onClick={onExit}>Exit Session</Button>
          </Card>
        )}
      </PageContainer>

      {session.status !== 'closed' && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur">
          <PageContainer className="py-3 flex flex-col gap-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleMarkSelected}
              disabled={selectedItems.size === 0}
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {selectedItems.size > 0 ? `Mark ${selectedItems.size} Selected` : 'Mark Selected'}
            </Button>
            <Button
              size="lg"
              className="w-full h-12 text-base font-semibold"
              onClick={() => setScannerOpen(true)}
              disabled={unscannedItems.length === 0}
            >
              <ScanBarcode className="h-5 w-5 mr-2" />
              Scan Barcode
            </Button>
          </PageContainer>
        </div>
      )}

      {scannerOpen && session.status !== 'closed' && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setScannerOpen(false)}
          inventoryType={session.inventoryType}
        />
      )}

      <ItemSelectionDialog
        open={selectionDialogOpen}
        onOpenChange={setSelectionDialogOpen}
        items={matchedItems}
        matchedField={matchedField}
        matchedValue={scannedValue}
        onConfirm={handleMultiSelectConfirm}
      />
    </div>
  );
}
