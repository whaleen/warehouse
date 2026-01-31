import { PageContainer } from '@/components/Layout/PageContainer';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useUiHandedness } from '@/hooks/useUiHandedness';
import { NotificationBell } from '@/components/Navigation/NotificationBell';
import { useEffect, useState } from 'react';


interface AppHeaderProps {
  title: string;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
}

export function AppHeader({ title, actions, onMenuClick }: AppHeaderProps) {
  const uiHandedness = useUiHandedness();
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const alignRight = isDesktop && uiHandedness === 'right';

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background">
      <PageContainer className="py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            {isDesktop && !alignRight && (
              <SidebarTrigger className="shrink-0" onClick={onMenuClick} />
            )}
            <h1 className="text-xl font-semibold text-foreground truncate">{title}</h1>
            {isDesktop && alignRight && (
              <SidebarTrigger className="ml-auto shrink-0" onClick={onMenuClick} />
            )}
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            {isDesktop && <NotificationBell />}
            {actions && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-full pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {actions}
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
