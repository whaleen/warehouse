import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Keyboard } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  inventoryType?: string;
}

export function BarcodeScanner({ onScan, onClose, inventoryType }: BarcodeScannerProps) {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initScanner = async () => {
      if (!scannerRef.current) return;

      const html5QrCode = new Html5Qrcode('barcode-scanner-region');
      setScanner(html5QrCode);

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            formatsToSupport: [
              // @ts-expect-error - html5-qrcode types are incomplete
              window.Html5QrcodeSupportedFormats?.CODE_128,
              // @ts-expect-error - html5-qrcode types are incomplete
              window.Html5QrcodeSupportedFormats?.CODE_39,
              // @ts-expect-error - html5-qrcode types are incomplete
              window.Html5QrcodeSupportedFormats?.EAN_13,
              // @ts-expect-error - html5-qrcode types are incomplete
              window.Html5QrcodeSupportedFormats?.UPC_A
            ]
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
  }, []);

  const handleManualSubmit = () => {
    if (manualValue.trim()) {
      onScan(manualValue.trim());
      setManualValue('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent z-10 p-4">
        <div className="flex items-center justify-between text-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="text-lg font-semibold">{inventoryType || 'Scan Barcode'}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setManualEntry(!manualEntry)}
            className="text-white hover:bg-white/20"
          >
            <Keyboard className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Scanner Region */}
      {!manualEntry && (
        <div className="flex items-center justify-center h-full">
          <div id="barcode-scanner-region" ref={scannerRef} className="w-full max-w-md" />
        </div>
      )}

      {/* Manual Entry */}
      {manualEntry && (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Manual Entry</h3>
            <p className="text-sm text-gray-600">
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

      {/* Instructions */}
      {!manualEntry && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-center text-white">
          <p className="text-sm">Point camera at barcode on label</p>
          <p className="text-xs text-white/70 mt-2">
            Scanning: Serial, CSO, or Model Number
          </p>
        </div>
      )}
    </div>
  );
}
