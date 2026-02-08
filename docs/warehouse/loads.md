# Loads

## What Loads Are
Loads group items by sub‑inventory. ASIS loads are tracked with GE status fields and prep flags.

## Load List
1. Open **Loads** from the sidebar.
2. Use the filter chips to switch between:
   - **All**
   - **For Sale**
   - **Picked**
   - **Shipped**
   - **Delivered**
3. Use **Show delivered** to include delivered loads.

## Load Detail Panel
Click a load to open its detail panel. It includes:
- Load header and status badges
- Item list with search (serial, CSO, model, brand)
- Per‑item status markers
- Load metadata fields (friendly name, color, notes)
- Prep flags (wrapped, tagged, sanity check requested/completed)
- Pickup date

## Common Tasks

### Request a Sanity Check
When GE asks for verification of load contents:
1. Open **Loads** from the sidebar
2. Click the load to open its detail panel
3. Scroll to the prep flags section
4. Click the **Request Sanity Check** checkbox
5. The load will now show as requiring verification

### Complete a Sanity Check
After verifying the load contents match GE records:
1. Open the load with a pending sanity check
2. Verify all items in the load match GE expectations
3. Click the **Sanity Check Completed** checkbox
4. The request is now cleared

### Update Prep Status
For sold loads awaiting pickup:
1. Open the sold load's detail panel
2. Toggle **Wrapped** if the load is wrapped and ready
3. Toggle **Tagged** if the load is tagged with customer info
4. Changes save automatically

### Edit Load Metadata
To identify loads on the warehouse floor:
1. Open the load's detail panel
2. Click **Edit** on the load header
3. Update:
   - **Friendly Name** (easier to reference than sub-inventory)
   - **Color** (visual identification on map/lists)
   - **Notes** (internal notes about the load)
   - **Pickup Date** (scheduled pickup time)
4. Click **Save** to apply changes

## Notes
- Delivered loads are hidden by default.
- Shipped loads can still be on the floor (sold awaiting pickup).

## Audience Notes

### For Developers
- Loads map to sub-inventory and GE load metadata.
- Prep flags and sanity checks are key workflow fields.

### For Operators
- Use Loads to prepare sold/pickup loads and update prep flags.

### For Agent
- Use this for load prep and status questions.
