import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ScanBarcode, Keyboard, ScanLine } from 'lucide-react';
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
  feedback?: {
    status: 'success' | 'error';
    headline: string;
    title: string;
    subtitle?: string;
    badges?: string[];
  } | null;
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
  feedback,
  mode = 'fog',
  onSelectFog,
  onSelectAdHoc,
}: MinimalScanOverlayProps) {
  const [inputMode, setInputMode] = useState<InputMode>('scanner');
  const [manualValue, setManualValue] = useState(''); // Only for keyboard mode
  const [displayValue, setDisplayValue] = useState(''); // Only for scanner mode display

  // Hidden input for scanner mode - NEVER re-renders, completely isolated
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  // Visible input for keyboard mode
  const visibleInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus appropriate input when opened
  useEffect(() => {
    if (!isOpen) {
      // Clear everything when closing
      setManualValue('');
      setDisplayValue('');
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = '';
      }
      return;
    }

    // Focus the appropriate input based on mode
    const timer = setTimeout(() => {
      if (inputMode === 'scanner') {
        hiddenInputRef.current?.focus();
      } else {
        visibleInputRef.current?.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, inputMode]);

  // Update display value as user types in hidden input (scanner mode only)
  const handleHiddenInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Only update display, don't trigger any other state changes
    setDisplayValue(e.target.value);
  }, []);

  const submitValue = useCallback(() => {
    // Read from appropriate source
    const rawValue = inputMode === 'scanner'
      ? hiddenInputRef.current?.value || ''
      : manualValue;

    if (!rawValue.trim()) return;

    const sanitized = inputMode === 'scanner'
      ? rawValue.trim().replace(/[^A-Za-z0-9]/g, '')
      : rawValue.trim();

    if (!sanitized) return;

    onScan(sanitized);

    // Clear inputs
    if (inputMode === 'scanner' && hiddenInputRef.current) {
      hiddenInputRef.current.value = '';
      setDisplayValue('');
    } else {
      setManualValue('');
    }

    // Auto-switch back to scanner mode after successful manual entry
    if (inputMode === 'keyboard') {
      setTimeout(() => {
        setInputMode('scanner');
        setTimeout(() => hiddenInputRef.current?.focus(), 50);
      }, 500);
    }
  }, [inputMode, manualValue, onScan]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitValue();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [submitValue, onClose]);

  const toggleInputMode = useCallback(() => {
    setInputMode(prev => {
      const newMode = prev === 'scanner' ? 'keyboard' : 'scanner';

      // Sync values when switching
      if (newMode === 'keyboard') {
        // Scanner → Keyboard: copy hidden input to manual input
        setManualValue(hiddenInputRef.current?.value || '');
      } else {
        // Keyboard → Scanner: copy manual input to hidden input
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = manualValue;
          setDisplayValue(manualValue);
        }
      }

      // Focus appropriate input after mode switch
      setTimeout(() => {
        if (newMode === 'scanner') {
          hiddenInputRef.current?.focus();
        } else {
          visibleInputRef.current?.focus();
        }
      }, 0);

      return newMode;
    });
  }, [manualValue]);

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
            {/* Scanner Mode: Hidden input + Read-only display */}
            {inputMode === 'scanner' && (
              <div className="relative">
                {/* Hidden input - captures scanner, never re-renders */}
                <input
                  ref={hiddenInputRef}
                  type="text"
                  onChange={handleHiddenInputChange}
                  onKeyDown={handleKeyDown}
                  className="absolute opacity-0 pointer-events-none"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  tabIndex={-1}
                />

                {/* Read-only display showing accumulated value */}
                <div className="relative">
                  <div className="h-12 text-base font-mono px-3 flex items-center border-2 border-blue-500 rounded-md bg-blue-50 dark:bg-blue-950/20">
                    <ScanLine className="h-4 w-4 text-blue-500 mr-2 animate-pulse" />
                    <span className="flex-1 text-foreground">
                      {displayValue || <span className="text-muted-foreground">Scan barcode here...</span>}
                    </span>
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleInputMode}
                        title="Switch to keyboard input"
                      >
                        <Keyboard className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                {feedback && (
                  <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                      {feedback.headline}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {feedback.title}
                    </div>
                    {feedback.subtitle && (
                      <div className="text-xs text-muted-foreground mt-0.5">{feedback.subtitle}</div>
                    )}
                    {feedback.badges && feedback.badges.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {feedback.badges.map((badge) => (
                          <Badge key={badge} variant="outline" className="text-[10px]">
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Keyboard Mode: Normal editable input */}
            {inputMode === 'keyboard' && (
              <div className="relative">
                <Input
                  ref={visibleInputRef}
                  type="text"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type barcode manually..."
                  className="h-12 text-base font-mono pr-20 border-2 border-green-500 focus-visible:ring-green-500"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={toggleInputMode}
                      title="Switch to scanner input"
                    >
                      <ScanLine className="h-4 w-4 text-green-500" />
                    </Button>
                  )}
                </div>
                {feedback && (
                  <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-green-600 dark:text-green-300">
                      {feedback.headline}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {feedback.title}
                    </div>
                    {feedback.subtitle && (
                      <div className="text-xs text-muted-foreground mt-0.5">{feedback.subtitle}</div>
                    )}
                    {feedback.badges && feedback.badges.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {feedback.badges.map((badge) => (
                          <Badge key={badge} variant="outline" className="text-[10px]">
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Alert */}
            {alert && (
              <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
                <AlertDescription className="text-sm">{alert.message}</AlertDescription>
              </Alert>
            )}

            {/* Mode indicator and camera option */}
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 border-t" />
              <div className="text-xs text-muted-foreground px-2">
                {inputMode === 'scanner' ? '📷 Scanner Mode' : '⌨️ Keyboard Mode'}
              </div>
              <div className="flex-1 border-t" />
            </div>
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenCamera}
                className="gap-2 text-xs"
              >
                <ScanBarcode className="h-4 w-4" />
                Use Camera Instead
              </Button>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
