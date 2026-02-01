import { MobileOverlay } from '@/components/Layout/MobileOverlay';
import { useProductLocations } from '@/hooks/queries/useMap';
import { WarehouseMapNew } from './WarehouseMapNew';

interface MapOverlayProps {
  onClose: () => void;
}

export function MapOverlay({ onClose }: MapOverlayProps) {
  const { data: locations } = useProductLocations();

  return (
    <MobileOverlay title="Warehouse Map" onClose={onClose} showHeader={false}>
      <WarehouseMapNew locations={locations ?? []} />
    </MobileOverlay>
  );
}
