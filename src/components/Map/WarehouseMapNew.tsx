/**
 * Warehouse Map - mapcn/MapLibre version
 *
 * Fog of war visualization using actual GPS coordinates.
 * Blank canvas - markers themselves create the map.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapComponent, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, MapControls, type MapRef } from '@/components/ui/map';
import { Button } from '@/components/ui/button';
import { Globe, Package, Pencil, ScanLine, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useDeleteProductLocation, useClearAllScans, useDeleteSessionScans } from '@/hooks/queries/useMap';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ProductLocationForMap } from '@/types/map';
import { blankMapStyle } from './BlankMapStyle';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';

interface WarehouseMapNewProps {
  locations: ProductLocationForMap[];
}

const WORLD_MAP_STORAGE_KEY = 'warehouse.map.showWorldMap';
const VIEW_STATE_STORAGE_KEY = 'warehouse.map.viewState';

type SavedViewState = {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
};

export function WarehouseMapNew({ locations }: WarehouseMapNewProps) {
  const isMobile = useIsMobile();
  const [mapInstance, setMapInstance] = useState<MapRef | null>(null);
  const [sessionMetadata, setSessionMetadata] = useState<Map<string, { name: string; created_at: string }>>(new Map());
  const [loadMetadata, setLoadMetadata] = useState<Map<string, { friendly_name: string | null; ge_cso: string | null }>>(new Map());
  const [hiddenSessions, setHiddenSessions] = useState<Set<string>>(new Set());
  const [legendExpanded, setLegendExpanded] = useState(() => !isMobile);
  const [showWorldMap, setShowWorldMap] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(WORLD_MAP_STORAGE_KEY) === 'true';
  });
  const deleteLocation = useDeleteProductLocation();
  const clearAllScans = useClearAllScans();
  const deleteSessionScans = useDeleteSessionScans();
  const savedView = useMemo<SavedViewState | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(VIEW_STATE_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SavedViewState;
      if (!parsed?.center || typeof parsed.zoom !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);
  const savedViewRef = useRef<SavedViewState | null>(savedView);
  const hasSavedViewRef = useRef(Boolean(savedView));
  const hasFitRef = useRef(false);

  // Calculate center point from all locations
  const { center } = useMemo(() => {
    if (locations.length === 0) {
      return {
        center: [-122.4194, 37.7749] as [number, number], // Default to SF
      };
    }

    // Find center by averaging all coordinates
    const lats = locations.map(l => l.raw_lat).filter(Boolean) as number[];
    const lngs = locations.map(l => l.raw_lng).filter(Boolean) as number[];

    if (lats.length === 0 || lngs.length === 0) {
      return {
        center: [-122.4194, 37.7749] as [number, number],
      };
    }

    const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const centerLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;

    return {
      center: [centerLng, centerLat] as [number, number],
    };
  }, [locations]);

  // Filter locations with valid GPS coordinates
  const validLocations = useMemo(() => {
    return locations.filter(l => l.raw_lat != null && l.raw_lng != null);
  }, [locations]);

  // Filter visible locations based on hidden sessions
  const visibleLocations = useMemo(() => {
    return validLocations.filter(loc => {
      const sessionId = loc.scanning_session_id || '';
      return !hiddenSessions.has(sessionId);
    });
  }, [validLocations, hiddenSessions]);

  const toggleSessionVisibility = (sessionId: string) => {
    setHiddenSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Fetch session and load metadata for legend
  useEffect(() => {
    const sessionIds = Array.from(new Set(
      validLocations
        .map(loc => loc.scanning_session_id)
        .filter(Boolean)
    )) as string[];

    const loadNames = Array.from(new Set(
      validLocations
        .map(loc => loc.sub_inventory)
        .filter(Boolean)
    )) as string[];

    const fetchMetadata = async () => {
      const { locationId } = getActiveLocationContext();

      // Fetch sessions
      if (sessionIds.length > 0) {
        const { data: sessionData } = await supabase
          .from('scanning_sessions')
          .select('id, name, created_at')
          .eq('location_id', locationId)
          .in('id', sessionIds);

        if (sessionData) {
          const metadata = new Map<string, { name: string; created_at: string }>();
          sessionData.forEach((session: { id: string; name: string; created_at: string }) => {
            metadata.set(session.id, {
              name: session.name,
              created_at: session.created_at,
            });
          });
          setSessionMetadata(metadata);
        }
      }

      // Fetch loads
      if (loadNames.length > 0) {
        const { data: loadData } = await supabase
          .from('load_metadata')
          .select('sub_inventory_name, friendly_name, ge_cso')
          .eq('location_id', locationId)
          .in('sub_inventory_name', loadNames);

        if (loadData) {
          const metadata = new Map<string, { friendly_name: string | null; ge_cso: string | null }>();
          loadData.forEach((load: { sub_inventory_name: string; friendly_name: string | null; ge_cso: string | null }) => {
            metadata.set(load.sub_inventory_name, {
              friendly_name: load.friendly_name,
              ge_cso: load.ge_cso,
            });
          });
          setLoadMetadata(metadata);
        }
      }
    };

    fetchMetadata();
  }, [validLocations]);

  // Group locations by session for legend
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, { sessionId: string; name: string; color: string; count: number; subInventory: string | null }>();
    let noSessionCount = 0;

    validLocations.forEach(loc => {
      const sessionId = loc.scanning_session_id;
      if (!sessionId) {
        noSessionCount++;
        return;
      }

      const session = sessionMetadata.get(sessionId);
      const sessionName = session?.name || sessionId.slice(0, 8);

      // Get load metadata for display
      const subInventory = loc.sub_inventory;
      const load = subInventory ? loadMetadata.get(subInventory) : null;
      const friendlyName = load?.friendly_name;
      const csoLast4 = load?.ge_cso ? load.ge_cso.slice(-4) : null;

      // Build display name: "Session Name - Friendly Name [1234]"
      let displayName = sessionName;
      if (friendlyName) {
        displayName += ` - ${friendlyName}`;
      }
      if (csoLast4) {
        displayName += ` [${csoLast4}]`;
      }

      const color = loc.load_color || '#94a3b8';

      if (groups.has(sessionId)) {
        groups.get(sessionId)!.count++;
      } else {
        groups.set(sessionId, { sessionId, name: displayName, color, count: 1, subInventory });
      }
    });

    const result = Array.from(groups.values());

    // Add "No Session" group at the end if there are orphaned scans
    if (noSessionCount > 0) {
      result.push({
        sessionId: '',
        name: 'No Session',
        color: '#64748b',
        count: noSessionCount,
        subInventory: null,
      });
    }

    return result;
  }, [validLocations, sessionMetadata, loadMetadata]);

  const mapStyles = useMemo(
    () => ({
      light: blankMapStyle(false),
      dark: blankMapStyle(true),
    }),
    []
  );

  useEffect(() => {
    const map = mapInstance;
    if (!map || validLocations.length === 0) return;
    if (hasFitRef.current) return;
    if (hasSavedViewRef.current) return;

    if (validLocations.length === 1) {
      const only = validLocations[0];
      map.flyTo({
        center: [only.raw_lng as number, only.raw_lat as number],
        zoom: 18,
        duration: 0,
      });
      return;
    }

    const bounds = validLocations.reduce(
      (acc, loc) => {
        const lat = loc.raw_lat as number;
        const lng = loc.raw_lng as number;
        return {
          minLat: Math.min(acc.minLat, lat),
          maxLat: Math.max(acc.maxLat, lat),
          minLng: Math.min(acc.minLng, lng),
          maxLng: Math.max(acc.maxLng, lng),
        };
      },
      {
        minLat: validLocations[0].raw_lat as number,
        maxLat: validLocations[0].raw_lat as number,
        minLng: validLocations[0].raw_lng as number,
        maxLng: validLocations[0].raw_lng as number,
      }
    );

    map.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      { padding: 48, maxZoom: 19, duration: 0 }
    );
    hasFitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validLocations]);

  useEffect(() => {
    if (validLocations.length === 0) {
      hasFitRef.current = false;
    }
  }, [validLocations.length]);

  const handleMapRef = useCallback((instance: MapRef | null) => {
    setMapInstance(instance);
  }, []);

  const handleClearAllScans = () => {
    if (!confirm('Clear all GPS scans from the map? This cannot be undone.')) return;
    clearAllScans.mutate();
  };

  useEffect(() => {
    const map = mapInstance;
    if (!map || typeof window === 'undefined') return;

    const applySavedView = () => {
      const parsed = savedViewRef.current;
      if (!parsed) return;
      map.jumpTo({
        center: parsed.center,
        zoom: parsed.zoom,
        bearing: parsed.bearing ?? 0,
        pitch: parsed.pitch ?? 0,
      });
      hasSavedViewRef.current = true;
    };

    if (savedViewRef.current) {
      if (map.isStyleLoaded()) {
        applySavedView();
      } else {
        map.once('load', applySavedView);
      }
    }

    const handleMoveEnd = () => {
      const center = map.getCenter();
      const viewState = {
        center: [center.lng, center.lat] as [number, number],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      window.localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(viewState));
      hasSavedViewRef.current = true;
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [mapInstance]);

  return (
    <div className="relative w-full h-full">
      <MapComponent
        ref={handleMapRef}
        center={center}
        zoom={19} // Start very zoomed in for warehouse-level detail
        minZoom={10} // Allow zooming out to see context
        maxZoom={24} // Allow extreme zoom for precision
        styles={showWorldMap ? undefined : mapStyles}
      >
        <MapControls
          position="top-right"
          showZoom
          showCompass
          showLocate
          showFullscreen
        />
        {visibleLocations.map((location) => (
          <MapMarker
            key={location.id}
            longitude={location.raw_lng!}
            latitude={location.raw_lat!}
          >
            <MarkerContent>
              <div className={isMobile ? "p-2 cursor-pointer" : "cursor-pointer"}>
                <div
                  className={
                    isMobile
                      ? "size-8 rounded-sm shadow-lg"
                      : "size-3 rounded-sm shadow-lg hover:scale-125 transition-transform"
                  }
                  style={{ backgroundColor: location.load_color || '#94a3b8' }}
                />
              </div>
            </MarkerContent>
            {!isMobile && (
              <MarkerTooltip className="px-2 py-1 text-xs font-medium">
                {location.model ?? 'Unknown'}
              </MarkerTooltip>
            )}
            <MarkerPopup className="p-3 min-w-[200px]">
              <div className="space-y-2">
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                    {location.image_url ? (
                      <img
                        src={location.image_url}
                        alt={location.model || location.product_type || 'Product'}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">
                      {location.model || location.product_type || 'Unknown'}
                    </p>
                    {location.serial && (
                      <p className="text-xs text-muted-foreground">
                        Serial: {location.serial}
                      </p>
                    )}
                  </div>
                </div>

                {(location.sub_inventory || location.load_friendly_name) && (
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <div
                      className="size-2 rounded-sm shrink-0"
                      style={{ backgroundColor: location.load_color || '#94a3b8' }}
                    />
                    <span className="text-xs font-medium">
                      {location.load_friendly_name || location.sub_inventory}
                    </span>
                    {location.sub_inventory && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          if (!location.sub_inventory) return;
                          const path = `/loads/${encodeURIComponent(location.sub_inventory)}`;
                          const params = new URLSearchParams(window.location.search);
                          params.set('from', 'map');
                          const nextUrl = params.toString() ? `${path}?${params.toString()}` : path;
                          window.history.replaceState({}, '', nextUrl);
                          window.dispatchEvent(new Event('app:locationchange'));
                        }}
                        aria-label="Edit load"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}

                {location.created_at && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Scanned: {new Date(location.created_at).toLocaleString()}
                  </p>
                )}

                {location.sub_inventory && (
                  <p className="text-xs text-muted-foreground">
                    Load ID: {location.sub_inventory}
                  </p>
                )}

                {location.sub_inventory && location.load_item_count != null && (
                  <p className="text-xs text-muted-foreground">
                    Load items: 1 / {location.load_item_count}
                  </p>
                )}

                {location.accuracy && (
                  <p className="text-xs text-muted-foreground">
                    GPS ±{Math.round(location.accuracy * 3.28084)}ft
                  </p>
                )}

                <div className="pt-2 border-t flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={deleteLocation.isPending}
                    onClick={() => {
                      if (deleteLocation.isPending) return;
                      deleteLocation.mutate(location.id);
                    }}
                    aria-label="Delete scan"
                  >
                    {deleteLocation.isPending ? (
                      <Spinner size="sm" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </MapComponent>

      {/* Scans count overlay */}
      <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg max-w-xs w-full sm:w-auto">
        {/* Always visible header */}
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Inventory</div>
              <div className="text-2xl font-bold">
                {visibleLocations.length}
                {hiddenSessions.size > 0 && (
                  <span className="text-sm text-muted-foreground ml-1">/ {validLocations.length}</span>
                )}
              </div>
              {validLocations.length !== locations.length && (
                <div className="text-xs text-amber-500">
                  {locations.length - validLocations.length} without GPS
                </div>
              )}
            </div>
            {sessionGroups.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setLegendExpanded(!legendExpanded)}
                aria-label={legendExpanded ? 'Collapse legend' : 'Expand legend'}
              >
                {legendExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible content */}
        {legendExpanded && (
          <>
            {/* Sessions Legend */}
            {sessionGroups.length > 0 && (
              <div className="px-3 pb-2 space-y-1.5 border-t pt-2">
                <div className="text-xs text-muted-foreground font-medium">Sessions (tap to toggle)</div>
                <div className={`space-y-1 overflow-y-auto ${isMobile ? 'max-h-[40vh]' : 'max-h-40'}`}>
                  {sessionGroups.map((group) => {
                    const isHidden = hiddenSessions.has(group.sessionId);
                    return (
                      <div key={group.sessionId} className="flex items-center gap-2 group">
                        <button
                          type="button"
                          className={`flex items-center gap-2 flex-1 min-w-0 hover:bg-accent/50 active:bg-accent rounded px-2 -mx-2 transition-colors ${isMobile ? 'py-2 min-h-[44px]' : 'py-1'}`}
                          onClick={() => toggleSessionVisibility(group.sessionId)}
                        >
                          <div
                            className={`rounded-sm shrink-0 transition-opacity ${isMobile ? 'size-4' : 'size-3'}`}
                            style={{
                              backgroundColor: group.color,
                              opacity: isHidden ? 0.3 : 1
                            }}
                          />
                          <span className={`truncate flex-1 min-w-0 text-left transition-opacity text-xs ${isHidden ? 'opacity-40 line-through' : ''}`}>
                            {group.name}
                          </span>
                          <span className={`text-muted-foreground shrink-0 transition-opacity text-xs ${isHidden ? 'opacity-40' : ''}`}>
                            ({group.count})
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isMobile ? 'h-8 w-8' : 'h-5 w-5'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${group.count} scans from "${group.name}"?`)) {
                              deleteSessionScans.mutate(group.sessionId);
                            }
                          }}
                          disabled={deleteSessionScans.isPending}
                          aria-label={`Delete session ${group.name}`}
                        >
                          {deleteSessionScans.isPending ? (
                            <Spinner size="sm" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 border-t p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`${isMobile ? 'h-10 w-10' : 'h-8 w-8'} ${showWorldMap ? '' : 'opacity-50'}`}
                onClick={() => {
                  setShowWorldMap((prev) => {
                    const next = !prev;
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(WORLD_MAP_STORAGE_KEY, String(next));
                    }
                    return next;
                  });
                }}
                aria-label="Toggle world map"
              >
                <Globe className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size={isMobile ? 'default' : 'sm'}
                className="flex-1"
                onClick={handleClearAllScans}
                disabled={clearAllScans.isPending || validLocations.length === 0}
                aria-label="Clear all scans"
              >
                {clearAllScans.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear All
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-4 right-4">
        <Button type="button" className="gap-2 shadow-lg">
          <ScanLine className="h-4 w-4" />
          Scan
        </Button>
      </div>
    </div>
  );
}
