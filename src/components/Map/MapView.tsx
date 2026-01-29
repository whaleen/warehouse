/**
 * Map View - Fog of War visualization
 *
 * Displays product scan positions on a 2D coordinate grid.
 * Each product rendered as colored dot based on load group.
 */

import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { useProductLocations } from '@/hooks/queries/useMap';
import { WarehouseMapNew } from './WarehouseMapNew';

interface MapViewProps {
  onMenuClick?: () => void;
}

export function MapView({ onMenuClick }: MapViewProps) {
  const { data: locations } = useProductLocations();

  return (
    <div className="h-full min-h-0 bg-background flex flex-col">
      <AppHeader title="Warehouse Map" onMenuClick={onMenuClick} />
      <PageContainer className="flex-1 min-h-0 px-0 sm:px-0 lg:px-0 max-w-none">
        <WarehouseMapNew locations={locations ?? []} />
      </PageContainer>
    </div>
  );
}
