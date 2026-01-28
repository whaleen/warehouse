/**
 * Warehouse Map - Leaflet-based coordinate visualization
 *
 * Uses Leaflet's CRS.Simple for x/y coordinate system (not geographic).
 * Coordinates stored in meters, displayed in feet.
 * Renders product positions as colored circles.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProductLocationForMap, GenesisPoint } from '@/types/map';
import { useTheme } from '@/components/theme-provider';

interface WarehouseMapProps {
  locations: ProductLocationForMap[];
  genesis: GenesisPoint;
}

export function WarehouseMap({ locations, genesis }: WarehouseMapProps) {
  const { theme } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const gridOverlayRef = useRef<L.ImageOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Detect if we're in dark mode
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Helper function to generate grid canvas based on theme
  const generateGridCanvas = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 2000;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Get actual app background color by creating a temporary element
      const tempDiv = document.createElement('div');
      tempDiv.className = 'bg-background';
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
      const bgColor = getComputedStyle(tempDiv).backgroundColor;
      document.body.removeChild(tempDiv);

      // Fill background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 2000, 2000);
    }

    return canvas.toDataURL();
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    // Create map with simple coordinate system (not geographic)
    const map = L.map(mapContainer.current, {
      crs: L.CRS.Simple,
      center: [0, 0],
      zoom: 1,
      minZoom: -2,
      maxZoom: 4,
      zoomControl: true,
      attributionControl: false,
    });

    // Add scale control (shows distance, auto-adjusts to zoom)
    L.control.scale({
      position: 'bottomright',
      metric: false,
      imperial: true,
      maxWidth: 150,
    }).addTo(map);

    // Add grid background
    const imageUrl = generateGridCanvas();
    const bounds = L.latLngBounds([[-1000, -1000], [1000, 1000]]);

    gridOverlayRef.current = L.imageOverlay(imageUrl, bounds).addTo(map);

    // Create markers layer
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstance.current = map;
    setMapReady(true);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update grid when theme changes
  useEffect(() => {
    if (!mapInstance.current || !gridOverlayRef.current) return;

    const imageUrl = generateGridCanvas();
    gridOverlayRef.current.setUrl(imageUrl);
  }, [isDark]);

  // Update markers when locations change
  useEffect(() => {
    if (!mapReady || !mapInstance.current || !markersLayerRef.current) return;

    const map = mapInstance.current;
    const markersLayer = markersLayerRef.current;

    // Clear existing markers
    markersLayer.clearLayers();

    if (locations.length === 0) return;

    // Add genesis marker (origin point)
    const borderColor = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'; // background color

    const genesisIcon = L.divIcon({
      html: `
        <div style="
          width: 16px;
          height: 16px;
          background: ${borderColor};
          border: 3px solid #3b82f6;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(59, 130, 246, ${isDark ? '0.4' : '0.6'});
        "></div>
      `,
      className: 'genesis-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const textColor = isDark ? '#e2e8f0' : '#1e293b'; // slate-200 / slate-900
    const mutedColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 / slate-600

    L.marker([0, 0], { icon: genesisIcon })
      .bindPopup(
        `<div style="text-align: center;">
          <strong style="color: ${textColor};">Genesis Point</strong><br/>
          <span style="font-size: 11px; color: ${mutedColor};">Origin (0, 0)</span><br/>
          <span style="font-size: 11px; color: ${mutedColor};">
            ${genesis.genesis_lat.toFixed(6)}, ${genesis.genesis_lng.toFixed(6)}
          </span>
        </div>`
      )
      .addTo(markersLayer);

    // Add product location markers
    locations.forEach((location) => {
      // In Leaflet's CRS.Simple, y is flipped (north is positive)
      // Our coordinate system has y positive = north, which matches Leaflet
      const latLng: L.LatLngExpression = [location.position_y, location.position_x];

      const markerIcon = L.divIcon({
        html: `
          <div style="
            width: 12px;
            height: 12px;
            background: ${location.load_color};
            border: 2px solid ${borderColor};
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0, 0, 0, ${isDark ? '0.5' : '0.3'});
          "></div>
        `,
        className: 'product-marker',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const marker = L.marker(latLng, { icon: markerIcon });

      // Create popup content
      const textColor = isDark ? '#e2e8f0' : '#1e293b'; // slate-200 / slate-900
      const mutedColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 / slate-600

      // Convert meters to feet for display
      const xFeet = (location.position_x * 3.28084).toFixed(1);
      const yFeet = (location.position_y * 3.28084).toFixed(1);
      const accuracyFeet = location.accuracy ? Math.round(location.accuracy * 3.28084) : null;

      const popupContent = `
        <div style="min-width: 150px;">
          <div style="font-weight: 600; margin-bottom: 4px; color: ${textColor};">
            ${location.product_type || 'Unknown'}
          </div>
          <div style="font-size: 11px; color: ${mutedColor}; margin-bottom: 4px;">
            ${location.sub_inventory || 'No Load'}
          </div>
          <div style="font-size: 11px; color: ${mutedColor}; font-family: monospace;">
            x: ${xFeet}ft<br/>
            y: ${yFeet}ft
          </div>
          ${
            accuracyFeet
              ? `<div style="font-size: 10px; color: ${mutedColor}; margin-top: 4px;">
                  GPS ±${accuracyFeet}ft
                </div>`
              : ''
          }
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(markersLayer);
    });

    // Fit map to show all markers
    if (locations.length > 0) {
      const allPoints = locations.map((l) => [l.position_y, l.position_x] as L.LatLngExpression);
      allPoints.push([0, 0]); // Include genesis

      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 2 });
    }
  }, [locations, genesis, mapReady, isDark]);

  return (
    <div className="relative w-full z-0">
      <div
        ref={mapContainer}
        className="w-full bg-background relative z-0"
        style={{ height: 'clamp(450px, 70vh, 600px)' }}
      />
      <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[100] bg-card/95 backdrop-blur border border-border p-1.5 sm:p-3 rounded text-[9px] sm:text-xs shadow-lg">
        <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1.5">
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500 border border-background" />
          <span className="text-foreground font-medium">Genesis</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border border-background" />
          <span className="text-foreground font-medium">Scans</span>
        </div>
        <div className="text-muted-foreground mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-border text-[8px] sm:text-[10px]">
          {locations.length}
        </div>
      </div>
    </div>
  );
}
