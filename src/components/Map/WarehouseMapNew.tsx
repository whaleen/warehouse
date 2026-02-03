/**
 * Warehouse Map - mapcn/MapLibre version
 *
 * Fog of war visualization using actual GPS coordinates.
 * Blank canvas - markers themselves create the map.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapComponent, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, MapControls, type MapRef } from '@/components/ui/map';
import { Button } from '@/components/ui/button';
import { Globe, Package, Pencil, ScanLine, Trash2, X, Layers, Zap, Map as MapIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useDeleteProductLocation, useClearAllScans, useDeleteSessionScans } from '@/hooks/queries/useMap';
import { useIsMobile } from '@/hooks/use-mobile';
import { getCurrentPosition, logProductLocation } from '@/lib/mapManager';
import { findItemOwningSession } from '@/lib/sessionScanner';
import { getOrCreateAdHocSession, getOrCreateFogOfWarSession } from '@/lib/sessionManager';
import { useSessionDetail, useSessionSummaries, useUpdateSessionScannedItems } from '@/hooks/queries/useSessions';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getActiveLocationContext } from '@/lib/tenant';
import { feedbackScanDetected, feedbackSuccess, feedbackError } from '@/lib/feedback';
import { MinimalScanOverlay, type SessionOption } from '@/components/Scanner/MinimalScanOverlay';
import { BarcodeScanner } from '@/components/Scanner/BarcodeScanner';
import type { ProductLocationForMap } from '@/types/map';
import { blankMapStyle } from './BlankMapStyle';
import { useLoadMetadata, useSessionMetadata } from '@/hooks/queries/useMapMetadata';

interface WarehouseMapNewProps {
  locations: ProductLocationForMap[];
}

const WORLD_MAP_STORAGE_KEY = 'warehouse.map.showWorldMap';
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
  const [showWorldMap, setShowWorldMap] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(WORLD_MAP_STORAGE_KEY) === 'true';
  });
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
  const [scanFeedback, setScanFeedback] = useState('');

  // Get active session details
  const activeSession = allSessions.find(s => s.id === activeSessionId);
  const sessionDetailQuery = useSessionDetail(activeSessionId ?? '');
  const updateSessionMutation = useUpdateSessionScannedItems();

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

  const totalScanCount = validLocations.length;
  const visibleScanCount = visibleLocations.length;
  const hiddenScanCount = Math.max(0, totalScanCount - visibleScanCount);

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

  useEffect(() => {
    if (scanOverlayOpen) {
      setScanFeedback('');
    }
  }, [scanOverlayOpen]);

  const showScanAlert = (type: 'success' | 'error', message: string, duration = 3000) => {
    setScanAlert({ type, message });
    setTimeout(() => setScanAlert(null), duration);
  };

  const handleScan = async (barcode: string) => {
    if (!activeSessionId) {
      feedbackError();
      showScanAlert('error', 'No active session - select one first');
      setScanFeedback('No active session');
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
      const isRegularSession = !isAdHoc && !isFogOfWar;

      const result = await findItemOwningSession(barcode);

      if (result.type === 'not_found') {
        if (isAdHoc) {
          feedbackError();
          setScanFeedback('Not in inventory');
          showScanAlert('error', 'Not in inventory');
          return;
        }

        if (isFogOfWar) {
          const logResult = await logProductLocation({
            scanning_session_id: activeSessionId,
            raw_lat: position.latitude,
            raw_lng: position.longitude,
            accuracy: position.accuracy,
            scanned_by: userDisplayName,
            product_type: barcode,
            sub_inventory: 'Review',
          });

          if (!logResult.success) {
            feedbackError();
            showScanAlert('error', `Failed: ${logResult.error instanceof Error ? logResult.error.message : 'Unknown error'}`);
            return;
          }

          feedbackSuccess();
          setScanFeedback('Not in inventory - marked for review');
          showScanAlert('success', 'Not in inventory - marked for review');
          queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
          return;
        }

        feedbackError();
        setScanFeedback('Not in inventory');
        showScanAlert('error', 'Not in inventory');
        return;
      }

      if (result.type === 'multiple') {
        feedbackError();
        setScanFeedback('Multiple matches');
        showScanAlert('error', 'Multiple matches found - use session view', 5000);
        return;
      }

      const { item, owningSession } = result;
      if (!owningSession) {
        feedbackError();
        setScanFeedback('Item not assigned');
        showScanAlert('error', 'Item not assigned to a session');
        return;
      }

      const isSameSession = owningSession.id === activeSessionId;

      if (isAdHoc) {
        const logResult = await logProductLocation({
          product_id: item.products?.id ?? item.product_fk,
          inventory_item_id: item.id,
          scanning_session_id: activeSessionId,
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
        setScanFeedback(`Belongs to ${owningSession.name}`);
        showScanAlert('success', `Belongs to ${owningSession.name}`);
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
        return;
      }

      if (isFogOfWar) {
        const logResult = await logProductLocation({
          product_id: item.products?.id ?? item.product_fk,
          inventory_item_id: item.id,
          scanning_session_id: activeSessionId,
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
        setScanFeedback(logResult.action === 'updated' ? 'Mark updated' : 'Marked');
        showScanAlert('success', logResult.action === 'updated' ? 'Mark updated' : 'Marked');
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
        return;
      }

      if (isRegularSession) {
        const sessionDetail = sessionDetailQuery.data;
        if (!sessionDetail) {
          feedbackError();
          setScanFeedback('Session unavailable');
          showScanAlert('error', 'Session data unavailable');
          return;
        }

        if (isSameSession) {
          const itemId = item.id;
          if (!itemId) {
            feedbackError();
            setScanFeedback('Item data missing');
            showScanAlert('error', 'Item data missing');
            return;
          }

          if (sessionDetail.scannedItemIds.includes(itemId)) {
            feedbackError();
            setScanFeedback('Already scanned');
            showScanAlert('error', 'Item already scanned');
            return;
          }

          const nextScanned = [...sessionDetail.scannedItemIds, itemId];
          await updateSessionMutation.mutateAsync({
            sessionId: sessionDetail.id,
            scannedItemIds: nextScanned,
            updatedBy: userDisplayName,
          });

          const logResult = await logProductLocation({
            product_id: item.products?.id ?? item.product_fk,
            inventory_item_id: item.id,
            scanning_session_id: activeSessionId,
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
          setScanFeedback(`Scanned - ${owningSession.name}`);
          showScanAlert('success', `Scanned - ${owningSession.name}`);
          queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
          return;
        }

        const logResult = await logProductLocation({
          product_id: item.products?.id ?? item.product_fk,
          inventory_item_id: item.id,
          scanning_session_id: activeSessionId,
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
        setScanFeedback(`Belongs to ${owningSession.name} - marker updated`);
        showScanAlert('success', `Belongs to ${owningSession.name} - marker updated`);
        queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
      }
    } catch (err) {
      feedbackError();
      setScanFeedback('Scan failed');
      showScanAlert('error', err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraScan = (code: string) => {
    setCameraOpen(false);
    handleScan(code);
  };

  const handleSessionSelect = (sessionId: string) => {
    // All sessions can be set as active for map scanning
    setActiveSessionId(sessionId);
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

  // Auto-activate Fog of War if no session is active
  useEffect(() => {
    if (!activeSessionId && !sessionSummariesQuery.isLoading) {
      handleActivateFogOfWar();
    }
  }, [activeSessionId, sessionSummariesQuery.isLoading, handleActivateFogOfWar]);

  const sessionIds = useMemo(
    () =>
      Array.from(
        new Set(
          validLocations
            .map(loc => loc.scanning_session_id)
            .filter(Boolean)
        )
      ) as string[],
    [validLocations]
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

  // Build session options for scanner overlay
  const sessionOptions = useMemo<SessionOption[]>(() => {
    const options: SessionOption[] = [];

    // Special sessions
    options.push({
      id: 'adhoc',
      name: 'Ad-hoc Scans',
      icon: Zap,
      isActive: activeSession?.name === '🧪 Ad-hoc Scans',
      isSpecial: true,
      onClick: handleActivateAdHoc,
    });
    options.push({
      id: 'fogofwar',
      name: 'Fog of War',
      icon: MapIcon,
      isActive: activeSession?.name === '🗺️ Fog of War',
      isSpecial: true,
      onClick: handleActivateFogOfWar,
    });

    // Regular sessions
    const regularSessions = allSessions.filter(
      s => s.name !== '🧪 Ad-hoc Scans' && s.name !== '🗺️ Fog of War'
    );
    regularSessions.forEach(session => {
      // ASIS sessions: show friendly name, color, and total only
      if (session.inventoryType === 'ASIS' && session.subInventory) {
        const load = loadMetadata.get(session.subInventory);
        const friendlyName = load?.friendly_name || session.subInventory;
        const color = load?.primary_color || '#94a3b8';
        const csoLast4 = load?.ge_cso ? load.ge_cso.slice(-4) : null;

        const details = csoLast4
          ? `${session.totalItems} items • [${csoLast4}]`
          : `${session.totalItems} items`;

        options.push({
          id: session.id,
          name: friendlyName,
          isActive: session.id === activeSessionId,
          isSpecial: false,
          color: color,
          showAsBox: true,
          details: details,
          onClick: () => handleSessionSelect(session.id),
        });
      } else if (session.inventoryType === 'FG') {
        // FG sessions: show in box without color
        options.push({
          id: session.id,
          name: session.subInventory || 'FG',
          isActive: session.id === activeSessionId,
          isSpecial: false,
          showAsBox: true,
          details: `${session.totalItems} items`,
          onClick: () => handleSessionSelect(session.id),
        });
      } else {
        // Other sessions: show full details
        options.push({
          id: session.id,
          name: session.name,
          isActive: session.id === activeSessionId,
          isSpecial: false,
          details: `${session.inventoryType} • ${session.subInventory || 'All'} • ${session.scannedCount}/${session.totalItems}`,
          onClick: () => handleSessionSelect(session.id),
        });
      }
    });

    return options;
  }, [activeSession, activeSessionId, allSessions, handleActivateAdHoc, handleActivateFogOfWar, loadMetadata]);

  // Get display name and color for active session
  const activeSessionDisplay = useMemo(() => {
    if (!activeSession) return { displayName: undefined, color: undefined };

    // ASIS sessions: use friendly name and color from load metadata
    if (activeSession.inventoryType === 'ASIS' && activeSession.subInventory) {
      const load = loadMetadata.get(activeSession.subInventory);
      const friendlyName = load?.friendly_name || activeSession.subInventory;

      return {
        displayName: friendlyName,
        color: load?.primary_color || '#94a3b8',
      };
    }

    // Special sessions: strip emoji from name
    if (activeSession.name === '🧪 Ad-hoc Scans') {
      return {
        displayName: 'Ad-hoc Scans',
        color: undefined,
      };
    }
    if (activeSession.name === '🗺️ Fog of War') {
      return {
        displayName: 'Fog of War',
        color: undefined,
      };
    }

    // Other sessions: use session name, no color
    return {
      displayName: activeSession.name,
      color: undefined,
    };
  }, [activeSession, loadMetadata]);

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
        styles={showWorldMap ? undefined : mapStyles}
      >
        <MapControls
          position="top-left"
          showZoom={!isMobile}
          showCompass
          showLocate
          showFullscreen={!isMobile}
        />
        {visibleLocations.map((location) => (
          <MapMarker
            key={location.id}
            longitude={location.raw_lng!}
            latitude={location.raw_lat!}
          >
            <MarkerContent>
              <div className="cursor-pointer">
                <div
                  className="size-4 rounded-full border-2 border-white shadow-lg hover:scale-125 transition-transform"
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


      {/* Inventory button */}
      <div className="absolute bottom-10 left-4">
        <Button
          type="button"
          variant="outline"
          className="h-14 w-14 p-0 shadow-lg"
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
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Visible {visibleScanCount}</Badge>
                      <Badge variant="outline">Hidden {hiddenScanCount}</Badge>
                      <Badge variant="outline">Total {totalScanCount}</Badge>
                    </div>
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
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground font-medium">Sessions (tap to toggle)</div>

                    {sessionGroups.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No scans yet.</div>
                    ) : (
                      <div className="space-y-1">
                        {sessionGroups.map((group) => {
                          const isHidden = hiddenSessions.has(group.sessionId);
                          return (
                            <div key={group.sessionId} className="flex items-center gap-2">
                              <button
                                type="button"
                                className="flex items-center gap-2 flex-1 min-w-0 hover:bg-accent rounded px-2 py-2"
                                onClick={() => toggleSessionVisibility(group.sessionId)}
                              >
                                <div
                                  className="size-3 rounded-sm shrink-0"
                                  style={{
                                    backgroundColor: group.color,
                                    opacity: isHidden ? 0.3 : 1,
                                  }}
                                />
                                <span className={`truncate flex-1 text-left text-sm ${isHidden ? 'opacity-40 line-through' : ''}`}>
                                  {group.name}
                                </span>
                                <span className={`text-muted-foreground shrink-0 text-xs tabular-nums ${isHidden ? 'opacity-40' : ''}`}>
                                  {group.count}
                                </span>
                              </button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                  if (deleteSessionScans.isPending) return;
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
                                  <X className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3 space-y-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        setShowWorldMap((prev) => {
                          const next = !prev;
                          if (typeof window !== 'undefined') {
                            window.localStorage.setItem(WORLD_MAP_STORAGE_KEY, String(next));
                          }
                          return next;
                        });
                      }}
                    >
                      <Globe className="h-4 w-4" />
                      {showWorldMap ? 'Hide' : 'Show'} World Map
                    </Button>

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
      <div className="absolute bottom-10 right-4 flex gap-2">
        {/* Keyboard scan button */}
        <Button
          className="h-14 gap-2 shadow-lg"
          onClick={() => setScanOverlayOpen(true)}
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
        feedbackText={scanFeedback}
        activeSessionName={activeSession?.name}
        activeSessionDisplayName={activeSessionDisplay.displayName}
        activeSessionColor={activeSessionDisplay.color}
        sessionOptions={sessionOptions}
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
