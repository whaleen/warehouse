# Inventory

## What It Is
Inventory is the primary view for finding items by serial, CSO, model, or product type.

## How to Find an Item
1. Open **Inventory** from the sidebar.
2. Use the search bar with one of these:
   - Serial number (exact match)
   - CSO number (exact match)
   - Model number (partial match)
   - Product type (e.g., "refrigerator", "dishwasher")
3. Click an item to open details.

## What You Can See
- Item model, serial, and CSO
- Product type and sub‑inventory
- Status (available, shipped, etc.)
- Last scanned GPS location (if it exists)

## When Inventory Won't Help
- If an item has never synced from GE DMS yet
- If you only have a location and no identifier

## Audience Notes

### For Developers
- Inventory is the canonical search UI (serial/CSO/model).
- Use this when building inventory lookup endpoints.

### For Operators
- Use Inventory to find a unit by serial/CSO/model.

### For Agent
- Prefer Inventory for item lookups and filters.
