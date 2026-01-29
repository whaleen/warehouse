# Map (Warehouse Map)

## Overview
The map is a MapLibre-based visualization of scan locations. It renders a blank canvas (no tiles) and places a marker for each scanned item with GPS coordinates. The map is designed for quick spatial verification of scanned inventory and supports lightweight popovers with key scan details.

## Core Concepts
- **Source of truth**: `product_location_history`
- **Map markers**: Each row with valid `raw_lat` + `raw_lng` becomes a marker.
- **Coordinates**: GPS coordinates are stored in `raw_lat`/`raw_lng` (numeric). The map uses these directly.
- **Load metadata**: Load color and friendly name are resolved from `load_metadata` by `sub_inventory`.
- **Product info**: Product model/serial are resolved from inventory items; product image is resolved from `products.image_url`.
- **UI state**: World map toggle + map view (center/zoom) are stored in `localStorage`.

## Data Flow
1. **Scan** → `logProductLocation` writes to `product_location_history`.
2. **Map query** → `getProductLocations` reads scan history, then joins in:
   - `inventory_items` (model, serial, product_type, product_fk)
   - `products` (image_url, model, product_type)
   - `load_metadata` (friendly_name)
   - `inventory_items` again for per-load item counts
3. **Render** → `WarehouseMapNew` filters valid GPS points and renders markers.

## Key Files
- **Map view**: `src/components/Map/MapView.tsx`
- **Map rendering**: `src/components/Map/WarehouseMapNew.tsx`
- **Map UI primitives**: `src/components/ui/map.tsx`
- **Map data access**: `src/lib/mapManager.ts`
- **Map hooks**: `src/hooks/queries/useMap.ts`
- **Blank style**: `src/components/Map/BlankMapStyle.ts`

## Storage Tables
### `product_location_history`
- `raw_lat`, `raw_lng`: GPS coordinates used for markers
- `product_id`: FK to `products` (preferred for image)
- `inventory_item_id`: may point to session snapshot, not a strict FK
- `product_type`, `sub_inventory`: snapshot data for map display

### `inventory_items`
- `product_fk`: FK to `products` (used as fallback)
- `model`, `serial`, `product_type`: used for popover text

### `products`
- `image_url`: used for thumbnail
- `model`, `product_type`: used for fallback name

### `load_metadata`
- `sub_inventory_name`, `friendly_name`, `primary_color`

## Popover Content (Current)
- Thumbnail (from `products.image_url`)
- Model + Serial (from inventory/product)
- Load color square + friendly name (or load id fallback)
- Load ID (sub_inventory)
- Load items count (`1 / total`)
- Scan timestamp
- GPS accuracy
- Delete scan button
- Edit load button (pencil) → `/loads/:sub_inventory`

## UI State Persistence
- **World map toggle**: `localStorage` key `warehouse.map.showWorldMap`
- **Map view**: `localStorage` key `warehouse.map.viewState`
  - `{ center: [lng, lat], zoom, bearing, pitch }`

## Known Behaviors
- **Auto-fit** runs once per load unless a saved view exists.
- **Markers only appear** when `raw_lat` and `raw_lng` are present.

## Common Gotchas
- `product_location_history.product_id` is often missing. If so, the app falls back to `inventory_items.product_fk` and then to `products.model`.
- `inventory_item_id` might not exist in `inventory_items` (session snapshot). Expect nulls and fallbacks.
- MapLibre requires numeric coordinates; `raw_lat/raw_lng` should be coerced to numbers.

## Where to Extend
- **Add map controls**: `src/components/ui/map.tsx` exports `MapControls`.
- **Add layers**: create new map layers in `WarehouseMapNew` once `mapRef` is available.
- **Add clustering**: use `MapClusterLayer` from `src/components/ui/map.tsx`.
- **Add floor plan overlay**: add a raster layer using MapLibre sources.

## Related SQL (Backfill)
If thumbnails are missing due to null `product_id` on scans:
```sql
UPDATE public.product_location_history plh
SET product_id = ii.product_fk
FROM public.inventory_items ii
WHERE plh.product_id IS NULL
  AND plh.inventory_item_id = ii.id
  AND ii.product_fk IS NOT NULL;
```
