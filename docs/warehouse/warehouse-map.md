# Warehouse Map

## What It Is
The Warehouse Map is a MapLibre view that plots GPS scan points as colored markers on a blank canvas. It is used to see where items were last scanned and to sanity‑check spatial placement. It does **not** show a full warehouse layout or aisle/zone map.

## How It Works
- Markers come from GPS data saved during scans.
- Each marker represents a scanned item with valid latitude/longitude.
- Markers are colored by load (sub‑inventory) when available.

## How to Use It
1. Open **Warehouse Map** from the sidebar.
2. Click any marker to see item details.
3. Use the **Inventory** drawer (layers icon) to hide/show load buckets and scan groups.
4. Use the **Globe** control to toggle the world map background on/off.

## What You Can See in a Marker
- Model and serial (when available)
- Load color and friendly name
- Scan time and GPS accuracy

## Limits and Gotchas
 - No search bar on the map.
 - No filter dropdowns on the map.
 - The map does not show a full warehouse layout or aisle/zone system.
 - There is no "Product Locations" table in the UI; locations are shown as map markers.
 - GPS accuracy indoors is often 10–50 meters; use markers as a general area.
 - If an item was never scanned, it will not appear on the map.

## Where to Search Instead
- Use **Inventory** for serial/CSO/model search and filters.
- Use **GE DMS** if the item has never been scanned.
