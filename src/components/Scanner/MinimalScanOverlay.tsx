import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ScanBarcode, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OverlayPortal } from '@/components/Layout/OverlayPortal';
import { uiLayers } from '@/lib/uiLayers';

interface MinimalScanOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onOpenCamera: () => void;
  isProcessing: boolean;
  alert: { type: 'success' | 'error'; message: string } | null;
}

type InputMode = 'scanner' | 'keyboard';

export function MinimalScanOverlay({
  isOpen,
  onClose,
  onScan,
  onOpenCamera,
  isProcessing,
  alert,
}: MinimalScanOverlayProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('scanner');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!inputValue.trim() || isProcessing) return;
    onScan(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      {/* Backdrop - click to close */}
      <div
        className={`fixed inset-0 ${uiLayers.toolOverlay}`}
        onClick={onClose}
      />

      {/* Centered scan input */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none ${uiLayers.toolOverlay}`}>
        <div className="w-full max-w-md px-4 pointer-events-auto">
          <div
            className="bg-background/95 backdrop-blur-sm rounded-lg shadow-2xl border p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input with mode toggle */}
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                inputMode={inputMode === 'scanner' ? 'none' : 'text'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputMode === 'scanner' ? 'Scan barcode here...' : 'Type barcode...'}
                className="h-12 text-base font-mono pr-20"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={isProcessing}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setInputMode(prev => prev === 'scanner' ? 'keyboard' : 'scanner');
                      inputRef.current?.focus();
                    }}
                    title={inputMode === 'scanner' ? 'Switch to keyboard input' : 'Switch to scanner input'}
                  >
                    {inputMode === 'scanner' ? (
                      <Keyboard className="h-4 w-4" />
                    ) : (
                      <Keyboard className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Alert */}
            {alert && (
              <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
                <AlertDescription className="text-sm">{alert.message}</AlertDescription>
              </Alert>
            )}

            {/* Camera option */}
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 border-t" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenCamera}
                disabled={isProcessing}
                className="gap-2 text-xs"
              >
                <ScanBarcode className="h-4 w-4" />
                Use Camera Instead
              </Button>
              <div className="flex-1 border-t" />
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
