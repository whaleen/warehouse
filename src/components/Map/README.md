# Warehouse Map - Fog of War

Fog of war heat map visualization for warehouse product positioning.

## Components

### `MapView.tsx`
Main view component with stats, refresh, and legend. Wraps the map visualization.

### `WarehouseMap.tsx`
Leaflet-based map using CRS.Simple (non-geographic coordinates). Renders:
- Genesis point (origin 0,0) as blue dot
- Product scans as colored dots (load colors)
- Grid background (10m spacing)
- Popups with product info

## How It Works

1. **First scan establishes genesis point** - GPS coordinates stored in `location_genesis_points`
2. **Subsequent scans positioned relative to genesis** - Haversine formula converts GPS → relative x,y meters
3. **All positions stored in `product_location_history`** - Raw GPS preserved for debugging
4. **Load colors applied** - Products colored by their load group using `loadColors` array

## Position Capture

Position capture integrated into `ScanningSessionView.tsx`:
- Runs async after successful scan (non-blocking)
- Logs to console with accuracy info
- Handles GPS unavailable/denied gracefully

## Database Tables

- `location_genesis_points` - Origin point per location
- `product_location_history` - Scan positions with raw GPS + relative x/y
- `beacons` - Future beacon positions (not used in v1)

## Future: Beacon Positioning

Schema supports beacon-based positioning (v2):
- `position_source: 'beacon'` instead of `'gps'`
- `beacon_id` foreign key reference
- Coordinates remain relative x/y from genesis

## Current Limitations

- GPS accuracy indoors is poor (~10-50m)
- No floor plan overlay yet (just grid)
- No heat map layer yet (just dots)
- Beacon support not implemented

## Next Steps

1. Add floor plan image overlay
2. Implement heat map layer (leaflet.heat)
3. Add beacon management UI
4. Add beacon positioning when hardware arrives
