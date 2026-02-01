import { createContext, useContext, useMemo, useState } from 'react';

interface ScannerOverlayOptions {
  title?: string;
  inventoryType?: string;
  onScan?: (code: string) => void;
}

interface ScannerOverlayState {
  open: boolean;
  options: ScannerOverlayOptions;
}

interface ScannerOverlayContextValue {
  state: ScannerOverlayState;
  openScanner: (options?: ScannerOverlayOptions) => void;
  closeScanner: () => void;
}

const ScannerOverlayContext = createContext<ScannerOverlayContextValue | null>(null);

export function ScannerOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ScannerOverlayState>({
    open: false,
    options: {},
  });

  const value = useMemo<ScannerOverlayContextValue>(() => ({
    state,
    openScanner: (options = {}) => {
      setState({ open: true, options });
    },
    closeScanner: () => {
      setState({ open: false, options: {} });
    },
  }), [state]);

  return (
    <ScannerOverlayContext.Provider value={value}>
      {children}
    </ScannerOverlayContext.Provider>
  );
}

export function useScannerOverlay() {
  const ctx = useContext(ScannerOverlayContext);
  if (!ctx) {
    throw new Error('useScannerOverlay must be used within ScannerOverlayProvider');
  }
  return ctx;
}
