import { useState, useEffect, useMemo, useRef } from 'react';
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
import { ScanBarcode, CheckCircle2, Loader2, Search, MapPin, X, Scan } from 'lucide-react';
import type { InventoryItem } from '@/types/inventory';
import type { ScanningSession } from '@/types/session';
import { getSession, updateSessionScannedItems } from '@/lib/sessionManager';
import { findMatchingItemsInSession } from '@/lib/sessionScanner';
// import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/AuthContext';
import { InventoryItemCard } from '@/components/Inventory/InventoryItemCard';
import { getCurrentPosition, logProductLocation } from '@/lib/mapManager';
import {
  feedbackScanDetected,
  feedbackProcessing,
  feedbackSuccess,
  feedbackError,
  feedbackWarning,
} from '@/lib/feedback';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';

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
  const [loadMetadata, setLoadMetadata] = useState<{ friendly_name?: string | null; primary_color?: string | null; ge_cso?: string; ge_source_status?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [matchedItems, setMatchedItems] = useState<InventoryItem[]>([]);
  const [matchedField, setMatchedField] = useState<'serial' | 'cso' | 'model'>('serial');
  const [scannedValue, setScannedValue] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [itemTab, setItemTab] = useState<'pending' | 'scanned' | 'all'>('pending');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null); // Single-select only
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<'scan' | 'search'>('scan');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopProcessingFeedbackRef = useRef<(() => void) | null>(null);

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

        // Fetch load metadata if session has subInventory
        if (data.subInventory && data.inventoryType === 'ASIS') {
          const { locationId } = getActiveLocationContext();
          const { data: loadData } = await supabase
            .from('load_metadata')
            .select('friendly_name, primary_color, ge_cso, ge_source_status')
            .eq('location_id', locationId)
            .eq('inventory_type', data.inventoryType)
            .eq('sub_inventory_name', data.subInventory)
            .single();

          if (loadData && isMounted) {
            setLoadMetadata(loadData);
          }
        }
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
    setSelectedItemId(null);
  }, [itemTab]);


  const handleScan = async (barcode: string) => {
    setScannerOpen(false);
    setScannedValue(barcode);

    if (!session) return;

    if (session.status === 'closed') {
      feedbackError();
      setAlert({
        type: 'error',
        message: 'This session is closed and cannot be updated.'
      });
      setTimeout(() => setAlert(null), 4000);
      return;
    }

    const result = findMatchingItemsInSession(barcode, session);

    if (result.type === 'not_found') {
      feedbackError();
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
        feedbackWarning();
        setAlert({
          type: 'error',
          message: 'Item already scanned in this session.'
        });
        setTimeout(() => setAlert(null), 3000);
        return;
      }

      // Start processing feedback (pulsing haptic + visual)
      setIsProcessing(true);
      setProcessingItemId(itemId);
      stopProcessingFeedbackRef.current = feedbackProcessing();

      const nextScanned = [...session.scannedItemIds, itemId];
      const { data: updatedSession, error } = await updateSessionScannedItems({
        sessionId: session.id,
        scannedItemIds: nextScanned,
        updatedBy: userDisplayName
      });

      // Stop processing feedback
      stopProcessingFeedbackRef.current?.();
      stopProcessingFeedbackRef.current = null;
      setIsProcessing(false);
      setProcessingItemId(null);

      if (error || !updatedSession) {
        feedbackError();
        setAlert({
          type: 'error',
          message: error?.message || 'Failed to update session'
        });
        setTimeout(() => setAlert(null), 4000);
        return;
      }

      // Success!
      feedbackSuccess();
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
      setTimeout(() => setAlert(null), 2000);
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

  // Use inputValue for search when in search mode
  const searchQuery = inputMode === 'search' ? inputValue : '';

  const filteredPending = useMemo(() => {
    return unscannedItems
      .filter(item => matchesItemSearch(item, searchQuery))
      .sort((a, b) => {
        const modelA = (a.model ?? a.product_type ?? '').toUpperCase();
        const modelB = (b.model ?? b.product_type ?? '').toUpperCase();
        return modelA.localeCompare(modelB);
      });
  }, [unscannedItems, searchQuery]);

  const filteredScanned = useMemo(() => {
    return scannedItems
      .filter(item => matchesItemSearch(item, searchQuery))
      .sort((a, b) => {
        const modelA = (a.model ?? a.product_type ?? '').toUpperCase();
        const modelB = (b.model ?? b.product_type ?? '').toUpperCase();
        return modelA.localeCompare(modelB);
      });
  }, [scannedItems, searchQuery]);

  // Group items by first letter of model number
  const groupedPending = useMemo(() => {
    const groups: Record<string, typeof filteredPending> = {};

    filteredPending.forEach(item => {
      const model = item.model ?? item.product_type ?? '';
      const firstChar = model.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';

      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(item);
    });

    return groups;
  }, [filteredPending]);

  const availableLetters = useMemo(() => {
    return Object.keys(groupedPending).sort((a, b) => {
      // Put '#' at the end
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [groupedPending]);

  const toggleItemSelection = (id: string) => {
    setSelectedItemId(prev => prev === id ? null : id);
  };

  const handleMarkSelected = async () => {
    if (!selectedItemId) return;

    await handleMultiSelectConfirm([selectedItemId]);
    setSelectedItemId(null);
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

  const remainingCount = Math.max(progress.total - progress.scanned, 0);

  // Format session name with load info if available
  const displayName = loadMetadata
    ? `${loadMetadata.friendly_name || session.subInventory} - ${session.inventoryType}${loadMetadata.ge_cso ? ` [${loadMetadata.ge_cso.slice(-4)}]` : ''}`
    : session.name;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-background/95 border-b sticky top-0 z-10 backdrop-blur">
        <PageContainer className="py-3 space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {loadMetadata?.primary_color && (
                <div
                  className="w-4 h-4 rounded shrink-0 border border-border"
                  style={{ backgroundColor: loadMetadata.primary_color }}
                />
              )}
              <h1 className="text-base font-semibold truncate">{displayName}</h1>
              {loadMetadata?.ge_source_status && (
                <Badge variant="outline">{loadMetadata.ge_source_status}</Badge>
              )}
            </div>
            {session.status !== 'closed' && (
              <Button variant="ghost" size="sm" onClick={onExit}>
                <X className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-2">Exit</span>
              </Button>
            )}
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

          {/* Combined Input (Scan/Search with Mode Toggle) */}
          {session.status !== 'closed' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {inputMode === 'scan' ? (
                    <Scan className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  )}
                  <Input
                    ref={inputRef}
                    type={inputMode === 'scan' ? 'text' : 'search'}
                    inputMode={inputMode === 'scan' ? 'none' : 'text'}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inputMode === 'scan' && inputValue.trim()) {
                        e.preventDefault();
                        feedbackScanDetected();
                        handleScan(inputValue.trim());
                        setInputValue('');
                      }
                    }}
                    placeholder={inputMode === 'scan' ? 'Scan barcode here...' : 'Search items...'}
                    className={inputMode === 'scan' ? 'pl-10 h-12 text-base font-mono' : 'pl-9 h-12'}
                    disabled={isProcessing}
                    autoComplete={inputMode === 'scan' ? 'off' : 'on'}
                    autoCorrect={inputMode === 'scan' ? 'off' : 'on'}
                    autoCapitalize={inputMode === 'scan' ? 'off' : 'on'}
                    spellCheck={inputMode === 'search'}
                  />
                  {isProcessing && (
                    <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-primary" />
                  )}
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-4"
                  onClick={() => {
                    if (inputMode === 'scan') {
                      setInputMode('search');
                      setInputValue('');
                    } else {
                      setInputMode('scan');
                      setInputValue('');
                    }
                    inputRef.current?.focus();
                  }}
                  disabled={isProcessing}
                >
                  {inputMode === 'scan' ? (
                    <Search className="h-5 w-5" />
                  ) : (
                    <Scan className="h-5 w-5" />
                  )}
                </Button>
                {inputMode === 'scan' && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 px-4"
                    onClick={() => {
                      setScannerOpen(true);
                    }}
                    disabled={isProcessing}
                  >
                    <ScanBarcode className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="space-y-2">
            <Tabs value={itemTab} onValueChange={(v) => setItemTab(v as 'pending' | 'scanned' | 'all')}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="pending" className="text-xs sm:text-sm">Pending ({unscannedItems.length})</TabsTrigger>
                <TabsTrigger value="scanned" className="text-xs sm:text-sm">Scanned ({scannedItems.length})</TabsTrigger>
                <TabsTrigger value="all" className="text-xs sm:text-sm">All ({progress.total})</TabsTrigger>
              </TabsList>
            </Tabs>
            {/* Count info */}
            {(itemTab === 'pending' || itemTab === 'all') && filteredPending.length > 0 && (
              <div className="text-right text-[10px] text-muted-foreground">
                {filteredPending.length} shown
              </div>
            )}
            {itemTab === 'scanned' && filteredScanned.length > 0 && (
              <div className="text-right text-[10px] text-muted-foreground">
                {filteredScanned.length} shown
              </div>
            )}
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
            {itemTab === 'all' && (
              <div className="flex items-center justify-between text-xs">
                <span className="uppercase tracking-wide text-muted-foreground">Pending Items</span>
                {session.status !== 'closed' && selectedItemId && (
                  <Button size="sm" variant="default" onClick={handleMarkSelected}>
                    <CheckCircle2 className="h-3 w-3 mr-1.5" />
                    Mark as Scanned
                  </Button>
                )}
              </div>
            )}
            {session.status !== 'closed' && selectedItemId && itemTab === 'pending' && (
              <div className="flex items-center justify-end text-xs">
                <Button size="sm" variant="default" onClick={handleMarkSelected}>
                  <CheckCircle2 className="h-3 w-3 mr-1.5" />
                  Mark as Scanned
                </Button>
              </div>
            )}
            {filteredPending.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">No pending items found.</Card>
            ) : (
              <div className="space-y-6">
                {availableLetters.map(letter => (
                  <div key={letter}>
                    {/* Items in this section */}
                    <div className="space-y-2">
                      {groupedPending[letter].map(item => (
                        <div
                          key={item.id}
                          className={`relative ${processingItemId === item.id ? 'animate-pulse ring-2 ring-primary rounded-lg' : ''}`}
                        >
                          <InventoryItemCard
                            item={item}
                            onClick={session.status !== 'closed' ? () => toggleItemSelection(item.id!) : undefined}
                            variant="pending"
                            selected={selectedItemId === item.id}
                            showInventoryTypeBadge={false}
                            showProductMeta={false}
                            showRouteBadge={false}
                          />
                          {session.status !== 'closed' && (
                            <div className="absolute top-3 right-3 pointer-events-auto">
                              <Checkbox
                                checked={selectedItemId === item.id}
                                onCheckedChange={() => toggleItemSelection(item.id!)}
                                onClick={(event) => event.stopPropagation()}
                                className="bg-background border-2"
                              />
                            </div>
                          )}
                          {processingItemId === item.id && (
                            <div className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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
                  <div key={item.id} className="relative">
                    <InventoryItemCard
                      item={item}
                      variant="scanned"
                      showInventoryTypeBadge={false}
                      showProductMeta={false}
                      showRouteBadge={false}
                    />
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
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
