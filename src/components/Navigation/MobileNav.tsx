import { useState, useEffect, useRef } from 'react';
import { Menu, X, ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useUiHandedness } from '@/hooks/useUiHandedness';
import { MobilePrimaryNav } from './MobilePrimaryNav';
import { MobileSecondaryNav } from './MobileSecondaryNav';
import type { AppView } from '@/App';

interface MobileNavProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

type NavSheet = 'closed' | 'primary' | 'secondary';

export function MobileNav({ currentView, onViewChange }: MobileNavProps) {
  const [activeSheet, setActiveSheet] = useState<NavSheet>('closed');
  const [fabVisible, setFabVisible] = useState(true);
  const lastScroll = useRef(0);
  const uiHandedness = useUiHandedness();

  // Scroll behavior: hide FAB on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;

      // Show FAB when near top or scrolling up
      if (currentScroll < 50 || currentScroll < lastScroll.current) {
        setFabVisible(true);
      } else {
        setFabVisible(false);
      }

      lastScroll.current = currentScroll;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleOpenPrimary = () => {
    setActiveSheet('primary');
  };

  const handleOpenSecondary = () => {
    setActiveSheet('secondary');
  };

  const handleBackToPrimary = () => {
    setActiveSheet('primary');
  };

  const handleNavigate = (view: AppView) => {
    onViewChange(view);
    setActiveSheet('closed');
  };

  const handleSheetClose = () => {
    setActiveSheet('closed');
  };

  // Determine FAB icon based on context
  const getFabIcon = () => {
    if (activeSheet !== 'closed') return X;
    if (currentView === 'create-session') return ScanBarcode;
    return Menu;
  };

  const FabIcon = getFabIcon();

  // Position FAB based on handedness
  const fabPositionClass = uiHandedness === 'left'
    ? 'left-4'
    : 'right-4';

  return (
    <>
      {/* Floating Action Button */}
      <Button
        size="lg"
        className={`
          fixed bottom-4 z-50 h-14 w-14 rounded-full shadow-lg
          transition-all duration-300
          ${fabPositionClass}
          ${fabVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}
        `}
        onClick={activeSheet === 'closed' ? handleOpenPrimary : handleSheetClose}
        aria-label={activeSheet === 'closed' ? 'Open navigation menu' : 'Close navigation menu'}
        aria-expanded={activeSheet !== 'closed'}
      >
        <FabIcon className="h-6 w-6" />
      </Button>

      {/* Primary Navigation Sheet */}
      <Sheet open={activeSheet === 'primary'} onOpenChange={handleSheetClose}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[85vh]"
          aria-describedby="primary-nav-description"
        >
          <div id="primary-nav-description" className="sr-only">
            Main navigation menu with quick access to scanner, dashboard, loads, and map
          </div>
          <MobilePrimaryNav
            currentView={currentView}
            onNavigate={handleNavigate}
            onOpenMore={handleOpenSecondary}
          />
        </SheetContent>
      </Sheet>

      {/* Secondary Navigation Sheet */}
      <Sheet open={activeSheet === 'secondary'} onOpenChange={handleSheetClose}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[85vh]"
          aria-describedby="secondary-nav-description"
        >
          <div id="secondary-nav-description" className="sr-only">
            Additional navigation options including inventory, settings, and data management
          </div>
          <MobileSecondaryNav
            currentView={currentView}
            onNavigate={handleNavigate}
            onBack={handleBackToPrimary}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
