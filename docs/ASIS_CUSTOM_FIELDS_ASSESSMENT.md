# ASIS Custom Fields System Assessment

**Date**: 2026-02-06
**Context**: Existing implementation review and refinement opportunities

---

## Executive Summary

You **already have a working custom fields system** implemented via the `load_metadata` table. This assessment documents what exists, how it works, and opportunities for refinement.

---

## Architecture Overview

### The Dual-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                     load_metadata table                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 1: GE Sync Data (Read-only from GE)                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  • ge_source_status      (FROM GE: Load status)             │
│  • ge_cso_status         (FROM GE: CSO status)              │
│  • ge_inv_org            (FROM GE: Inventory org)           │
│  • ge_units              (FROM GE: Unit count)              │
│  • ge_submitted_date     (FROM GE: Submission date)         │
│  • ge_cso                (FROM GE: CSO number)              │
│  • ge_pricing            (FROM GE: Pricing info)            │
│  • ge_notes              (FROM GE: Original notes)          │
│  • ge_scanned_at         (FROM GE: Scan timestamp)          │
│                                                               │
│  Layer 2: Custom Warehouse Fields (User-managed)            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  • friendly_name         (UI: "A", "B", "Letter C")         │
│  • primary_color         (UI: Color picker #E53935)         │
│  • prep_tagged           (UI: Boolean checkbox)             │
│  • prep_wrapped          (UI: Boolean checkbox)             │
│  • pickup_date           (UI: Date picker)                  │
│  • pickup_tba            (UI: Boolean - TBA flag)           │
│  • category              (UI: "Salvage" or null)            │
│  • notes                 (UI: Custom text notes)            │
│  • sanity_check_*        (UI: Workflow tracking)            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Critical Design Principle

**GE sync NEVER touches custom fields. Custom fields NEVER touch GE fields.**

See `services/ge-sync/src/sync/asis.ts:1105-1247` - the sync function:
1. Fetches GE data
2. Updates only `ge_*` columns in existing records
3. Preserves all custom fields during merge

---

## Current Custom Fields (By Category)

### 1. Visual Organization

#### `friendly_name` (string)
- **Purpose**: Human-readable load identifier
- **Examples**: "A", "B", "Letter C", "12/15", "3RD"
- **Auto-derivation**: Parsed from `ge_notes` if matches pattern (see line 255-276 in LoadDetailPanel)
- **UI**: Text input with validation (1-2 uppercase letters only for ASIS)
- **Uniqueness**: Enforced within last 20 loads to prevent confusion
- **File**: `src/components/Inventory/LoadDetailPanel.tsx:961-966`

#### `primary_color` (hex string)
- **Purpose**: Visual color coding for loads on map/lists
- **Options**: 12 color wheel options (Red, Orange, Yellow, Green, Blue, Violet, etc.)
- **Storage**: Hex format (e.g., `#E53935`)
- **UI**: Color picker with predefined palette
- **File**: `src/components/Inventory/LoadDetailPanel.tsx:980-1009`

### 2. Workflow Tracking

#### `prep_tagged` (boolean)
- **Purpose**: Track if load items have been physically tagged
- **UI**: Checkbox with instant save
- **File**: `src/components/Inventory/LoadDetailPanel.tsx:804-807`

#### `prep_wrapped` (boolean)
- **Purpose**: Track if load items have been wrapped/protected
- **UI**: Checkbox with instant save
- **File**: `src/components/Inventory/LoadDetailPanel.tsx:808-811`

#### `pickup_date` (date)
- **Purpose**: Scheduled customer pickup date
- **UI**: Date input field
- **File**: `src/components/Inventory/LoadDetailPanel.tsx:833-841`

#### `pickup_tba` (boolean)
- **Purpose**: Pickup date "to be announced" flag
- **Storage**: Boolean in database
- **UI**: Not currently exposed in UI (candidate for addition)

### 3. Quality Control Workflow

#### Sanity Check System (5 fields)
- `sanity_check_requested` (boolean) - Flag that check is needed
- `sanity_check_requested_at` (timestamp) - When requested
- `sanity_check_requested_by` (string) - Who requested
- `sanity_check_completed_at` (timestamp) - When completed
- `sanity_check_completed_by` (string) - Who completed

**Workflow**:
1. User clicks "Request Sanity Check" → Sets requested fields
2. Another user performs physical count/verification
3. User clicks "Complete" → Sets completed fields
4. Both actions logged to activity_log table

**File**: `src/components/Inventory/LoadDetailPanel.tsx:545-611`

### 4. Categorization

#### `category` (string)
- **Purpose**: Load categorization (currently "Salvage" or null)
- **ASIS-specific**: Checkbox in UI sets category to "Salvage"
- **File**: `src/components/Inventory/LoadDetailPanel.tsx:1012-1023`

#### `notes` (text)
- **Purpose**: Freeform notes separate from GE notes
- **UI**: Text input with auto-save
- **File**: `src/components/Inventory/LoadDetailPanel.tsx:968-975`

---

## How Sync Preserves Custom Fields

### ASIS Sync Process (Simplified)

```typescript
// services/ge-sync/src/sync/asis.ts:1105-1247

async function syncLoadMetadata(db, companyId, locationId, mergedLoads) {
  // 1. Fetch existing loads from database
  const existingLoads = await db
    .from('load_metadata')
    .select('sub_inventory_name, friendly_name, ge_source_status, ...')
    .eq('inventory_type', 'ASIS');

  // 2. For new loads: Insert GE data (custom fields remain null)
  const newLoads = mergedLoads
    .filter(load => !existingLoads.has(load.loadNumber))
    .map(load => ({
      inventory_type: 'ASIS',
      sub_inventory_name: load.loadNumber,
      friendly_name: derivedFromNotes(load.ge_notes), // Auto-derive
      ge_source_status: load.ge_source_status, // FROM GE
      ge_cso_status: load.ge_cso_status,       // FROM GE
      // ... all other ge_* fields
      // prep_tagged: undefined (NOT TOUCHED)
      // prep_wrapped: undefined (NOT TOUCHED)
      // pickup_date: undefined (NOT TOUCHED)
    }));

  // 3. For existing loads: Update ONLY ge_* fields
  for (const load of mergedLoads) {
    const existing = existingLoads.get(load.loadNumber);
    const updates = {};

    // Only update if GE value changed
    if (load.ge_source_status !== existing.ge_source_status) {
      updates.ge_source_status = load.ge_source_status;
    }
    // ... check all other ge_* fields

    // NEVER includes: prep_tagged, prep_wrapped, pickup_date, etc.
    await db.from('load_metadata').update(updates);
  }
}
```

### Key Insight

The sync process is **GE-field-aware**. It knows which fields come from GE (`ge_*` prefix) and which are user-managed (everything else). This prevents accidental overwrites.

---

## What's Working Well

### ✅ Clean Separation of Concerns
- GE fields prefixed with `ge_*` - easy to identify source of truth
- Custom fields have no prefix - clearly app-managed
- Sync respects boundaries

### ✅ Real-time Updates
- `RealtimeProvider` listens to `load_metadata` changes
- TanStack Query invalidates on update
- UI updates instantly across all users

### ✅ Workflow Automation
- Friendly names auto-derived from GE notes (smart defaults)
- Activity logging for sanity checks
- Auto-save on field changes (debounced 800ms)

### ✅ Type Safety
- TypeScript interfaces define all fields
- Type: `LoadMetadata` in `src/types/inventory.ts:109-143`

### ✅ UI/UX
- Tabbed interface (Work Progress / Load Editor / Details)
- Instant feedback with loading states
- Visual color coding on map markers

---

## Gaps & Opportunities for Refinement

### 1. **Item-Level Custom Fields** (Currently Missing)

**Problem**: Custom fields only exist at load level, not item level.

**Use Case**:
- "This fridge has a dent on the left side" → needs `condition_notes` on the item
- "Needs inspection before sale" → needs `priority` flag on the item
- "Aisle 3, Shelf B" → needs `warehouse_location` on the item

**Current Workaround**: Users must add notes at load level, not item level.

**Proposed Solution**: Add `inventory_item_metadata` table

```sql
CREATE TABLE inventory_item_metadata (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL,

  -- Custom fields for individual items
  warehouse_location text,        -- "Aisle 3, Shelf B"
  condition_notes text,            -- "Slight damage on corner"
  priority integer CHECK (priority BETWEEN 1 AND 5),
  custom_tags text[],              -- ["urgent", "needs-inspection"]
  internal_tracking_number text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  updated_by text,

  CONSTRAINT inventory_item_metadata_unique UNIQUE (inventory_item_id)
);
```

**Implementation Effort**: 3-4 hours
- Migration to create table
- Add metadata panel to `InventoryItemCard`
- Hook up to real-time sync

### 2. **Tag System** (Partially Implemented)

**Current State**:
- `category` field used for single value ("Salvage")
- No true multi-tag support
- Can't filter by multiple categories

**Proposed Enhancement**:
```sql
ALTER TABLE load_metadata
ADD COLUMN custom_tags text[] DEFAULT '{}';
```

**Use Cases**:
- Tag loads: ["urgent", "photo-needed", "customer-waiting"]
- Filter dashboard by tags
- Bulk operations on tagged loads

**Implementation Effort**: 2 hours
- Add column to load_metadata
- Update LoadDetailPanel with tag input
- Add tag filtering to LoadManagementView

### 3. **Documentation** (This Document is a Start)

**Missing**:
- No user-facing documentation explaining custom fields
- No developer guide for adding new custom fields
- No schema diagram showing GE vs custom boundary

**Proposed Additions**:
1. User guide: "How to use custom fields in ASIS loads"
2. Developer guide: "Adding new custom fields safely"
3. Schema diagram (the ASCII art above is a start)

### 4. **Field History/Audit Trail**

**Current State**:
- `activity_log` table tracks high-level actions (load created, sanity check)
- No field-level history (e.g., "friendly_name changed from 'A' to 'B'")

**Use Case**:
- "Who changed the pickup date?"
- "When was this load marked as salvage?"

**Proposed Enhancement**:
```typescript
// Log field changes in activity_log.details
{
  action: 'field_changed',
  entityType: 'ASIS_LOAD',
  entityId: load.sub_inventory_name,
  details: {
    field: 'friendly_name',
    oldValue: 'A',
    newValue: 'B',
    changedAt: '2026-02-06T10:30:00Z',
    changedBy: 'josh',
  }
}
```

**Implementation Effort**: 1 hour
- Enhance `persistPrepUpdate` to log field-level changes
- Update `handleSaveMeta` to include field diffs

### 5. **Bulk Edit Operations**

**Current State**:
- Must edit each load individually
- No way to bulk-update prep_tagged for multiple loads

**Proposed Feature**:
- Multi-select loads in LoadManagementView
- Bulk actions: "Mark all as tagged", "Set pickup date for all"

**Implementation Effort**: 3 hours
- Add multi-select mode to LoadManagementView
- Bulk update API endpoint
- Confirmation dialog

### 6. **Custom Field Templates**

**Current State**:
- Same fields for all ASIS loads
- No per-customer or per-category field variations

**Proposed Feature**:
- Define field sets per category (e.g., "Salvage loads need damage notes")
- Conditional field visibility

**Implementation Effort**: 6+ hours (complex)
- Dynamic form generation
- JSONB column for template definitions
- UI builder for admins

---

## Recommended Next Steps (Prioritized)

### Immediate (1-2 hours each)

1. **Document existing system** ✅ (This document)
2. **Add tag system to loads** - Multi-category support
3. **Field-level audit trail** - Track who changed what

### Short-term (3-4 hours each)

4. **Item-level custom fields** - Most requested feature
5. **Bulk edit operations** - Save time on repetitive tasks

### Long-term (6+ hours)

6. **Custom field templates** - Advanced configurability

---

## How to Add a New Custom Field (Developer Guide)

### Example: Adding `estimated_value` field to loads

**Step 1: Database Migration**

```sql
-- supabase/migrations/20260206_add_estimated_value.sql
ALTER TABLE load_metadata
ADD COLUMN estimated_value numeric;
```

**Step 2: Update TypeScript Types**

```typescript
// src/types/inventory.ts
export interface LoadMetadata {
  // ... existing fields
  estimated_value?: number | null; // ADD THIS
}
```

**Step 3: Update UI (LoadDetailPanel)**

```tsx
// src/components/Inventory/LoadDetailPanel.tsx

// Add state
const [estimatedValue, setEstimatedValue] = useState(0);

// Initialize from load
useEffect(() => {
  setEstimatedValue(load.estimated_value || 0);
}, [load.estimated_value]);

// Add to form
<div className="space-y-2">
  <label>Estimated Value</label>
  <Input
    type="number"
    value={estimatedValue}
    onChange={(e) => setEstimatedValue(Number(e.target.value))}
  />
</div>

// Include in save handler
const updates = {
  estimated_value: estimatedValue || null,
};
```

**Step 4: Update loadManager**

```typescript
// src/lib/loadManager.ts
export async function updateLoadMetadata(
  inventoryType: InventoryType,
  subInventoryName: string,
  updates: {
    // ... existing fields
    estimated_value?: number | null; // ADD THIS
  }
)
```

**Step 5: Test with Real-time**

1. Open load in two browser windows
2. Edit estimated_value in window 1
3. Verify window 2 updates automatically (via RealtimeProvider)

---

## GE Snapshot Strategy

### How It Works

**Every sync**:
1. Fetch latest data from GE API
2. Compare with database state
3. Detect changes (new items, status changes, load moves)
4. Log changes to `ge_changes` table
5. Update database to match GE (for `ge_*` fields only)

**Snapshot Frequency**: Manual trigger or scheduled (cron job)

**Purpose**: Ensure app reflects current GE state while preserving custom data

### What Gets Preserved

- ✅ All custom fields (friendly_name, colors, prep flags, etc.)
- ✅ Activity log history
- ✅ Sanity check workflow state
- ✅ Item-level scan history

### What Gets Updated

- ❌ GE-sourced fields (ge_source_status, ge_cso_status, etc.)
- ❌ Item availability status (ge_availability_status)
- ❌ Load unit counts (ge_units)

---

## Summary

You already have a **well-architected custom fields system**:
- Clean GE/custom boundary via `ge_*` prefix
- Real-time sync working
- Smart auto-derivation of friendly names
- Activity logging for auditing
- Type-safe TypeScript interfaces

**Main gaps**:
1. Item-level custom fields (load-level only currently)
2. Multi-tag support (single category currently)
3. Documentation (this document fills that gap)

**No new table needed** - `load_metadata` is your custom fields table and it's working great. The suggested `inventory_item_metadata` table would be for **item-level** custom fields, which is a separate feature.
