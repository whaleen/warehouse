# Warehouse Map

Map visualization for warehouse product positioning using raw GPS coordinates.

## Components

### `MapView.tsx`
Main view component that loads the map and passes data into the renderer.

### `WarehouseMapNew.tsx`
MapLibre-based map on a blank canvas. Renders:
- Product scans as colored dots (load colors)
- Popups with product info

## How It Works

1. **Scan logs raw GPS coordinates** - Stored in `product_location_history`
2. **Map renders raw GPS points** - MapLibre markers display scan positions
3. **Load colors applied** - Products colored by their load group using `loadColors` array

## Position Capture

Position capture runs from map scan flows:
- Runs async after successful scan (non-blocking)
- Logs to console with accuracy info
- Handles GPS unavailable/denied gracefully

## Database Tables

- `product_location_history` - Scan positions with raw GPS
- `beacons` - Future beacon positions (not used in v1)

## Future: Beacon Positioning

Schema supports beacon-based positioning (v2):
- `position_source: 'beacon'` instead of `'gps'`
- `beacon_id` foreign key reference

## Current Limitations

- GPS accuracy indoors is poor (~10-50m)
- No floor plan overlay yet (just grid)
- No heat map layer yet (just dots)
- Beacon support not implemented

## Next Steps

1. Add floor plan image overlay
2. Implement heat map layer
3. Add beacon management UI
4. Add beacon positioning when hardware arrives

## Related Docs
- Map data flow: `/docs?doc=docs%2Ffeatures%2Fmap.md`
- Warehouse Map guide: `/docs?doc=agent%2Fwarehouse-map.md`

## Audience Notes

### For Developers
- This is a component-level overview; see `docs/features/map.md` for data flow.

### For Operators
- Use the Warehouse Map guide for UI steps.

### For Agent
- Use this only for technical component references.
