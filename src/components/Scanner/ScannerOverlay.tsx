import { useMemo } from 'react';
import { QuickScanner } from '@/components/Scanner/QuickScanner';
import { useScannerOverlay } from '@/context/ScannerOverlayContext';

export function ScannerOverlay() {
  const { state, closeScanner } = useScannerOverlay();

  const handleScan = useMemo(() => {
    if (state.options.onScan) {
      return state.options.onScan;
    }

    return (code: string) => {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(code).catch(() => undefined);
      }
    };
  }, [state.options.onScan]);

  if (!state.open) return null;

  return (
    <QuickScanner
      onScan={handleScan}
      onClose={closeScanner}
      title={state.options.title ?? state.options.inventoryType ?? 'Quick Scan'}
    />
  );
}
