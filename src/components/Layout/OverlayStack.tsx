import { ScannerOverlay } from '@/components/Scanner/ScannerOverlay';

export function OverlayStack() {
  return (
    <div id="overlay-root" className="relative z-[40]">
      <ScannerOverlay />
    </div>
  );
}
