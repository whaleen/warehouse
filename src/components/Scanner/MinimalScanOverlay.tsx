import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useCallback } from 'react';
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
  feedbackText?: string;
  mode?: 'fog' | 'adhoc';
  onSelectFog?: () => void;
  onSelectAdHoc?: () => void;
}

type InputMode = 'scanner' | 'keyboard';

export function MinimalScanOverlay({
  isOpen,
  onClose,
  onScan,
  onOpenCamera,
  isProcessing,
  alert,
  feedbackText,
  mode = 'fog',
  onSelectFog,
  onSelectAdHoc,
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

  const submitValue = useCallback((value: string) => {
    if (!value.trim() || isProcessing) return;
    const sanitized = inputMode === 'scanner'
      ? value.trim().replace(/[^A-Za-z0-9]/g, '')
      : value.trim();
    if (!sanitized) return;
    onScan(sanitized);
    setInputValue('');
  }, [inputMode, isProcessing, onScan]);

  const handleSubmit = () => {
    submitValue(inputValue);
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

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 pointer-events-auto ${uiLayers.toolOverlay}`}>
        <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur-sm p-1 shadow-lg">
          <Button
            type="button"
            size="sm"
            variant={mode === 'fog' ? 'secondary' : 'ghost'}
            className="h-8 rounded-full px-3"
            onClick={onSelectFog}
          >
            Fog of War
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'adhoc' ? 'secondary' : 'ghost'}
            className="h-8 rounded-full px-3"
            onClick={onSelectAdHoc}
          >
            Ad-hoc
          </Button>
        </div>
      </div>

      {/* Centered scan input */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none ${uiLayers.toolOverlay}`}>
        <div className="w-full max-w-md px-4 pointer-events-auto">
          <div
            className="bg-background/95 backdrop-blur-sm rounded-lg shadow-2xl border p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input with mode toggle */}
            <div className="relative">
              {feedbackText && (
                <div className="text-xs text-muted-foreground mb-2">{feedbackText}</div>
              )}
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
