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
}

export function PartsView({ onMenuClick }: PartsViewProps) {
  const isMobile = useIsMobile();
  const getInitialTab = (): PartsTab => {
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

  // Keep tabs in sync with URL changes
  useEffect(() => {
    const syncFromParams = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const nextTab = tab === 'history' ? 'history' : 'inventory';
      const status = params.get('status');
      const nextStatus = status === 'reorder' ? 'reorder' : 'all';

      setPartsTab(prev => (prev === nextTab ? prev : nextTab));
      setPartsStatus(prev => (prev === nextStatus ? prev : nextStatus));
    };

    syncFromParams();
    const handleChange = () => syncFromParams();
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

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (partsTab !== 'inventory') {
      params.set('tab', partsTab);
    } else {
      params.delete('tab');
    }

    if (partsStatus !== 'all') {
      params.set('status', partsStatus);
    } else {
      params.delete('status');
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new Event('app:locationchange'));
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
