# Product Lifecycle - Data Flow & Guardrails

## Core Principle

**Inventory Items = Current Reality**
The `inventory_items` table is ephemeral - it represents "what we believe is in the building right now." Everything else is permanent history.

## Data Categories

### Ephemeral (Nuked on Each Sync)
- **`inventory_items`** - Current inventory snapshot
  - Replaced entirely on each GE sync for that inventory type
  - Gets removed when items ship/convert
  - Only source of truth: "is this in the building?"

### Permanent (Never Deleted)
- **`product_location_history`** - Every scan ever taken
- **`scanning_sessions`** - Session records
- **`load_metadata`** - Load information (persists after shipping)
- **`inventory_conversions`** - Type changes (ASIS→FG, etc)
- **`deliveries`** - Shipment records
- **`ge_changes`** - Audit log of sync changes
- **`inventory_counts`** - Part count adjustments
- **`load_conflicts`** - Detected conflicts
- **`inventory_conflicts`** - Serial conflicts

## The Lifecycle Flow

### 1. Import (GE Sync)

```
GE DMS → ge-sync service → Supabase
```

**Process:**
1. Fetch inventory from GE (ASIS, FG, or STA)
2. **DELETE** all `inventory_items` for that `inventory_type` + `location_id`
3. **INSERT** fresh records from GE
4. Log changes to `ge_changes` table
5. Detect conflicts (same serial in multiple loads)

**Guardrails:**
- ✅ Only nuke the specific inventory type being synced
- ✅ Never touch `product_location_history` or other permanent tables
- ✅ Preserve `is_scanned` flag if serial matches and scan was recent (< 24h)
- ✅ Log orphaned items (in our DB but not in GE) to `ge_changes`

### 2. Scanning (Floor Operations)

```
Barcode scan → Create location history → Update inventory_items
```

**Process:**
1. User scans serial/model barcode
2. Match to `inventory_items` record
3. **INSERT** into `product_location_history`:
   - `inventory_item_id` (FK to current item)
   - `product_id` (FK to product master)
   - `scanning_session_id` (FK to active session)
   - `raw_lat`, `raw_lng`, `accuracy` (GPS coords)
   - `position_x`, `position_y` (calculated - legacy)
   - `scanned_by`, `created_at`
4. **UPDATE** `inventory_items`:
   - `is_scanned = true`
   - `scanned_at = now()`
   - `scanned_by = username`

**Guardrails:**
- ✅ Always create new `product_location_history` record (never update)
- ✅ Multiple scans of same serial = multiple history records
- ✅ If item not in `inventory_items`, warn but allow scan (GE sync may be stale)
- ✅ Session tracks `scanned_item_ids` array for quick lookup

### 3. Conversion (Type Changes)

```
ASIS → FG (item fixed/cleaned)
FG → ASIS (item damaged)
```

**Process:**
1. User converts item in UI
2. **INSERT** into `inventory_conversions`:
   - `inventory_item_id` (the item being converted)
   - `from_inventory_type`, `to_inventory_type`
   - `from_sub_inventory`, `to_sub_inventory`
   - `converted_by`, `notes`, `created_at`
3. **UPDATE** `inventory_items`:
   - `inventory_type = new_type`
   - `sub_inventory = new_sub_inventory`
   - `updated_at = now()`
4. Log to `activity_log`

**Guardrails:**
- ✅ Keep full conversion history (never delete)
- ✅ Item stays in `inventory_items` (still in building)
- ✅ Next GE sync may revert if GE disagrees (log conflict)

### 4. Shipping (Leaving Building)

```
Staged for truck → Shipped → Removed from inventory_items
```

**Process:**
1. User marks items for truck/delivery
2. **INSERT** into `deliveries`:
   - `truck_fk`, `customer_fk`, `product_fk`
   - `serial`, `model`, `product_type`
   - `status = 'STAGED'` → `'IN_TRANSIT'` → `'DELIVERED'`
3. When truck leaves, **UPDATE** `deliveries.status = 'IN_TRANSIT'`
4. **DELETE** from `inventory_items` (no longer in building)
5. Log to `activity_log`

**Guardrails:**
- ✅ Only delete from `inventory_items` when truck actually leaves
- ✅ Keep `deliveries` record forever
- ✅ If GE sync adds item back, could mean delivery was cancelled (log conflict)

## Serial vs Non-Serial Items

### Items WITH Serial Numbers

**Characteristics:**
- Unique identifier across entire lifecycle
- Full traceability through all tables
- Multiple scans create movement timeline

**Tables Involved:**
```
inventory_items.serial = "ABC123"
  ↓
product_location_history.serial = "ABC123" (scan 1)
product_location_history.serial = "ABC123" (scan 2)
product_location_history.serial = "ABC123" (scan 3)
  ↓
deliveries.serial = "ABC123" (shipped)
```

**Queries:**
```sql
-- Full item history
SELECT * FROM product_location_history
WHERE inventory_item_id IN (
  SELECT id FROM inventory_items WHERE serial = 'ABC123'
)
ORDER BY created_at;

-- Is it currently in building?
SELECT * FROM inventory_items WHERE serial = 'ABC123';
```

### Items WITHOUT Serial Numbers

**Characteristics:**
- Only total counts matter
- Tracked by `model` + `sub_inventory` (load)
- Can't track individual unit movement

**Tables Involved:**
```
inventory_items (qty = 5, model = "GDT605PGM", sub_inventory = "LOAD-123")
  ↓
product_location_history (5 scans, model = "GDT605PGM", no serial)
  ↓
deliveries (2 units shipped, qty = 2, no serial)
  ↓
inventory_items (qty = 3 remaining)
```

**Queries:**
```sql
-- Current count in building
SELECT SUM(qty) FROM inventory_items
WHERE model = 'GDT605PGM' AND sub_inventory = 'LOAD-123';

-- How many scanned from this load?
SELECT COUNT(*) FROM product_location_history
WHERE sub_inventory = 'LOAD-123' AND model = 'GDT605PGM';

-- How many shipped?
SELECT SUM(qty) FROM deliveries
WHERE model = 'GDT605PGM' AND serial IS NULL;
```

**Challenges:**
- Can't trace specific units
- Scans don't reduce `inventory_items.qty` (only shipments do)
- If GE sync shows qty changed, hard to know why (shrinkage? error?)

## Conflict Detection

### Serial Conflicts (Same Serial, Different Loads)

**Detected by:** GE sync
**Stored in:** `inventory_conflicts`

```sql
-- Same serial in multiple loads
{
  "serial": "ABC123",
  "groups": [
    {"sub_inventory": "LOAD-001", "model": "GDT605PGM"},
    {"sub_inventory": "LOAD-002", "model": "GDT605PGM"}
  ]
}
```

**Resolution:**
- Manual intervention required
- Likely data entry error in GE
- Keep all records until resolved

### Load Conflicts (Serial Moved Between Loads)

**Detected by:** GE sync comparing previous state
**Stored in:** `load_conflicts`

```sql
-- Serial moved from one load to another
{
  "serial": "ABC123",
  "load_number": "LOAD-001",
  "conflicting_load": "LOAD-002"
}
```

**Resolution:**
- Could be legitimate (GE corrected error)
- Could be data corruption
- Log for review

## Guardrails Summary

### On GE Sync
1. ✅ Only nuke `inventory_items` for the specific inventory type
2. ✅ Never touch permanent history tables
3. ✅ Log all changes to `ge_changes`
4. ✅ Detect conflicts before import
5. ✅ Mark orphaned items (in DB but not in GE)
6. ✅ Preserve recent scans if serial matches

### On Scanning
1. ✅ Always create new `product_location_history` (never update)
2. ✅ Allow scanning items not in `inventory_items` (with warning)
3. ✅ Link to active `scanning_session_id`
4. ✅ Capture GPS coordinates (`raw_lat`, `raw_lng`, `accuracy`)
5. ✅ Update `inventory_items.is_scanned` flag

### On Conversion
1. ✅ Keep full conversion history
2. ✅ Item stays in `inventory_items` (still in building)
3. ✅ Log to `activity_log` for visibility

### On Shipping
1. ✅ Only delete from `inventory_items` when truck leaves
2. ✅ Keep `deliveries` record forever
3. ✅ Log to `activity_log`

## Edge Cases

### What if item is scanned but not in GE?

**Scenario:** Serial not found in `inventory_items`

**Response:**
- Allow the scan (GE sync may be stale)
- Create `product_location_history` record
- Show warning in UI: "Not found in current inventory"
- Next GE sync will either add it or confirm it's gone

### What if GE sync removes a recently scanned item?

**Scenario:** Item scanned yesterday, GE sync today doesn't include it

**Response:**
- Delete from `inventory_items` (trust GE)
- Keep `product_location_history` record (permanent)
- Log to `ge_changes` as "orphaned"
- Flag in UI for review (may be GE error)

### What if non-serial item count changes in GE?

**Scenario:** Had 5 units, GE now shows 3

**Response:**
- Update `inventory_items.qty = 3` (trust GE)
- Log to `ge_changes` with delta
- Can't determine which specific units are gone (no serials)
- User must investigate discrepancy

### What if serial appears in multiple loads?

**Scenario:** Same serial in LOAD-001 and LOAD-002

**Response:**
- Create `inventory_conflicts` record
- Import both (don't skip)
- Flag in UI for manual resolution
- User must check physical inventory

## Development: Clean Slate

### "Nuke Products" Dev Tool

**What it should do:**
1. Show what will be deleted:
   - `inventory_items` count
   - `product_location_history` count
   - `scanning_sessions` count
   - `load_metadata` count
   - etc.
2. Option to nuke specific tables or all
3. Option to preserve certain data (sessions, products table, etc.)
4. Show summary after: "Deleted X items, Y scans, Z sessions"

**Recommended presets:**
- **"Clean Slate"** - Nuke everything except `products` table
- **"Fresh Sync"** - Nuke only `inventory_items` (simulate full sync)
- **"Reset Scans"** - Nuke `product_location_history` and reset `is_scanned` flags
- **"Nuclear Option"** - Everything (including `products`)

## Traceability Requirements

### For Items WITH Serial
✅ Must be able to answer:
- Where is serial ABC123 right now? → Query `inventory_items`
- Has it been scanned? → Check `is_scanned` flag
- When was it last scanned? → Latest `product_location_history` record
- How many times scanned? → Count `product_location_history` records
- What load did it come from? → `sub_inventory` in `inventory_items`
- Has it shipped? → Query `deliveries`

### For Items WITHOUT Serial
✅ Must be able to answer:
- How many model XYZ in building? → Sum `inventory_items.qty`
- How many scanned from LOAD-001? → Count scans with that `sub_inventory`
- How many shipped? → Sum `deliveries.qty` where `serial IS NULL`

### For All Items
✅ Must be able to answer:
- What changed in last GE sync? → Query `ge_changes`
- Are there conflicts? → Query `inventory_conflicts`, `load_conflicts`
- What's the activity timeline? → Query `activity_log`

## Next Steps

1. **Extend ge-sync** to handle FG and STA (not just ASIS)
2. **Create dev cleanup tool** with reporting
3. **Add conflict resolution UI** for manual fixes
4. **Build timeline view** for serial number traceability
