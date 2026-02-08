import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PartsInventoryTab } from '@/components/Inventory/PartsInventoryTab';
import { PartsHistoryTab } from '@/components/Inventory/PartsHistoryTab';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { Search, ClipboardList, History } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type PartsTab = 'inventory' | 'history';

interface PartsViewProps {
  onMenuClick?: () => void;
  partsTab?: string | null;
}

export function PartsView({ onMenuClick, partsTab: partsTabProp }: PartsViewProps) {
  const isMobile = useIsMobile();
  const getInitialTab = (): PartsTab => {
    // Try path-based parameter first
    if (partsTabProp) {
      const normalized = partsTabProp.toLowerCase();
      if (normalized === 'history' || normalized === 'inventory') {
        return normalized as PartsTab;
      }
    }

    // Fall back to query param for backward compatibility
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'history') {
      return tab;
    }
    return 'inventory';
  };

  const getInitialStatus = (): 'all' | 'reorder' => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    return status === 'reorder' ? 'reorder' : 'all';
  };

  const [searchInput, setSearchInput] = useState('');
  const [partsTab, setPartsTab] = useState<PartsTab>(getInitialTab);
  const [partsStatus, setPartsStatus] = useState<'all' | 'reorder'>(getInitialStatus);

  // Keep tabs in sync with URL changes - support path-based URLs
  useEffect(() => {
    const syncFromUrl = () => {
      // Try path-based first: /parts/history
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      const pathTab = pathSegments[1]; // /parts/:tab
      const nextTab = pathTab === 'history' ? 'history' : 'inventory';

      // Status stays as query param
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const nextStatus = status === 'reorder' ? 'reorder' : 'all';

      setPartsTab(prev => (prev === nextTab ? prev : nextTab));
      setPartsStatus(prev => (prev === nextStatus ? prev : nextStatus));
    };

    syncFromUrl();
    const handleChange = () => syncFromUrl();
    window.addEventListener('app:locationchange', handleChange);
    window.addEventListener('popstate', handleChange);
    return () => {
      window.removeEventListener('app:locationchange', handleChange);
      window.removeEventListener('popstate', handleChange);
    };
  }, []);

  // Clear status filter when leaving inventory tab
  useEffect(() => {
    if (partsTab !== 'inventory' && partsStatus !== 'all') {
      setPartsStatus('all');
    }
  }, [partsTab, partsStatus]);

  // Update URL when filters change - use path-based URLs for tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Build path-based URL for tab
    let basePath = '/parts';
    if (partsTab !== 'inventory') {
      basePath = `/parts/${partsTab}`;
    }

    // Keep status as query param
    if (partsStatus !== 'all') {
      params.set('status', partsStatus);
    } else {
      params.delete('status');
    }

    // Remove legacy tab query param
    params.delete('tab');

    const query = params.toString();
    const newUrl = query ? `${basePath}?${query}` : basePath;

    // Only update if URL changed
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
      window.dispatchEvent(new Event('app:locationchange'));
    }
  }, [partsTab, partsStatus]);

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader
          title="Parts"
          onMenuClick={onMenuClick}
        />
      )}

      {/* Search */}
      <div className="border-b">
        <PageContainer className="py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search parts by model, description, or brand…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </PageContainer>
      </div>

      {/* Parts Tabs */}
      <PageContainer className="py-4 pb-24">
        <Tabs value={partsTab} onValueChange={(v) => setPartsTab(v as PartsTab)}>
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="inventory">
              <ClipboardList className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory">
            <PartsInventoryTab searchTerm={searchInput} statusFilter={partsStatus} />
          </TabsContent>

          <TabsContent value="history">
            <PartsHistoryTab />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
}
