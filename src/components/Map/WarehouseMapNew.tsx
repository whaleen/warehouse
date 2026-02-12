/**
 * Warehouse Map - mapcn/MapLibre version
 *
 * Fog of war visualization using actual GPS coordinates.
 * Blank canvas - markers themselves create the map.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapComponent, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, MapControls, mapDefaultStyles, type MapRef } from '@/components/ui/map';
import { Button } from '@/components/ui/button';
import { Package, Pencil, ScanLine, Trash2, X, Layers, MoreVertical } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDeleteProductLocation, useClearAllScans, useDeleteSessionScans, useInventoryItemCount, useInventoryScanCounts } from '@/hooks/queries/useMap';
import { useIsMobile } from '@/hooks/use-mobile';
import { getCurrentPosition, logProductLocation } from '@/lib/mapManager';
import { findItemOwningSession } from '@/lib/sessionScanner';
import { getOrCreateAdHocSession, getOrCreateFogOfWarSession } from '@/lib/sessionManager';
import { useSessionSummaries } from '@/hooks/queries/useSessions';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getActiveLocationContext } from '@/lib/tenant';
import { feedbackScanDetected, feedbackSuccess, feedbackError } from '@/lib/feedback';
import { MinimalScanOverlay } from '@/components/Scanner/MinimalScanOverlay';
import { BarcodeScanner } from '@/components/Scanner/BarcodeScanner';
import type { ProductLocationForMap } from '@/types/map';
import { useLoadMetadata, useSessionMetadata } from '@/hooks/queries/useMapMetadata';

interface WarehouseMapNewProps {
  locations: ProductLocationForMap[];
}

const VIEW_STATE_STORAGE_KEY = 'warehouse.map.viewState';
const ACTIVE_SESSION_STORAGE_KEY = 'warehouse.map.activeSession';

type SavedViewState = {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
};

export function WarehouseMapNew({ locations }: WarehouseMapNewProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();
  const userDisplayName = user?.username ?? user?.email ?? undefined;
  const sessionSummariesQuery = useSessionSummaries();
  const allSessions = useMemo(
    () => sessionSummariesQuery.data?.filter(s => s.status === 'active') ?? [],
    [sessionSummariesQuery.data]
  );

  const [mapInstance, setMapInstance] = useState<MapRef | null>(null);
  const [hiddenSessions, setHiddenSessions] = useState<Set<string>>(new Set());
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Scanner state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
  });
  const [scanOverlayOpen, setScanOverlayOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanAlert, setScanAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastScan, setLastScan] = useState<{
    status: 'success' | 'error';
    headline: string;
    title: string;
    subtitle?: string;
    badges?: string[];
  } | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Get active session details
  const activeSession = allSessions.find(s => s.id === activeSessionId);

  const deleteLocation = useDeleteProductLocation();
  const clearAllScans = useClearAllScans();
  const deleteSessionScans = useDeleteSessionScans();
  const inventoryItemCountQuery = useInventoryItemCount();
  const inventoryScanCountsQuery = useInventoryScanCounts();
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
  const getLocationGroupKey = useCallback((loc: ProductLocationForMap) => {
    if (loc.sub_inventory) return `load:${loc.sub_inventory}`;
    const bucket = loc.inventory_bucket || loc.inventory_type || 'unassigned';
    return `bucket:${bucket}`;
  }, []);

  const visibleLocations = useMemo(() => {
    return validLocations.filter(loc => {
      const groupKey = getLocationGroupKey(loc);
      return !hiddenSessions.has(groupKey);
    });
  }, [getLocationGroupKey, hiddenSessions, validLocations]);

  const totalScanCount = validLocations.length;
  const scannedInventoryItemCount = useMemo(() => {
    const ids = new Set(
      validLocations
        .map((loc) => loc.inventory_item_id)
        .filter(Boolean)
    );
    return ids.size;
  }, [validLocations]);
  const totalInventoryItemCount = inventoryItemCountQuery.data ?? 0;

  // Get current GPS position
  useEffect(() => {
    const updateLocation = async () => {
      const position = await getCurrentPosition();
      if (position) {
        setCurrentLocation({
          lat: position.latitude,
          lng: position.longitude,
        });
      }
    };

    // Get initial position
    updateLocation();

    // Update every 10 seconds
    const interval = setInterval(updateLocation, 10000);

    return () => clearInterval(interval);
  }, []);

  // Persist active session
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  const drawFogLayer = useCallback(() => {
    if (!mapInstance || !fogCanvasRef.current) return;
    const canvas = fogCanvasRef.current;
    const container = mapInstance.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const fogColor = isDark ? 'rgba(0, 0, 0, 0.98)' : 'rgba(226, 232, 240, 0.7)';

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = fogColor;
    ctx.fillRect(0, 0, width, height);

    const zoom = mapInstance.getZoom();
    const radius = Math.max(60, Math.min(160, zoom * 7));

    ctx.globalCompositeOperation = 'destination-out';
    for (const loc of visibleLocations) {
      if (loc.raw_lat == null || loc.raw_lng == null) continue;
      const point = mapInstance.project([loc.raw_lng, loc.raw_lat]);
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [mapInstance, visibleLocations]);

  useEffect(() => {
    drawFogLayer();
  }, [drawFogLayer]);

  useEffect(() => {
    if (!mapInstance) return;
    const handleRender = () => drawFogLayer();
    mapInstance.on('move', handleRender);
    mapInstance.on('zoom', handleRender);
    mapInstance.on('resize', handleRender);
    return () => {
      mapInstance.off('move', handleRender);
      mapInstance.off('zoom', handleRender);
      mapInstance.off('resize', handleRender);
    };
  }, [drawFogLayer, mapInstance]);

  const showScanAlert = (type: 'success' | 'error', message: string, duration = 3000) => {
    setScanAlert({ type, message });
    setTimeout(() => setScanAlert(null), duration);
  };

  const buildScanFeedback = (item: { model?: string | null; product_type?: string | null; serial?: string | null; cso?: string | null; sub_inventory?: string | null; inventory_bucket?: string | null; inventory_state?: string | null; inventory_type?: string | null }) => {
    const badges: string[] = [];
    const bucket = item.inventory_bucket || item.inventory_type;
    if (bucket) badges.push(bucket);
    if (item.inventory_state === 'staged') badges.push('Staged');

    const subInventory = item.sub_inventory ?? null;
    if (subInventory) {
      const loadMeta = loadMetadata.get(subInventory);
      badges.push(loadMeta?.friendly_name || subInventory);
    }

    const title = item.model || item.product_type || 'Item';
    const subtitle = item.serial
      ? `Serial ${item.serial}`
      : item.cso
        ? `CSO ${item.cso}`
        : undefined;

    return {
      status: 'success' as const,
      headline: 'Marked',
      title,
      subtitle,
      badges,
    };
  };

  const handleScan = async (barcode: string) => {
    if (!activeSessionId) {
      feedbackError();
      showScanAlert('error', 'No active session - select one first');
      return;
    }

    feedbackScanDetected();
    setIsProcessing(true);

    try {
      const position = await getCurrentPosition();
      if (!position) {
        feedbackError();
        showScanAlert('error', 'GPS unavailable');
        return;
      }

      // Check if this is a special session (ad-hoc or fog-of-war)
      const isAdHoc = activeSession?.name === '🧪 Ad-hoc Scans';
      const isFogOfWar = activeSession?.name === '🗺️ Fog of War';

      const result = await findItemOwningSession(barcode);

      if (result.type === 'not_found') {
        if (isAdHoc) {
          feedbackError();
          showScanAlert('error', 'Not in inventory');
          return;
        }

        feedbackError();
        showScanAlert('error', 'Not in inventory');
        return;
      }

      if (result.type === 'multiple') {
        feedbackError();
        showScanAlert('error', 'Multiple matches found - use load context', 5000);
        return;
      }

      const { item } = result;

      if (isAdHoc) {
        const logResult = await logProductLocation({
          product_id: item.products?.id ?? item.product_fk,
          inventory_item_id: item.id,
          serial: item.serial ?? item.ge_serial ?? undefined,
          raw_lat: position.latitude,
          raw_lng: position.longitude,
          accuracy: position.accuracy,
          scanned_by: userDisplayName,
          product_type: item.product_type,
          sub_inventory: item.sub_inventory ?? undefined,
        });

        if (!logResult.success) {
          feedbackError();
          showScanAlert('error', `Failed: ${logResult.error instanceof Error ? logResult.error.message : 'Unknown error'}`);
          return;
        }

        feedbackSuccess();
        setLastScan(buildScanFeedback(item));
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
        return;
      }

      if (isFogOfWar) {
        const logResult = await logProductLocation({
          product_id: item.products?.id ?? item.product_fk,
          inventory_item_id: item.id,
          serial: item.serial ?? item.ge_serial ?? undefined,
          raw_lat: position.latitude,
          raw_lng: position.longitude,
          accuracy: position.accuracy,
          scanned_by: userDisplayName,
          product_type: item.product_type,
          sub_inventory: item.sub_inventory ?? undefined,
        });

        if (!logResult.success) {
          feedbackError();
          showScanAlert('error', `Failed: ${logResult.error instanceof Error ? logResult.error.message : 'Unknown error'}`);
          return;
        }

        feedbackSuccess();
        setLastScan(buildScanFeedback(item));
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
        return;
      }
    } catch (err) {
      feedbackError();
      const message = err instanceof Error ? err.message : 'Scan failed';
      showScanAlert('error', message);
      console.error('Scan failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraScan = (code: string) => {
    setCameraOpen(false);
    handleScan(code);
  };

  const handleActivateAdHoc = useCallback(async () => {
    const { sessionId, error } = await getOrCreateAdHocSession();
    if (sessionId) {
      setActiveSessionId(sessionId);
    } else {
      console.error('Failed to create ad-hoc session:', error);
    }
  }, []);

  const handleActivateFogOfWar = useCallback(async () => {
    const { sessionId, error } = await getOrCreateFogOfWarSession();
    if (sessionId) {
      setActiveSessionId(sessionId);
    } else {
      console.error('Failed to create fog-of-war session:', error);
    }
  }, []);

  // Auto-activate Fog of War if no session is active
  useEffect(() => {
    if (!activeSessionId && !sessionSummariesQuery.isLoading) {
      handleActivateFogOfWar();
    }
  }, [activeSessionId, sessionSummariesQuery.isLoading, handleActivateFogOfWar]);

  const sessionIds = useMemo(
    () => [] as string[],
    []
  );
  const loadNames = useMemo(
    () =>
      Array.from(
        new Set(
          validLocations
            .map(loc => loc.sub_inventory)
            .filter(Boolean)
        )
      ) as string[],
    [validLocations]
  );
  const sessionMetadataQuery = useSessionMetadata(sessionIds);
  const loadMetadataQuery = useLoadMetadata(loadNames);
  const sessionMetadata = useMemo(
    () => sessionMetadataQuery.data ?? new Map(),
    [sessionMetadataQuery.data]
  );
  const loadMetadata = useMemo(
    () => loadMetadataQuery.data ?? new Map(),
    [loadMetadataQuery.data]
  );

  // Group locations by session for legend
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; color: string; count: number; subInventory: string | null; locationIds: string[]; inventoryBucket: string | null }>();

    validLocations.forEach(loc => {
      const groupKey = getLocationGroupKey(loc);
      const subInventory = loc.sub_inventory ?? null;
      const load = subInventory ? loadMetadata.get(subInventory) : null;
      const friendlyName = load?.friendly_name;
      const csoLast4 = load?.ge_cso ? load.ge_cso.slice(-4) : null;
      const color = loc.load_color || '#94a3b8';

      let displayName = 'Unassigned';
      if (subInventory) {
        displayName = friendlyName || subInventory;
        if (csoLast4) {
          displayName = `${displayName} · ${csoLast4}`;
        }
      } else if (groupKey.startsWith('session:')) {
        const sessionId = groupKey.replace('session:', '');
        const session = sessionMetadata.get(sessionId);
        displayName = session?.name || sessionId.slice(0, 8);
      }

      const inventoryBucket = loc.inventory_bucket || loc.inventory_type || null;
      if (!subInventory && !groupKey.startsWith('session:') && inventoryBucket) {
        displayName = inventoryBucket;
      }
      const existing = groups.get(groupKey);
      if (existing) {
        existing.count += 1;
        existing.locationIds.push(loc.id);
        if (!existing.inventoryBucket && inventoryBucket) {
          existing.inventoryBucket = inventoryBucket;
        }
      } else {
        groups.set(groupKey, {
          key: groupKey,
          name: displayName,
          color,
          count: 1,
          subInventory,
          locationIds: [loc.id],
          inventoryBucket,
        });
      }
    });

    return Array.from(groups.values());
  }, [getLocationGroupKey, loadMetadata, sessionMetadata, validLocations]);

  const toggleSessionVisibility = (groupKey: string) => {
    setHiddenSessions(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const scanMode = activeSession?.name === '🧪 Ad-hoc Scans' ? 'adhoc' : 'fog';

  const mapStyles = useMemo(
    () => mapDefaultStyles,
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

  const handleRequestClearAllScans = () => {
    if (clearAllScans.isPending || totalScanCount === 0) return;
    setClearAllConfirmOpen(true);
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
        zoom={19}
        minZoom={10}
        maxZoom={24}
        styles={mapStyles}
      >
        <MapControls
          position="top-left"
          showZoom={!isMobile}
          showCompass
          showLocate
          showFullscreen={!isMobile}
        >
        </MapControls>
        {visibleLocations.map((location) => (
            <MapMarker
              key={location.id}
              longitude={location.raw_lng!}
              latitude={location.raw_lat!}
            >
              <MarkerContent>
                <div className="cursor-pointer">
                  {/* Items in a load (ASIS or sold) - use vibrant load_color */}
                  {location.sub_inventory ? (
                    <div
                      className="size-4 rounded-full border-2 border-white shadow-lg hover:scale-125 transition-transform"
                      style={{ backgroundColor: location.load_color || '#ef4444' }}
                    />
                  ) : /* Non-load items - bucket pill marker */ (
                    <div
                      className="h-5 rounded-md border-2 border-white shadow-lg text-[9px] font-semibold tracking-tight hover:scale-110 transition-transform px-2 flex items-center text-slate-900"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        backgroundImage: location.inventory_bucket === 'FG'
                          ? 'repeating-linear-gradient(45deg, rgba(100,116,139,0.4) 0, rgba(100,116,139,0.4) 0.7px, transparent 0.7px, transparent 3px), repeating-linear-gradient(-45deg, rgba(100,116,139,0.4) 0, rgba(100,116,139,0.4) 0.7px, transparent 0.7px, transparent 3px)'
                          : location.inventory_bucket === 'ASIS'
                            ? 'radial-gradient(circle, rgba(100,116,139,0.4) 0.8px, transparent 0.8px)'
                            : undefined,
                        backgroundSize: location.inventory_bucket === 'ASIS' ? '4px 4px' : undefined,
                      }}
                    >
                      {location.inventory_bucket === 'FG' ? 'FG' :
                       location.inventory_bucket === 'BackHaul' ? 'BH' :
                       location.inventory_bucket === 'Inbound' ? 'IN' :
                       location.inventory_bucket === 'ASIS' ? 'AS' :
                       location.inventory_bucket?.substring(0, 2) ||
                       location.inventory_type?.substring(0, 2) || '?'}
                    </div>
                  )}
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
                    {(location.inventory_bucket || location.inventory_state) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {location.inventory_bucket && (
                          <Badge variant="outline" className="text-[10px]">
                            {location.inventory_bucket}
                          </Badge>
                        )}
                        {location.inventory_state === 'staged' && (
                          <Badge variant="secondary" className="text-[10px]">
                            Staged
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {location.sub_inventory && (() => {
                  const load = loadMetadata.get(location.sub_inventory);
                  return load ? (
                    <div className="mt-3 rounded-sm border border-border/60 bg-muted/30 p-2 space-y-2">
                      {/* Load Info */}
                      <div className="space-y-1">
                        <div
                          className="inline-flex items-center gap-2 px-2 py-1 rounded-sm border shadow-sm"
                          style={{ borderColor: location.load_color || '#ef4444' }}
                        >
                          <div
                            className="h-4 w-4 rounded-sm"
                            style={{ backgroundColor: location.load_color || '#ef4444' }}
                          />
                          <div
                            className="h-4 w-px"
                            style={{ backgroundColor: location.load_color || '#ef4444' }}
                          />
                          <span className="font-medium text-sm">
                            {load.friendly_name || load.sub_inventory_name}
                          </span>
                          {load.ge_cso && (
                            <>
                              <div
                                className="h-4 w-px"
                                style={{ backgroundColor: location.load_color || '#ef4444' }}
                              />
                              <span className="text-sm font-medium">
                                {load.ge_cso.slice(-4)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Status & CSO */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {load.ge_source_status && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {load.ge_source_status}
                            </Badge>
                          )}
                        </div>

                        {/* Item count & scan progress */}
                        <div className="text-xs text-muted-foreground">
                          {load.items_total_count ? (
                            <span>
                              {load.items_scanned_count || 0}/{load.items_total_count} scanned
                              {load.scanning_complete && ' ✓'}
                            </span>
                          ) : load.ge_units ? (
                            <span>{load.ge_units} items</span>
                          ) : null}
                        </div>

                        {/* Prep status indicators */}
                        <div className="flex items-center gap-1.5 text-xs pt-1">
                          {/* Wrapped */}
                          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                            load.prep_wrapped
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-muted-foreground'
                          }`}>
                            {load.prep_wrapped ? '✓' : '○'} W
                          </div>

                          {/* Tagged */}
                          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                            load.prep_tagged
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-muted-foreground'
                          }`}>
                            {load.prep_tagged ? '✓' : '○'} T
                          </div>

                          {/* Sanity check */}
                          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                            load.sanity_check_completed_at
                              ? 'text-green-700 dark:text-green-400'
                              : load.sanity_check_requested
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-muted-foreground'
                          }`}>
                            {load.sanity_check_completed_at ? '✓' : load.sanity_check_requested ? '!' : '○'} S
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className=""
                        onClick={() => {
                          const path = `/loads/${encodeURIComponent(location.sub_inventory!)}`;
                          const params = new URLSearchParams(window.location.search);
                          params.set('from', 'map');
                          const nextUrl = params.toString() ? `${path}?${params.toString()}` : path;
                          window.history.replaceState({}, '', nextUrl);
                          window.dispatchEvent(new Event('app:locationchange'));
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <span className="text-xs font-medium text-muted-foreground">
                        {location.load_friendly_name || location.sub_inventory}
                      </span>
                    </div>
                  );
                })()}

                {location.created_at && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Scanned: {new Date(location.created_at).toLocaleString()}
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

        {/* Current Location Marker */}
        {currentLocation && (
          <MapMarker
            longitude={currentLocation.lng}
            latitude={currentLocation.lat}
          >
            <MarkerContent>
              <div className="relative">
                {/* Pulsing outer ring */}
                <div className="absolute inset-0 -m-2 rounded-full bg-blue-500/30 animate-ping" />
                {/* Inner dot */}
                <div className="relative size-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              </div>
            </MarkerContent>
            <MarkerTooltip>
              <div className="text-xs font-semibold">Your Location</div>
            </MarkerTooltip>
          </MapMarker>
        )}
      </MapComponent>

      <canvas
        ref={fogCanvasRef}
        className="absolute inset-0 pointer-events-none z-[1]"
        aria-hidden="true"
      />


      {/* Inventory button */}
      <div className="absolute bottom-10 left-4 z-10">
        <Button
          type="button"
          variant="outline"
          className="h-14 w-14 p-0 shadow-lg bg-background/95 backdrop-blur-sm border border-border"
          onClick={() => setInventoryDrawerOpen(true)}
          aria-label="Open inventory"
        >
          <Layers className="h-5 w-5" />
        </Button>

        <Drawer open={inventoryDrawerOpen} onOpenChange={setInventoryDrawerOpen} direction="left">
          <DrawerContent className="h-full">
            <div className="flex h-full flex-col">
              <DrawerHeader className="border-b pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DrawerTitle>Inventory</DrawerTitle>
                  </div>
                  <DrawerClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label="Close inventory"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </DrawerClose>
                </div>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-6">
                  <div className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/60 via-background/80 to-transparent px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 rounded-full border border-border/60 bg-muted/60 overflow-hidden">
                          <div className="absolute inset-0 rounded-full border border-border/40" />
                          <div className="absolute inset-1 rounded-full border border-border/40" />
                          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(148,163,184,0.5),rgba(148,163,184,0)_45%,rgba(148,163,184,0)_100%)] animate-[spin_3s_linear_infinite]" />
                          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.35)_0,rgba(148,163,184,0.12)_45%,transparent_70%)]" />
                          <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.6)]" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">Fog of War</div>
                          <div className="text-sm font-medium text-foreground">All scans, live coverage</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Coverage</div>
                        <div className="text-base font-semibold tabular-nums text-foreground">
                          {scannedInventoryItemCount}/{totalInventoryItemCount || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">Loads</div>

                      {sessionGroups.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No scans yet.</div>
                      ) : (
                        <div className="space-y-1">
                          {sessionGroups.filter(group => group.subInventory).map((group) => {
                            const isHidden = hiddenSessions.has(group.key);
                            return (
                              <div key={group.key} className="flex items-center gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0 rounded px-2 py-2">
                                  {group.subInventory ? (
                                    <div
                                      className="flex items-center gap-2 px-2 py-1 rounded-sm border shadow-sm min-w-0"
                                      style={{
                                        borderColor: group.color || '#ef4444',
                                        opacity: isHidden ? 0.3 : 1,
                                      }}
                                    >
                                      <div
                                        className="h-4 w-4 rounded-sm shrink-0"
                                        style={{ backgroundColor: group.color || '#ef4444' }}
                                      />
                                      <div
                                        className="h-4 w-px"
                                        style={{ backgroundColor: group.color || '#ef4444' }}
                                      />
                                      <span className="truncate text-sm font-medium">
                                        {group.name}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      className="h-8 w-8 rounded-sm shrink-0 border-2 border-border shadow-sm bg-gray-500 text-white flex items-center justify-center text-[10px] font-semibold"
                                      style={{ opacity: isHidden ? 0.3 : 1 }}
                                    >
                                      {group.inventoryBucket === 'FG' ? 'FG' :
                                       group.inventoryBucket === 'BackHaul' ? 'BH' :
                                       group.inventoryBucket === 'Inbound' ? 'IN' :
                                       group.inventoryBucket === 'ASIS' ? 'AS' :
                                       group.inventoryBucket?.substring(0, 2) || '?'}
                                    </div>
                                  )}
                                <span className={`truncate flex-1 text-left text-sm ${isHidden ? 'opacity-40 line-through' : ''}`}>
                                  {!group.subInventory ? group.name : ''}
                                </span>
                                {(() => {
                                  const loadMeta = group.subInventory ? loadMetadata.get(group.subInventory) : null;
                                  const status = loadMeta?.ge_source_status?.toLowerCase();
                                  if (!status) return null;
                                  const label = status.includes('sold') ? 'Sold' : status.includes('for sale') ? 'For sale' : null;
                                  if (!label) return null;
                                  return (
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                      {label}
                                    </Badge>
                                  );
                                })()}
                                <span className={`shrink-0 text-sm font-semibold tabular-nums tracking-[0.08em] text-foreground ${isHidden ? 'opacity-40' : ''}`}>
                                  {(() => {
                                    if (!inventoryScanCountsQuery.data) return group.count;
                                    if (group.subInventory) {
                            const key = `load:${group.subInventory}`;
                            const scanned = inventoryScanCountsQuery.data.scannedByKey.get(key) ?? 0;
                            const total = inventoryScanCountsQuery.data.totalByKey.get(key) ?? 0;
                            return `${scanned}/${total}`;
                          }
                          if (group.inventoryBucket) {
                            const key = `bucket:${group.inventoryBucket}`;
                            const total = inventoryScanCountsQuery.data.totalByKey.get(key);
                            if (typeof total === 'number') {
                              return `${group.count}/${total}`;
                            }
                          }
                          return group.count;
                        })()}
                                </span>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => toggleSessionVisibility(group.key)}>
                                    {isHidden ? 'Show' : 'Hide'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const path = `/loads/${encodeURIComponent(group.subInventory ?? '')}`;
                                      const params = new URLSearchParams(window.location.search);
                                      params.set('from', 'map');
                                      const nextUrl = params.toString() ? `${path}?${params.toString()}` : path;
                                      window.history.replaceState({}, '', nextUrl);
                                      window.dispatchEvent(new Event('app:locationchange'));
                                    }}
                                  >
                                    Manage load
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (deleteSessionScans.isPending) return;
                                      if (confirm(`Delete ${group.count} scans from "${group.name}"?`)) {
                                        deleteSessionScans.mutate(group.locationIds);
                                      }
                                    }}
                                  >
                                    {deleteSessionScans.isPending ? 'Deleting…' : 'Delete scans'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {sessionGroups.some(group => !group.subInventory) && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">Buckets</div>
                      <div className="space-y-1">
                        {sessionGroups.filter(group => !group.subInventory).map((group) => {
                          const isHidden = hiddenSessions.has(group.key);
                          return (
                            <div key={group.key} className="flex items-center gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0 rounded px-2 py-2">
                                <div
                                  className="flex items-center gap-2 px-2 py-1 rounded-sm border shadow-sm min-w-0"
                                  style={{
                                    opacity: isHidden ? 0.3 : 1,
                                    backgroundImage: group.inventoryBucket === 'FG'
                                      ? 'repeating-linear-gradient(45deg, rgba(100,116,139,0.4) 0, rgba(100,116,139,0.4) 0.7px, transparent 0.7px, transparent 3px), repeating-linear-gradient(-45deg, rgba(100,116,139,0.4) 0, rgba(100,116,139,0.4) 0.7px, transparent 0.7px, transparent 3px)'
                                      : group.inventoryBucket === 'ASIS'
                                        ? 'radial-gradient(circle, rgba(100,116,139,0.4) 0.8px, transparent 0.8px)'
                                        : undefined,
                                    backgroundSize: group.inventoryBucket === 'ASIS' ? '4px 4px' : undefined,
                                  }}
                                >
                                  <div
                                    className="h-4 w-4 rounded-sm shrink-0 bg-gray-500 text-white flex items-center justify-center text-[9px] font-semibold"
                                  >
                                    {group.inventoryBucket === 'FG' ? 'FG' :
                                     group.inventoryBucket === 'BackHaul' ? 'BH' :
                                     group.inventoryBucket === 'Inbound' ? 'IN' :
                                     group.inventoryBucket === 'ASIS' ? 'AS' :
                                     group.inventoryBucket?.substring(0, 2) || '?'}
                                  </div>
                                  <div className="h-4 w-px bg-gray-400" />
                                  <span className="truncate text-sm font-medium">
                                    {group.name}
                                  </span>
                                </div>
                                <span className={`truncate flex-1 text-left text-sm ${isHidden ? 'opacity-40 line-through' : ''}`}>
                                  {' '}
                                </span>
                                <span className={`shrink-0 text-sm font-semibold tabular-nums tracking-[0.08em] text-foreground ${isHidden ? 'opacity-40' : ''}`}>
                                  {(() => {
                                    if (!inventoryScanCountsQuery.data) return group.count;
                                    if (group.inventoryBucket) {
                                      const key = `bucket:${group.inventoryBucket}`;
                                      const total = inventoryScanCountsQuery.data.totalByKey.get(key);
                                      if (typeof total === 'number') {
                                        return `${group.count}/${total}`;
                                      }
                                    }
                                    return group.count;
                                  })()}
                              </span>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toggleSessionVisibility(group.key)}>
                                  {isHidden ? 'Show' : 'Hide'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={handleRequestClearAllScans}
                      disabled={clearAllScans.isPending || totalScanCount === 0}
                    >
                      {clearAllScans.isPending ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Clear All Scans
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>


      {/* Scanner controls */}
      <div className="absolute bottom-10 right-4 z-10 flex gap-2">
        {/* Keyboard scan button */}
        <Button
          variant="outline"
          className="h-14 gap-2 shadow-lg bg-background/95 backdrop-blur-sm border border-border"
          onClick={() => setScanOverlayOpen((prev) => !prev)}
        >
          <ScanLine className="h-5 w-5" />
          Scan
        </Button>
      </div>

      {/* Minimal scan overlay */}
      <MinimalScanOverlay
        isOpen={scanOverlayOpen}
        onClose={() => setScanOverlayOpen(false)}
        onScan={handleScan}
        onOpenCamera={() => {
          setScanOverlayOpen(false);
          setCameraOpen(true);
        }}
        isProcessing={isProcessing}
        alert={scanAlert}
        feedback={lastScan}
        mode={scanMode}
        onSelectFog={handleActivateFogOfWar}
        onSelectAdHoc={handleActivateAdHoc}
      />

      {/* Camera scanner */}
      {cameraOpen && (
        <BarcodeScanner
          onScan={handleCameraScan}
          onClose={() => setCameraOpen(false)}
          inventoryType={activeSession?.name || 'Quick Scan'}
        />
      )}

      <ConfirmDialog
        open={clearAllConfirmOpen}
        onOpenChange={setClearAllConfirmOpen}
        title="Clear all scans?"
        description="This removes all GPS scans from the map. This cannot be undone."
        confirmText={clearAllScans.isPending ? 'Clearing...' : 'Clear all'}
        cancelText="Cancel"
        destructive
        onConfirm={() => {
          if (clearAllScans.isPending) return;
          clearAllScans.mutate();
        }}
      />
    </div>
  );
}
