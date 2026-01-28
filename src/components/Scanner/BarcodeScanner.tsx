import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Keyboard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inventoryType?: string;
}

type ScanSize = 'small' | 'medium' | 'large' | 'xl';

const SCAN_SIZES: Record<ScanSize, { width: number; height: number; label: string }> = {
  small: { width: 150, height: 150, label: 'Small' },
  medium: { width: 250, height: 250, label: 'Medium' },
  large: { width: 350, height: 350, label: 'Large' },
  xl: { width: 450, height: 250, label: 'XL' }
};

export function BarcodeScanner({ onScan, onClose, inventoryType }: BarcodeScannerProps) {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [scanSize, setScanSize] = useState<ScanSize>('medium');
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (manualEntry) return; // Don't start scanner in manual entry mode

    const initScanner = async () => {
      if (!scannerRef.current) return;

      const html5QrCode = new Html5Qrcode('barcode-scanner-region');
      setScanner(html5QrCode);

      const scanBox = SCAN_SIZES[scanSize];

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: scanBox.width, height: scanBox.height }
          },
          (decodedText) => {
            onScan(decodedText);
          },
          () => {
            // Scan error - ignore
          }
        );
        setIsScanning(true);
      } catch (err) {
        console.error('Failed to start scanner:', err);
        setManualEntry(true);
      }
    };

    initScanner();

    return () => {
      if (scanner && isScanning) {
        scanner
          .stop()
          .then(() => {
            scanner.clear();
          })
          .catch(console.error);
      }
    };
  }, [scanSize, manualEntry]);

  // Handle scan size change
  const handleScanSizeChange = async (newSize: ScanSize) => {
    if (!scanner || !isScanning) {
      setScanSize(newSize);
      return;
    }

    try {
      // Stop current scanner
      await scanner.stop();
      scanner.clear();
      setIsScanning(false);

      // Update size
      setScanSize(newSize);

      // Scanner will restart via useEffect
    } catch (err) {
      console.error('Error changing scan size:', err);
    }
  };

  const handleManualSubmit = () => {
    if (manualValue.trim()) {
      onScan(manualValue.trim());
      setManualValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-y-auto overscroll-contain">
      <div className="px-4 pt-4 pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-background/20"
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="text-lg font-semibold">{inventoryType || 'Scan Barcode'}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setManualEntry(!manualEntry)}
            className="text-white hover:bg-background/20"
          >
            <Keyboard className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {!manualEntry && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-6">
          <div className="hidden sm:flex">
            <Tabs value={scanSize} onValueChange={(value) => handleScanSizeChange(value as ScanSize)}>
              <TabsList className="bg-black/60 backdrop-blur-sm">
                {(Object.keys(SCAN_SIZES) as ScanSize[]).map((size) => (
                  <TabsTrigger
                    key={size}
                    value={size}
                    className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white"
                  >
                    {SCAN_SIZES[size].label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div id="barcode-scanner-region" ref={scannerRef} className="w-full max-w-md" />

          <div className="text-center text-white/90">
            <p className="text-sm">Point camera at barcode on label</p>
            <p className="hidden sm:block text-xs text-white/70 mt-1">
              Scanning: Serial, CSO, or Model Number
            </p>
          </div>
        </div>
      )}

      {manualEntry && (
        <div className="flex-1 flex items-start justify-center px-4 pb-6">
          <div className="bg-background text-foreground rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Manual Entry</h3>
            <p className="text-sm text-muted-foreground">
              Enter the barcode value manually if the camera cannot scan it.
            </p>
            <Input
              type="text"
              placeholder="Enter barcode..."
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleManualSubmit();
                }
              }}
              autoFocus
              className="text-lg"
            />
            <div className="flex gap-2">
              <Button onClick={handleManualSubmit} className="flex-1">
                Submit
              </Button>
              <Button
                variant="outline"
                onClick={() => setManualEntry(false)}
                className="flex-1"
              >
                Back to Camera
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
