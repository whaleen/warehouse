/**
 * Map View - Fog of War visualization
 *
 * Displays product scan positions on a 2D coordinate grid.
 * Each product rendered as colored dot based on load group.
 */

import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { useProductLocations } from '@/hooks/queries/useMap';
import { WarehouseMapNew } from './WarehouseMapNew';
import { useIsMobile } from '@/hooks/use-mobile';
import { uiLayers } from '@/lib/uiLayers';

interface MapViewProps {
  onMenuClick?: () => void;
}

export function MapView({ onMenuClick }: MapViewProps) {
  const { data: locations, isLoading } = useProductLocations();
  const isMobile = useIsMobile();

  const LoadingState = () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  );

  // Mobile: Full-screen map without container constraints
  if (isMobile) {
    return (
      <div className={`fixed inset-0 bg-background ${uiLayers.page}`}>
        {isLoading ? <LoadingState /> : <WarehouseMapNew locations={locations ?? []} />}
      </div>
    );
  }

  // Desktop: Keep current in-page layout
  return (
    <div className="h-full min-h-0 bg-background flex flex-col">
      <AppHeader title="Warehouse Map" onMenuClick={onMenuClick} />
      <PageContainer className="flex-1 min-h-0 px-0 sm:px-0 lg:px-0 max-w-none">
        {isLoading ? <LoadingState /> : <WarehouseMapNew locations={locations ?? []} />}
      </PageContainer>
    </div>
  );
}
