# Scanning

## What Scanning Does
Scanning records a GPS location for an item and updates its last‑known position on the Warehouse Map.

## Two Modes
### Ad‑hoc Mode
- Accepts any barcode (no validation)
- Creates a GPS marker immediately
- Saves to the permanent **Ad‑hoc Scan** session

### Fog of War Mode
- Validates against inventory
- Accepts only serial or CSO (no model‑only scans)
- Updates an item's GPS location
- Saves to the permanent **Fog of War** session

## Quick Scan (No Session)
1. Open the scanner (floating button)
2. Choose **Ad‑hoc** or **Fog of War**
3. Scan or type the barcode
4. The app records GPS automatically

## Camera Scanner Tips
- Use good lighting
- Hold steady for 1–2 seconds
- Works for 1D and 2D barcodes

## Common Errors
- **"GPS unavailable"**: enable location services
- **"Not in inventory"** (Fog of War): item not synced yet or barcode mismatch

## Audience Notes

### For Developers
- Scanning writes GPS markers; Fog of War validates inventory.
- Use this to map scanner events to DB writes.

### For Operators
- Use scanning to record locations; Fog of War needs valid serial/CSO.

### For Agent
- Answer scanner questions from this doc only.
