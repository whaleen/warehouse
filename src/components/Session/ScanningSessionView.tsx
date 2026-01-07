import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { BarcodeScanner } from '@/components/Scanner/BarcodeScanner';
import { ItemSelectionDialog } from '@/components/Scanner/ItemSelectionDialog';
import { ScanBarcode, ArrowLeft, CheckCircle2, Circle, X } from 'lucide-react';
import type { InventoryItem } from '@/types/inventory';
import type { ScanningSession } from '@/types/session';
import {
  getActiveSession,
  markItemScannedInSession,
  markItemsScannedInSession,
  updateSession,
  clearActiveSession
} from '@/lib/sessionManager';
import { findMatchingItemsInSession } from '@/lib/sessionScanner';

interface ScanningSessionViewProps {
  onExit: () => void;
}

export function ScanningSessionView({ onExit }: ScanningSessionViewProps) {
  const [session, setSession] = useState<ScanningSession | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [matchedItems, setMatchedItems] = useState<InventoryItem[]>([]);
  const [matchedField, setMatchedField] = useState<'serial' | 'cso' | 'model'>('serial');
  const [scannedValue, setScannedValue] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load session from localStorage
  useEffect(() => {
    const activeSession = getActiveSession();
    if (activeSession) {
      setSession(activeSession);
    } else {
      onExit();
    }
  }, [onExit]);

  // Refresh session after scans
  const refreshSession = () => {
    const activeSession = getActiveSession();
    if (activeSession) {
      setSession(activeSession);
    }
  };

  // Handle barcode scan
  const handleScan = (barcode: string) => {
    setScannerOpen(false);
    setScannedValue(barcode);

    if (!session) return;

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
      // Auto-mark single item as scanned
      const success = markItemScannedInSession(session.id, result.items[0].id!);
      if (success) {
        setAlert({
          type: 'success',
          message: `Scanned: ${result.items[0].product_type} (${result.matchedField?.toUpperCase()})`
        });
        refreshSession();
      }
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    if (result.type === 'multiple' && result.items && result.matchedField) {
      // Show selection dialog
      setMatchedItems(result.items);
      setMatchedField(result.matchedField);
      setSelectionDialogOpen(true);
      return;
    }
  };

  // Handle multi-select confirmation
  const handleMultiSelectConfirm = (selectedIds: string[]) => {
    if (selectedIds.length === 0 || !session) return;

    const success = markItemsScannedInSession(session.id, selectedIds);
    if (success) {
      setAlert({
        type: 'success',
        message: `Marked ${selectedIds.length} items as scanned`
      });
      refreshSession();
    }
    setTimeout(() => setAlert(null), 3000);
  };

  // Handle session exit
  const handleExit = () => {
    if (window.confirm('Exit this scanning session? Progress will be saved.')) {
      onExit();
    }
  };

  // Calculate progress
  const progress = useMemo(() => {
    if (!session) return { total: 0, scanned: 0, percentage: 0 };
    const total = session.items.length;
    const scanned = session.scannedItemIds.length;
    const percentage = total > 0 ? (scanned / total) * 100 : 0;
    return { total, scanned, percentage };
  }, [session]);

  // Group items by scanned status
  const { scannedItems, unscannedItems } = useMemo(() => {
    if (!session) return { scannedItems: [], unscannedItems: [] };

    const scanned = session.items.filter(item => session.scannedItemIds.includes(item.id!));
    const unscanned = session.items.filter(item => !session.scannedItemIds.includes(item.id!));

    return { scannedItems: scanned, unscannedItems: unscanned };
  }, [session]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">No active session</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={handleExit}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">{session.name}</h1>
            <p className="text-sm text-gray-600">{session.inventoryType}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.confirm('End session and discard progress?')) {
                clearActiveSession();
                onExit();
              }
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">
              {progress.scanned} / {progress.total} scanned
            </span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className="px-4 pt-3">
          <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Item List */}
      <div className="p-4 pb-24">
        {/* Unscanned Items */}
        {unscannedItems.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Pending ({unscannedItems.length})
            </h2>
            <div className="space-y-2">
              {unscannedItems.map(item => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Circle className="h-5 w-5 text-gray-300" />
                        <span className="font-semibold text-gray-900">{item.product_type}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm ml-7">
                        <div>
                          <span className="text-gray-500">CSO:</span>{' '}
                          <span className="font-mono">{item.cso}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Serial:</span>{' '}
                          <span className="font-mono">{item.serial || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Model:</span>{' '}
                          <span className="font-mono text-xs">{item.model}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Scanned Items */}
        {scannedItems.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Scanned ({scannedItems.length})
            </h2>
            <div className="space-y-2">
              {scannedItems.map(item => (
                <Card key={item.id} className="p-4 bg-green-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-gray-900">{item.product_type}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm ml-7">
                        <div>
                          <span className="text-gray-500">CSO:</span>{' '}
                          <span className="font-mono">{item.cso}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Serial:</span>{' '}
                          <span className="font-mono">{item.serial || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Complete Message */}
        {progress.scanned === progress.total && progress.total > 0 && (
          <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Session Complete!
            </h3>
            <p className="text-sm text-green-700 mb-4">
              All {progress.total} items have been scanned
            </p>
            <Button onClick={handleExit}>Exit Session</Button>
          </div>
        )}
      </div>

      {/* Floating Scan Button */}
      {unscannedItems.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <Button
            size="lg"
            className="w-full h-14 text-lg font-semibold"
            onClick={() => setScannerOpen(true)}
          >
            <ScanBarcode className="h-6 w-6 mr-2" />
            Scan Barcode
          </Button>
        </div>
      )}

      {/* Scanner */}
      {scannerOpen && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setScannerOpen(false)}
          inventoryType={session.inventoryType}
        />
      )}

      {/* Selection Dialog */}
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
