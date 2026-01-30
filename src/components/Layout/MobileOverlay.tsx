import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface MobileOverlayProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
  showHeader?: boolean;
}

export function MobileOverlay({ title, children, onClose, actions, showHeader = true }: MobileOverlayProps) {
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {showHeader && (
        <header className="sticky top-0 border-b bg-background px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1 text-center mx-2 truncate">
            {title}
          </h1>
          <div className="shrink-0 w-10">
            {actions}
          </div>
        </header>
      )}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
