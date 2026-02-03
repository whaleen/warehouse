import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ScanBarcode, Keyboard, ChevronDown, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OverlayPortal } from '@/components/Layout/OverlayPortal';
import { uiLayers } from '@/lib/uiLayers';

export interface SessionOption {
  id: string;
  name: string;
  isActive: boolean;
  isSpecial?: boolean;
  icon?: LucideIcon;
  details?: string;
  color?: string;
  showAsBox?: boolean;
  onClick: () => void;
}

interface MinimalScanOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onOpenCamera: () => void;
  isProcessing: boolean;
  alert: { type: 'success' | 'error'; message: string } | null;
  feedbackText?: string;
  activeSessionName?: string;
  activeSessionDisplayName?: string;
  activeSessionColor?: string;
  sessionOptions?: SessionOption[];
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
  activeSessionName,
  activeSessionDisplayName,
  activeSessionColor,
  sessionOptions = [],
}: MinimalScanOverlayProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('scanner');
  const [popoverOpen, setPopoverOpen] = useState(false);
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
      {/* Session selector at top */}
      {activeSessionName && sessionOptions.length > 0 && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 pointer-events-auto ${uiLayers.toolOverlay}`}>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 gap-2 bg-background/95 backdrop-blur-sm shadow-lg border"
              >
                {activeSessionColor && (
                  <div
                    className="size-3 rounded-sm shrink-0"
                    style={{ backgroundColor: activeSessionColor }}
                  />
                )}
                <span className="text-sm font-semibold">{activeSessionDisplayName || activeSessionName}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 max-h-[400px] overflow-y-auto">
              <div className="space-y-1">
                {sessionOptions.map((option, index) => (
                  <div key={option.id}>
                    {index > 0 && !option.isSpecial && sessionOptions[index - 1].isSpecial && (
                      <div className="border-t my-1" />
                    )}
                    {option.showAsBox ? (
                      // Box style (ASIS with color, FG without color)
                      <div
                        onClick={() => {
                          option.onClick();
                          setPopoverOpen(false);
                        }}
                        className="cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className={`inline-flex items-center rounded-md overflow-hidden border ${option.isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}>
                          {option.color && (
                            <div
                              className="size-6 shrink-0"
                              style={{ backgroundColor: option.color }}
                            />
                          )}
                          <span className="font-medium text-xs py-1 px-2 whitespace-nowrap">{option.name}</span>
                        </div>
                        {option.details && (
                          <span className="text-xs text-muted-foreground">{option.details}</span>
                        )}
                      </div>
                    ) : (
                      // Special sessions: standard button with icon
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          option.onClick();
                          setPopoverOpen(false);
                        }}
                        className={`w-full justify-start h-auto py-2 ${option.isActive ? 'bg-accent' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          {option.icon && <option.icon className="h-4 w-4 shrink-0" />}
                          <span className="font-medium text-sm">{option.name}</span>
                        </div>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

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
