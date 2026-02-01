import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, ScanBarcode, Scan, ChevronDown, ClipboardList } from 'lucide-react';
import { BarcodeScanner } from '@/components/Scanner/BarcodeScanner';
import { OverlayPortal } from '@/components/Layout/OverlayPortal';
import { uiLayers } from '@/lib/uiLayers';
import { feedbackScanDetected, feedbackSuccess, feedbackError } from '@/lib/feedback';
import { getCurrentPosition, logProductLocation } from '@/lib/mapManager';
import { findMatchingItemsInInventory } from '@/lib/inventoryScanner';
import { getOrCreateAdHocSession, getOrCreateFogOfWarSession } from '@/lib/sessionManager';
import { useAuth } from '@/context/AuthContext';
import { useSessionSummaries } from '@/hooks/queries/useSessions';
import { useQueryClient } from '@tanstack/react-query';
import { getActiveLocationContext } from '@/lib/tenant';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface QuickScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
}

type ScanMode = 'ad-hoc' | 'fog-of-war';

const MODE_STORAGE_KEY = 'warehouse.quickscan.mode';

export function QuickScanner({ onScan, onClose, title = 'Quick Scan' }: QuickScannerProps) {
  const { user } = useAuth();
  const userDisplayName = user?.username ?? user?.email ?? undefined;
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();
  const sessionSummariesQuery = useSessionSummaries();
  const openSessions = sessionSummariesQuery.data?.filter(s => s.status !== 'closed') ?? [];

  const [mode, setMode] = useState<ScanMode>(() => {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return (saved === 'ad-hoc' || saved === 'fog-of-war') ? saved : 'ad-hoc';
  });
  const [inputValue, setInputValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Persist mode preference
  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  const showAlert = (type: 'success' | 'error', message: string, duration = 3000) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), duration);
  };

  const handleAdHocScan = async (barcode: string) => {
    setIsProcessing(true);

    try {
      // Get or create permanent ad-hoc session
      const { sessionId: adHocSessionId, error: sessionError } = await getOrCreateAdHocSession();
      if (!adHocSessionId || sessionError) {
        feedbackError();
        console.error('Ad-hoc session error:', sessionError);
        showAlert('error', 'Failed to get ad-hoc session');
        return;
      }

      // Capture GPS position
      const position = await getCurrentPosition();
      if (!position) {
        feedbackError();
        showAlert('error', 'GPS unavailable - enable location services');
        return;
      }

      // Create marker on map with ad-hoc session ID
      const result = await logProductLocation({
        scanning_session_id: adHocSessionId,
        raw_lat: position.latitude,
        raw_lng: position.longitude,
        accuracy: position.accuracy,
        scanned_by: userDisplayName,
        product_type: barcode, // Use barcode as product_type for ad-hoc
        sub_inventory: 'Ad-hoc Scan',
      });

      if (!result.success) {
        feedbackError();
        console.error('Map marker error:', result.error);
        showAlert('error', `Failed to create map marker: ${result.error instanceof Error ? result.error.message : JSON.stringify(result.error)}`);
        return;
      }

      feedbackSuccess();
      showAlert('success', `Marked on map: ${barcode}`);
      onScan(barcode);
      setInputValue('');

      // Refresh map to show new marker
      queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });

      // Don't auto-close, let user scan multiple items
    } catch (err) {
      feedbackError();
      showAlert('error', err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFogOfWarScan = async (barcode: string) => {
    setIsProcessing(true);

    try {
      // Search inventory for matching item
      const result = await findMatchingItemsInInventory(barcode);

      if (result.type === 'not_found') {
        feedbackError();
        showAlert('error', `Not in inventory: ${barcode}`);
        return;
      }

      // Check if it's a model-only match (ambiguous)
      if (result.matchedField === 'model' && result.type === 'multiple') {
        feedbackError();
        showAlert(
          'error',
          `Model scan requires session context - found ${result.items?.length || 0} matching items. Use Sessions to scan models.`,
          5000
        );
        return;
      }

      // If we get here, we have a unique serial or CSO match
      const item = result.items?.[0];
      if (!item) {
        feedbackError();
        showAlert('error', 'Item data missing');
        return;
      }

      // Get or create permanent fog-of-war session
      const { sessionId: fogSessionId, error: sessionError } = await getOrCreateFogOfWarSession();
      if (!fogSessionId || sessionError) {
        feedbackError();
        console.error('Fog of war session error:', sessionError);
        showAlert('error', 'Failed to get fog of war session');
        return;
      }

      // Capture GPS position
      const position = await getCurrentPosition();
      if (!position) {
        feedbackError();
        showAlert('error', 'GPS unavailable - enable location services');
        return;
      }

      // Update/create marker for this item
      const logResult = await logProductLocation({
        product_id: item.products?.id ?? item.product_fk,
        inventory_item_id: item.id,
        scanning_session_id: fogSessionId,
        raw_lat: position.latitude,
        raw_lng: position.longitude,
        accuracy: position.accuracy,
        scanned_by: userDisplayName,
        product_type: item.product_type,
        sub_inventory: item.sub_inventory ?? undefined,
      });

      if (!logResult.success) {
        feedbackError();
        console.error('Map marker error:', logResult.error);
        showAlert('error', `Failed to update map marker: ${logResult.error instanceof Error ? logResult.error.message : JSON.stringify(logResult.error)}`);
        return;
      }

      feedbackSuccess();
      showAlert(
        'success',
        `Updated: ${item.product_type} (${result.matchedField?.toUpperCase()})`
      );
      onScan(barcode);
      setInputValue('');

      // Refresh map to show updated marker
      queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });

      // Don't auto-close, let user scan multiple items
    } catch (err) {
      feedbackError();
      showAlert('error', err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyboardScan = async () => {
    if (!inputValue.trim() || isProcessing) return;

    feedbackScanDetected();
    const barcode = inputValue.trim();

    if (mode === 'ad-hoc') {
      await handleAdHocScan(barcode);
    } else {
      await handleFogOfWarScan(barcode);
    }
  };

  const handleCameraScan = (code: string) => {
    setCameraOpen(false);
    setInputValue(code);
    // Auto-submit camera scans
    if (mode === 'ad-hoc') {
      handleAdHocScan(code);
    } else {
      handleFogOfWarScan(code);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setSessionsOpen(false);
    onClose();
    // Navigate to session (this will be handled by parent)
    window.location.hash = `#session/${sessionId}`;
  };

  // If camera is open, render camera scanner
  if (cameraOpen) {
    return (
      <BarcodeScanner
        onScan={handleCameraScan}
        onClose={() => setCameraOpen(false)}
        inventoryType={title}
      />
    );
  }

  // Otherwise, render keyboard input mode
  return (
    <OverlayPortal>
      <div className={`fixed inset-0 bg-background/20 backdrop-blur-md flex flex-col ${uiLayers.toolOverlay}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="font-semibold">
                    {mode === 'ad-hoc' ? 'Ad-hoc' : 'Fog of War'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setMode('ad-hoc')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Ad-hoc Mode</span>
                    <span className="text-xs text-muted-foreground">
                      Scan anything, plot on map
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode('fog-of-war')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Fog of War</span>
                    <span className="text-xs text-muted-foreground">
                      Validate & update inventory
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSessionsOpen(true)}
            className="gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Sessions</span>
          </Button>
        </div>

        {/* Alert */}
        {alert && (
          <div className="p-4">
            <Alert variant={alert.type === 'error' ? 'destructive' : 'default'} className="bg-background/95 backdrop-blur-sm">
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="w-full max-w-md space-y-4 bg-background/95 backdrop-blur-sm rounded-lg p-6 shadow-lg">
            <div className="text-center text-muted-foreground mb-6">
              <Scan className="h-12 w-12 mx-auto mb-3" />
              <p className="mb-2">
                {mode === 'ad-hoc'
                  ? 'Scan anything and plot GPS marker on map'
                  : 'Scan items in inventory to update positions'}
              </p>
              {mode === 'fog-of-war' && (
                <p className="text-xs text-muted-foreground">
                  Serial/CSO scans only - models require session context
                </p>
              )}
            </div>

            <div className="relative">
              <Scan className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                inputMode="none"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleKeyboardScan();
                  }
                }}
                placeholder="Scan barcode here..."
                className="pl-10 h-14 text-base font-mono"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={isProcessing}
              />
              {isProcessing && (
                <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-primary" />
              )}
            </div>

            <Button
              onClick={handleKeyboardScan}
              className="w-full h-12"
              disabled={!inputValue.trim() || isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Submit Scan'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setCameraOpen(true)}
              className="w-full h-12 gap-2"
              disabled={isProcessing}
            >
              <ScanBarcode className="h-5 w-5" />
              Use Camera Scanner
            </Button>
          </div>
        </div>
      </div>

      {/* Sessions List Sheet */}
      <Sheet open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Open Sessions</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(80vh-80px)]">
            {sessionSummariesQuery.isLoading && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading sessions...
              </div>
            )}
            {openSessions.length === 0 && !sessionSummariesQuery.isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                No open sessions
              </div>
            )}
            {openSessions.map(session => (
              <Button
                key={session.id}
                variant="outline"
                className="w-full h-auto py-4 justify-between"
                onClick={() => handleSessionSelect(session.id)}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-semibold">{session.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {session.inventoryType} • {session.subInventory || 'All'}
                  </span>
                </div>
                <Badge variant="outline">
                  {session.scannedCount} / {session.totalItems}
                </Badge>
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </OverlayPortal>
  );
}
