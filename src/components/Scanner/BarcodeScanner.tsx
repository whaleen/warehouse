import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, ScanBarcode, Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inventoryType?: string;
}

type ScanSize = 'small' | 'medium' | 'large';
type Orientation = 'horizontal' | 'vertical';

const SCAN_BOXES = {
  horizontal: {
    small: { width: 200, height: 80 },
    medium: { width: 300, height: 100 },
    large: { width: 400, height: 120 },
  },
  vertical: {
    small: { width: 80, height: 200 },
    medium: { width: 100, height: 300 },
    large: { width: 120, height: 400 },
  },
};

export function BarcodeScanner({ onScan, onClose, inventoryType }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanSize, setScanSize] = useState<ScanSize>('medium');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [scanQueue, setScanQueue] = useState<string[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>('');

  // Initialize scanner
  useEffect(() => {
    const scannerId = 'barcode-scanner-region';
    let mounted = true;
    let cleanup: (() => Promise<void>) | null = null;

    const initScanner = async () => {
      // Clean up existing scanner and wait for it to complete
      const existingScanner = scannerRef.current;
      if (existingScanner) {
        try {
          const isScanning = existingScanner.getState() === 2; // 2 = SCANNING
          if (isScanning) {
            await existingScanner.stop();
          }
          existingScanner.clear();
        } catch (err) {
          console.error('Cleanup error:', err);
        }
        scannerRef.current = null;
      }

      // Clear any leftover video elements manually
      const element = document.getElementById(scannerId);
      if (element) {
        element.innerHTML = '';
      }

      // Wait longer to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!mounted) return;

      if (!element) {
        if (mounted) setError('Scanner element not found');
        return;
      }

      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        const box = SCAN_BOXES[orientation][scanSize];

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: box,
          },
          (decodedText) => {
            if (mounted) {
              // Add to queue if not already scanned
              if (decodedText !== lastScannedRef.current) {
                lastScannedRef.current = decodedText;
                setScanQueue(prev => {
                  // Prevent duplicates
                  if (prev.includes(decodedText)) return prev;
                  return [...prev, decodedText];
                });
              }
            }
          },
          () => {
            // Scan errors are normal
          }
        );

        if (mounted) setError(null);

        // Set up cleanup function
        cleanup = async () => {
          const isScanning = scanner.getState() === 2;
          if (isScanning) {
            await scanner.stop();
          }
          scanner.clear();
          scannerRef.current = null;
        };
      } catch (err) {
        if (mounted) {
          setError(`Camera error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    };

    initScanner();

    return () => {
      mounted = false;
      if (cleanup) {
        cleanup().catch(console.error);
      } else if (scannerRef.current) {
        const scanner = scannerRef.current;
        const cleanupPromise = (async () => {
          try {
            const isScanning = scanner.getState() === 2;
            if (isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch (err) {
            console.error('Cleanup error:', err);
          }
        })();
        cleanupPromise.catch(console.error);
      }
    };
  }, [orientation, scanSize]);

  const handleSubmitScan = (code: string) => {
    onScan(code);
    // Remove from queue after submitting
    setScanQueue(prev => prev.filter(c => c !== code));
    lastScannedRef.current = '';
  };

  const handleClearQueue = () => {
    setScanQueue([]);
    lastScannedRef.current = '';
  };

  const cycleScanSize = () => {
    setScanSize(prev => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'small';
    });
  };

  const toggleOrientation = () => {
    setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="h-6 w-6" />
        </Button>
        <div className="text-white text-lg font-semibold">
          {inventoryType || 'Scan Barcode'}
        </div>
        <div className="w-10" />
      </div>

      {/* Scanner or Error */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>
              {error}
              <div className="mt-3">
                <Button variant="outline" onClick={onClose} className="w-full">
                  Close & Use Manual Entry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <div id="barcode-scanner-region" className="w-full" />
            <div className="text-white/70 text-sm text-center">
              {scanQueue.length > 0
                ? `${scanQueue.length} barcode${scanQueue.length > 1 ? 's' : ''} detected`
                : 'Align barcode in frame'}
            </div>
          </div>
        )}
      </div>

      {/* Controls and Queue */}
      {!error && (
        <div className="p-4 space-y-3 flex flex-col">
          {/* Scan Queue - scrollable */}
          {scanQueue.length > 0 && (
            <div className="max-h-[30vh] overflow-y-auto space-y-2 -mx-4 px-4">
              {scanQueue.map((code, idx) => (
                <Button
                  key={idx}
                  onClick={() => handleSubmitScan(code)}
                  className="w-full justify-between h-auto py-3 px-4"
                  variant="default"
                >
                  <span className="font-mono text-sm truncate">{code}</span>
                  <ScanBarcode className="h-4 w-4 ml-2 shrink-0" />
                </Button>
              ))}
            </div>
          )}

          {/* Clear queue button */}
          {scanQueue.length > 1 && (
            <Button
              variant="outline"
              onClick={handleClearQueue}
              className="w-full text-white border-white/20 hover:bg-white/10"
            >
              Clear All ({scanQueue.length})
            </Button>
          )}

          {/* Size and orientation controls */}
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={cycleScanSize}
              className="flex-1 text-white border-white/20 hover:bg-white/10"
            >
              {scanSize === 'small' ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
              Size: {scanSize}
            </Button>
            <Button
              variant="outline"
              onClick={toggleOrientation}
              className="flex-1 text-white border-white/20 hover:bg-white/10"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              {orientation}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
