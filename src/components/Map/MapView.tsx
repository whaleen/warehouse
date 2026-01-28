/**
 * Map View - Fog of War visualization
 *
 * Displays product scan positions on a 2D coordinate grid.
 * Each product rendered as colored dot based on load group.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/Layout/PageContainer';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { Loader2, MapPin } from 'lucide-react';
import { getProductLocations, getGenesisPoint } from '@/lib/mapManager';
import type { ProductLocationForMap, GenesisPoint } from '@/types/map';
import { WarehouseMap } from './WarehouseMap';

interface MapViewProps {
  onMenuClick?: () => void;
}

export function MapView({ onMenuClick }: MapViewProps) {
  const [locations, setLocations] = useState<ProductLocationForMap[]>([]);
  const [genesis, setGenesis] = useState<GenesisPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [locationsResult, genesisResult] = await Promise.all([
        getProductLocations(),
        getGenesisPoint(),
      ]);

      if (locationsResult.error) {
        throw new Error(locationsResult.error.message);
      }

      if (genesisResult.error && genesisResult.error.code !== 'PGRST116') {
        throw new Error(genesisResult.error.message);
      }

      setLocations(locationsResult.data);
      setGenesis(genesisResult.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Warehouse Map"
        onMenuClick={onMenuClick}
      />

      <PageContainer className="py-2 sm:py-6 space-y-2 sm:space-y-6">
        {/* Stats Card - Compact on mobile */}
        <Card className="p-2 sm:p-3">
          <div className="flex items-center justify-between sm:grid sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="flex items-baseline gap-1">
              <div className="text-base sm:text-2xl font-semibold">{locations.length}</div>
              <div className="text-[9px] sm:text-xs text-muted-foreground">scans</div>
            </div>
            <div className="flex items-baseline gap-1">
              <div className="text-base sm:text-2xl font-semibold">
                {new Set(locations.map((l) => l.sub_inventory).filter(Boolean)).size}
              </div>
              <div className="text-[9px] sm:text-xs text-muted-foreground">orders</div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground mb-0.5 sm:mb-1">
                Genesis Point
              </div>
              <div className="text-xs sm:text-sm font-mono">
                {genesis ? (
                  <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Set
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">Not Set</Badge>
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-1 sm:block">
              <div className="text-base sm:text-2xl font-semibold">
                {locations.length > 0
                  ? Math.round(
                      (locations
                        .filter((l) => l.accuracy)
                        .reduce((sum, l) => sum + (l.accuracy || 0), 0) /
                        locations.filter((l) => l.accuracy).length) * 3.28084
                    ) + 'ft'
                  : '—'}
              </div>
              <div className="text-[9px] sm:hidden text-muted-foreground">±</div>
              <div className="hidden sm:block text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground mb-0.5 sm:mb-1">
                Avg Accuracy
              </div>
            </div>
          </div>
        </Card>

        {/* Map */}
        {loading && (
          <Card className="p-6 sm:p-12 flex flex-col items-center justify-center gap-2 sm:gap-3">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
            <p className="text-sm sm:text-base text-muted-foreground">Loading map data...</p>
          </Card>
        )}

        {error && !loading && (
          <Card className="p-3 sm:p-6 border-destructive/50 bg-destructive/10">
            <p className="text-sm sm:text-base text-destructive">{error}</p>
          </Card>
        )}

        {!loading && !error && !genesis && (
          <Card className="p-6 sm:p-12 text-center">
            <MapPin className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 text-muted-foreground" />
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No Genesis Point</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Scan your first item to establish the coordinate origin.
            </p>
          </Card>
        )}

        {!loading && !error && genesis && (
          <Card className="p-0 overflow-hidden bg-background border-border">
            <WarehouseMap locations={locations} genesis={genesis} />
          </Card>
        )}

        {/* Legend - Hidden on mobile, shown on desktop */}
        {!loading && locations.length > 0 && (
          <Card className="hidden sm:block p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground mb-2 sm:mb-3">
              Order Groups
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {Array.from(new Set(locations.map((l) => l.sub_inventory).filter(Boolean))).map(
                (loadName) => {
                  const color =
                    locations.find((l) => l.sub_inventory === loadName)?.load_color || '#94a3b8';
                  return (
                    <Badge key={loadName} variant="outline" className="gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                      <div
                        className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {loadName}
                    </Badge>
                  );
                }
              )}
            </div>
          </Card>
        )}
      </PageContainer>
    </div>
  );
}
