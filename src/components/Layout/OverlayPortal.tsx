import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface OverlayPortalProps {
  children: ReactNode;
}

export function OverlayPortal({ children }: OverlayPortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById('overlay-root') ?? document.body);
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}
