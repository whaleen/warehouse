# GE DMS Endpoint Field Documentation

**Generated:** 2026-02-08
**Purpose:** Mapping of GE DMS spreadsheet exports to our database schema (ASIS focused)

**Why This Matters:**
- GE doesn't provide a database schema or API
- We reverse-engineer their data model through UI exports
- This ensures complete field coverage and prevents data loss
- Change tracking gives us historical serial movement for lookups

---

## Endpoint 1: ASIS Load Spreadsheet

**UI Button:** "ASIS Load SpreadSheet" (blue button on main ASIS page)
**Endpoint:** `POST /dms/downloadExcelData`
**Request Body:** `request=ASIS&dmsLoc=9SU`
**File Format:** XLS
**Code Reference:** `src/sync/asis.ts` line 262

### Fields (5 total)

| GE Field Name | Type | Our Database Field | Table | Notes |
|---------------|------|-------------------|-------|-------|
| Load Number | string | `sub_inventory_name` | load_metadata | Primary identifier, e.g., "9SU20260129142324" |
| Units | number | `ge_units` | load_metadata | Quantity in load, usually 60-61 |
| Notes | string | `ge_notes` | load_metadata | Raw notes, used to derive friendly_name |
| Scanned Date/Time | datetime | `ge_scanned_at` | load_metadata | When GE scanned the load |
| Status | string | `ge_source_status` | load_metadata | "FOR SALE" or "SOLD" |

### Sample Data
```json
{
  "Load Number": "9SU20260129142324",
  "Units": "60",
  "Notes": "1/29",
  "Scanned Date/Time": "2026/01/29 14:23:24",
  "Status": "FOR SALE"
}
```

### Data Volume
- **~10 loads** per location at any given time
- Loads rotate as they are sold/delivered

### Derived Fields
We extract friendly names from the Notes field using patterns:
- `"LETTER A"` → `A`
- `"1/29"` → `1/29`
- `"14TH"` → `14TH`
- See: `deriveFriendlyNameFromNotes()` in `asis.ts` line 508

---

## Endpoint 2: Model Details Spreadsheet

**UI Button:** "Model Details SpreadSheet" (blue button on main ASIS page)
**Endpoint:** `POST /dms/downloadExcelData`
**Request Body:** `request=Model&dmsLoc=9SU`
**File Format:** CSV
**Code Reference:** Used for per-load detail fetches in `asis.ts`

### Fields (5 total)

| GE Field Name | Type | Our Database Field | Table | Notes |
|---------------|------|-------------------|-------|-------|
| ORDC | string | `ge_ordc` | inventory_items | Order code, e.g., "1EA" |
| MODELS | string | `model`, `ge_model` | inventory_items | Model number, e.g., "CAE28DM5TS5" |
| SERIALS | string | `serial`, `ge_serial` | inventory_items | Serial number (barcode) |
| QTY | number | `qty`, `ge_inv_qty` | inventory_items | Usually "1", sometimes higher |
| LOAD NUMBER | string | `sub_inventory` | inventory_items | Which load this item belongs to |

### Sample Data
```json
{
  "ORDC": "1EA",
  "MODELS": "CAE28DM5TS5",
  "SERIALS": "MA141869",
  "QTY": "1",
  "LOAD NUMBER": "1EA20260107144459"
}
```

### Data Volume
- **~14,674 items** across all loads (current snapshot)
- Individual loads typically have 60-61 items

### Special Handling
- **Missing Serials:** Generate synthetic serials `ASIS-NS:{load}:{model}:{index}`
- **Duplicate Serials:** Skip duplicates, log warning
- See: `buildSyntheticSerial()` in `asis.ts` line 249

---

## Endpoint 3: ASIS Report History

**UI Button:** "REPORT HISTORY" (top navigation)
**Endpoint:** `POST /dms/reportHistoryDownloadExcelData`
**Request Body:** `dmsLoc=9SU`
**File Format:** XLS
**Code Reference:** `src/sync/asis.ts` line 271

### Fields (8 total)

| GE Field Name | Type | Our Database Field | Table | Notes |
|---------------|------|-------------------|-------|-------|
| Load Number | string | `sub_inventory_name` | load_metadata | Matches Endpoint 1 |
| Status | string | `ge_source_status` | load_metadata | "FOR SALE" or "SOLD" |
| CSO Status | string | `ge_cso_status` | load_metadata | **"Picked", "Shipped", "Delivered"** |
| Inv Org | string | `ge_inv_org` | load_metadata | Inventory org code, e.g., "9SU" |
| Units | number | `ge_units` | load_metadata | Quantity in load |
| Submitted Date | date | `ge_submitted_date` | load_metadata | When submitted to GE |
| CSO | string | `ge_cso` | load_metadata | **Customer Service Order number** |
| Pricing | string | `ge_pricing` | load_metadata | Pricing info (often incomplete) |

### Sample Data
```json
{
  "Load Number": "9SU20260129142324",
  "Status": "SOLD",
  "CSO Status": "Picked",
  "Inv Org": "9SU",
  "Units": "60",
  "Submitted Date": "2026/01/29",
  "CSO": "CSO123456789",
  "Pricing": "$12,345"
}
```

### Key Insight
**This is where we get delivery tracking!**
- `CSO Status` tells us if loads are: Picked → Shipped → Delivered
- `CSO` (Customer Service Order) links to customer orders
- Combined with Endpoint 1 to get complete load metadata

---

## Endpoint 4: Per-Load Detail (CSV)

**UI Action:** Click blue load number link on main page
**Endpoint:** `POST /dms/downloadLoadDetailCSV`
**Request Body:** `hCsvView=CSV`
**File Format:** CSV
**Code Reference:** `src/sync/asis.ts` line 323 (called per-load)

### Fields (5 total)

| GE Field Name | Type | Our Database Field | Table | Notes |
|---------------|------|-------------------|-------|-------|
| SERIALS | string | `serial`, `ge_serial` | inventory_items | Item serial number |
| MODELS | string | `model`, `ge_model` | inventory_items | Product model |
| QTY | number | `qty`, `ge_inv_qty` | inventory_items | Quantity |
| LOAD NUMBER | string | `sub_inventory` | inventory_items | Load assignment |
| ORDC | string | `ge_ordc` | inventory_items | Order code |

### Usage
- Fetched **per load** to get detailed item list
- Total of ~10 loads × 60 items = ~600 items fetched individually
- Combined with master inventory to catch unassigned items

---

## Endpoint 5: ASIS Master Inventory

**UI Button:** Unknown (discovered via HTML scraping)
**Endpoint:** `POST /dms/downloadExcelSpreadsheet` (multiple fallback attempts)
**Request Body:** `dmsLoc=9SU&subInvLoc=ASIS&invorg=9SU`
**File Format:** XLS
**Code Reference:** `src/sync/asis.ts` line 531 (with fallbacks)

### Fields (5+ total)

| GE Field Name | Type | Our Database Field | Table | Notes |
|---------------|------|-------------------|-------|-------|
| Serial # | string | `serial`, `ge_serial` | inventory_items | Serial number |
| Model # | string | `model`, `ge_model` | inventory_items | Product model |
| Inv Qty | number | `qty`, `ge_inv_qty` | inventory_items | Quantity |
| Availability Status | string | `ge_availability_status` | inventory_items | **"Reserved", "Available", etc.** |
| Availability Message | string | `ge_availability_message` | inventory_items | Status details |

### Key Insight
**This is where we track reservations!**
- `Availability Status: "Reserved"` = item is being held for customer
- Triggers `item_reserved` change event
- Catches items not yet assigned to specific loads

---

## Data Flow & Sync Strategy

### 1. Load Metadata Sync
```
Endpoint 1 (Load List) + Endpoint 3 (Report History)
  ↓ Merge by Load Number
  ↓ Store in load_metadata table
  ✓ Complete load tracking with CSO status
```

### 2. Inventory Items Sync
```
Endpoint 4 (Per-Load Details) × 10 loads
  ↓ Build serial → load mapping
  ↓ Combine with Endpoint 5 (Master Inventory)
  ↓ Store in inventory_items table
  ✓ Complete item tracking with reservations
```

### 3. Change Detection
```
Compare: GE Data ↔ Database
  ↓ Detect changes
  ↓ Log to ge_changes table
  ✓ Historical tracking
```

**Change Types Tracked:**
- `item_appeared` - New item in GE
- `item_disappeared` - Item removed from GE (orphaned)
- `item_reserved` - Availability status → "Reserved"
- `item_status_changed` - Other status changes
- `item_load_changed` - Moved between loads

---

## Field Coverage Analysis

### ✅ Fully Covered
- Load metadata (status, CSO, units, dates)
- Inventory items (serial, model, load assignment)
- Delivery tracking (picked/shipped/delivered)
- Reservations (availability status)

### ⚠️ Partially Covered
- `ge_pricing` - Often incomplete in GE data
- `ge_units` - Sometimes missing from Report History

### ❌ Not Available from GE
- `friendly_name` - **We derive this** from Notes field
- `primary_color` - **User-defined** in our app
- `prep_tagged`, `prep_wrapped` - **User-defined** workflow
- `pickup_date`, `pickup_tba` - **User-defined** scheduling
- `sanity_check_*` - **User-defined** quality control

---

## Database Schema Mapping

### load_metadata Table

| Database Field | GE Source | Endpoint |
|---------------|-----------|----------|
| sub_inventory_name | Load Number | 1, 3, 4 |
| friendly_name | **Derived from Notes** | 1 |
| ge_source_status | Status | 1, 3 |
| ge_cso_status | CSO Status | 3 |
| ge_inv_org | Inv Org | 3 |
| ge_units | Units | 1, 3 |
| ge_submitted_date | Submitted Date | 3 |
| ge_cso | CSO | 3 |
| ge_pricing | Pricing | 3 |
| ge_notes | Notes | 1 |
| ge_scanned_at | Scanned Date/Time | 1 |
| primary_color | **User-defined** | - |
| prep_tagged | **User-defined** | - |
| prep_wrapped | **User-defined** | - |
| pickup_date | **User-defined** | - |
| status | **User-defined** | - |

### inventory_items Table

| Database Field | GE Source | Endpoint |
|---------------|-----------|----------|
| serial | SERIALS / Serial # | 2, 4, 5 |
| model | MODELS / Model # | 2, 4, 5 |
| sub_inventory | LOAD NUMBER | 2, 4 |
| ge_serial | SERIALS (non-synthetic) | 2, 4, 5 |
| ge_model | MODELS / Model # | 2, 4, 5 |
| ge_ordc | ORDC | 2, 4 |
| ge_inv_qty | QTY / Inv Qty | 2, 4, 5 |
| ge_availability_status | Availability Status | 5 |
| ge_availability_message | Availability Message | 5 |
| product_fk | **Lookup from products** | - |
| product_type | **Lookup from products** | - |
| cso | **From load's ge_cso** | 3 |

---

## Change Tracking Examples

### Item Reserved
```json
{
  "change_type": "item_reserved",
  "field_changed": "availability_status",
  "old_value": null,
  "new_value": "Reserved",
  "serial": "MA141869",
  "source": "ASIS"
}
```

### Item Moved Between Loads
```json
{
  "change_type": "item_load_changed",
  "field_changed": "sub_inventory",
  "old_value": "9SU20260122123825",
  "new_value": "9SU20260129142324",
  "serial": "MA141869",
  "source": "ASISLoadDetail"
}
```

### Item Appeared (New)
```json
{
  "change_type": "item_appeared",
  "current_state": {
    "availability_status": "Available",
    "load_number": "9SU20260129142324"
  },
  "serial": "MA141869",
  "source": "ASIS"
}
```

---

## Next Steps for Documentation

### Additional Endpoints to Document
- [ ] FG (Finished Goods) spreadsheet
- [ ] STA (Staged) spreadsheet
- [ ] Individual load detail pages (HTML parsing)
- [ ] Any other export buttons discovered

### Automation Improvements
- [ ] Fix Report History button selector
- [ ] Handle per-load CSV downloads
- [ ] Parse HTML pages for undocumented endpoints
- [ ] Generate database migration diff tool

### Coverage Verification
- [ ] Compare all GE fields to database schema
- [ ] Identify unused GE fields
- [ ] Document field transformation logic
- [ ] Create field mapping diagram

---

## References

- **Sync Code:** `services/ge-sync/src/sync/asis.ts`
- **Endpoints:** `services/ge-sync/src/sync/endpoints.ts`
- **Types:** `services/ge-sync/src/types/index.ts`
- **GE DMS Catalog:** `docs/ge-sync/GE_DMS_PAGES.md`

## Audience Notes

### For Developers
- Treat this as ASIS export field mapping; FG/STA mappings are not complete here.
- Update fields when GE export schemas change.

### For Operators
- This is a technical mapping doc; use the Docs UI for workflow guidance.

### For Agent
- Use only for field mapping questions, not UI instructions.
