# Real-time UI Audit

**Date**: 2026-02-06
**Context**: Verify all UI components are consuming live data via TanStack Query + Realtime

---

## Executive Summary

✅ **Load metadata queries**: All using TanStack Query hooks
✅ **Real-time subscriptions**: Working via RealtimeProvider
❌ **Bug found**: Map not updating when load custom fields change

**Root cause**: RealtimeProvider invalidates `['loads']` and `['map-metadata']` on load_metadata changes, but **NOT** `['product-locations']` which also needs load metadata.

---

## Architecture Review

### How Custom Fields Flow to UI

```
User edits primary_color in LoadDetailPanel
              ↓
updateLoadMetadata() → UPDATE load_metadata SET primary_color = '...'
              ↓
Postgres triggers Realtime event
              ↓
RealtimeProvider receives load_metadata change
              ↓
Invalidates queries: ['loads'], ['map-metadata']
              ↓
❌ MISSING: Should also invalidate ['product-locations']
              ↓
Map still shows old color (STALE DATA)
```

### Current Invalidation Logic

**File**: `src/context/RealtimeContext.tsx:106-131`

```typescript
// Subscribe to load_metadata changes
const loadChannel = supabase
  .channel(`loads:${locationId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'load_metadata',
    filter: `location_id=eq.${locationId}`,
  }, (payload) => {
    console.log('🚚 Load metadata change:', payload.eventType, payload.new || payload.old);

    queryClient.invalidateQueries({
      queryKey: ['loads'],  // ✅ Invalidates useLoads()
    });

    queryClient.invalidateQueries({
      queryKey: ['map-metadata'],  // ✅ Invalidates useLoadMetadata()
    });

    // ❌ MISSING: Should also invalidate product-locations
    // because getProductLocations() fetches load_metadata.primary_color
  })
```

---

## Component Analysis

### 1. LoadDetailPanel ✅

**File**: `src/components/Inventory/LoadDetailPanel.tsx`

**Query hooks used**:
- ✅ `useLoadDetail()` - Line 42 (gets load items via TanStack Query)
- ✅ `useLoadConflicts()` - Line 46 (gets conflicts via TanStack Query)
- ✅ `useQuery()` - Line 51 (cross-inventory check)

**Direct Supabase usage**:
- Line 56: `supabase.from('inventory_items').select(...)`
  - **Status**: ✅ Acceptable (wrapped in useQuery, invalidated by RealtimeProvider)
  - **Reason**: Query for items in same load but different inventory type (cross-check)

**Real-time behavior**:
- User A edits `friendly_name` → mutation calls `updateLoadMetadata()`
- Realtime event fires → invalidates `['loads']`
- User B's `useLoadDetail()` refetches → sees new friendly_name
- **Verdict**: ✅ Working correctly

---

### 2. LoadManagementView ✅

**File**: `src/components/Inventory/LoadManagementView.tsx`

**Query hooks used**:
- ✅ `useLoads()` - Line 30 (gets all loads via TanStack Query)

**Direct Supabase usage**:
- None

**Derived queries**:
- Lines 50-62: `fetchLoadCounts()` calls `getLoadItemCount()` and `getLoadConflictCount()`
  - **Status**: ⚠️ Triggered on `loadsData` change, but counts fetched directly
  - **Issue**: Count queries not using TanStack Query hooks
  - **Impact**: Counts may be stale after real-time updates

**Real-time behavior**:
- Load metadata changes → Realtime invalidates `['loads']`
- `useLoads()` refetches → triggers `useEffect` on line 64
- `fetchLoadCounts()` re-runs → counts update
- **Verdict**: ✅ Working, but counts could be more efficient with hooks

---

### 3. AsisLoadsWidget ✅

**File**: `src/components/FloorDisplay/widgets/AsisLoadsWidget.tsx`

**Query hooks used**:
- ✅ `useLoads('ASIS')` - Line 93 (gets ASIS loads via TanStack Query)

**Custom fields consumed**:
- Line 149: `friendly_name` or `sub_inventory_name`
- Line 153: `prep_tagged`, `prep_wrapped`
- Line 176: `primary_color` (displayed as colored square)
- Line 181-189: `ge_cso` (formatted with last 4 digits emphasized)
- Line 217: `ge_units`

**Real-time behavior**:
- User edits `prep_tagged` → Realtime invalidates `['loads']`
- `useLoads('ASIS')` refetches → widget shows new checkbox state
- **Verdict**: ✅ Working correctly

---

### 4. WarehouseMapNew ❌ BUG FOUND

**File**: `src/components/Map/WarehouseMapNew.tsx`

**Query hooks used**:
- ✅ `useProductLocations()` - Gets map points via TanStack Query
- ✅ `useLoadMetadata()` - Gets load friendly names for tooltip
- ✅ `useSessionMetadata()` - Gets session names for tooltip

**Custom fields consumed from map points**:
- Line 464: `friendlyName` (from `load_friendly_name`)
- Line 466: `color` (from `load_color`)
- Line 670, 675, 721, 726: `location.load_color` (marker/square color)
- Line 730: `location.load_friendly_name` (tooltip label)

**How load_color is populated**:

**File**: `src/lib/mapManager.ts:272-288`

```typescript
// getProductLocations() fetches load_metadata
const { data: loadMetadata } = await supabase
  .from('load_metadata')
  .select('sub_inventory_name, friendly_name, primary_color')
  .in('sub_inventory_name', loadNames);

// Maps primary_color → load_color for each map point
const loadColor = loadMeta?.primary_color || getLoadColorByName(...);
```

**THE BUG**:

1. Map uses `useProductLocations()` which calls `getProductLocations()`
2. `getProductLocations()` fetches `load_metadata.primary_color` internally
3. TanStack Query caches this with key `['product-locations', locationId]`
4. When user edits `primary_color` in LoadDetailPanel:
   - Realtime event fires for `load_metadata` table
   - RealtimeProvider invalidates `['loads']` and `['map-metadata']`
   - **BUT NOT** `['product-locations', locationId]`
5. Map keeps stale color until manual refresh

**Real-time behavior (BROKEN)**:
- User A edits `primary_color` from red to blue
- User B's map still shows red markers
- Refreshing page fixes it
- **Verdict**: ❌ **BROKEN - Map not updating in real-time**

---

### 5. useAsisOverview ⚠️ COULD BE IMPROVED

**File**: `src/hooks/queries/useAsisOverview.ts`

**Direct Supabase usage**:
- Lines 21-37: Direct queries to `inventory_items` and `load_metadata`
  - **Status**: ⚠️ Wrapped in `useQuery`, but custom cache key
  - **Query key**: `queryKeys.inventory.asisOverview(locationId)`
  - **Issue**: Not invalidated by RealtimeProvider

**What it queries**:
- Total ASIS items
- Unassigned ASIS items
- Load counts by `ge_source_status` and `ge_cso_status`

**Real-time behavior**:
- Load status changes in GE sync → inventory_items updated
- Realtime invalidates `['inventory', 'global', locationId]`
- **BUT NOT** `['inventory', locationId, 'asis-overview']`
- Dashboard stats stay stale
- **Verdict**: ⚠️ Stats only update on page refresh

---

## Query Invalidation Matrix

| Table Change | Current Invalidations | Missing Invalidations |
|--------------|----------------------|----------------------|
| `inventory_items` | ✅ `['inventory', 'global', locationId]`<br>✅ `['inventory-scan-counts-v4', locationId]`<br>✅ `['data-quality']` | ❌ `['inventory', locationId, 'asis-overview']`<br>❌ `['product-locations', locationId]` |
| `load_metadata` | ✅ `['loads']`<br>✅ `['map-metadata']` | ❌ `['product-locations', locationId]` |
| `product_location_history` | ✅ `['product-locations', locationId]`<br>✅ `['inventory-scan-counts-v4', locationId]` | None |
| `scanning_sessions` | ✅ `['sessions']` | None |

---

## Recommended Fixes

### Fix 1: Add product-locations invalidation (HIGH PRIORITY)

**File**: `src/context/RealtimeContext.tsx`

**Line**: 124 (after existing invalidations)

```typescript
// Subscribe to load_metadata changes
const loadChannel = supabase
  .channel(`loads:${locationId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'load_metadata',
    filter: `location_id=eq.${locationId}`,
  }, (payload) => {
    console.log('🚚 Load metadata change:', payload.eventType, payload.new || payload.old);

    queryClient.invalidateQueries({
      queryKey: ['loads'],
    });

    queryClient.invalidateQueries({
      queryKey: ['map-metadata'],
    });

    // FIX: Invalidate product-locations because getProductLocations()
    // fetches load_metadata.primary_color and friendly_name
    queryClient.invalidateQueries({
      queryKey: ['product-locations', locationId],
    });
  })
```

**Impact**: Map markers will update color in real-time when user edits `primary_color`

---

### Fix 2: Add asis-overview invalidation (MEDIUM PRIORITY)

**File**: `src/context/RealtimeContext.tsx`

**Line**: 45 (inside inventory_items handler)

```typescript
// Subscribe to inventory_items changes
const inventoryChannel = supabase
  .channel(`inventory:${locationId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'inventory_items',
    filter: `location_id=eq.${locationId}`,
  }, (payload) => {
    console.log('📦 Inventory change:', payload.eventType, payload.new || payload.old);

    queryClient.invalidateQueries({
      queryKey: ['inventory', 'global', locationId],
    });

    queryClient.invalidateQueries({
      queryKey: ['inventory-scan-counts-v4', locationId],
    });

    queryClient.invalidateQueries({
      queryKey: ['data-quality'],
    });

    // FIX: Invalidate ASIS overview stats
    queryClient.invalidateQueries({
      queryKey: ['inventory', locationId, 'asis-overview'],
    });
  })
```

**Impact**: Dashboard stats (total items, on-floor loads) update in real-time

---

### Fix 3: Convert load counts to TanStack Query hooks (LOW PRIORITY)

**Current**: `LoadManagementView` fetches counts in `useEffect`

**Better**: Create hooks in `src/hooks/queries/useLoads.ts`

```typescript
export function useLoadItemCount(inventoryType: InventoryType, subInventoryName: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.count(locationId ?? 'none', inventoryType, subInventoryName),
    queryFn: () => getLoadItemCount(inventoryType, subInventoryName),
    select: (data) => data.count,
    enabled: !!locationId && !!subInventoryName,
  });
}

export function useLoadConflictCount(inventoryType: InventoryType, loadNumber: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.loads.conflictCount(locationId ?? 'none', inventoryType, loadNumber),
    queryFn: () => getLoadConflictCount(inventoryType, loadNumber),
    select: (data) => data.count,
    enabled: !!locationId && !!loadNumber,
  });
}
```

**Then**: Add invalidation in RealtimeProvider

```typescript
// When load_metadata changes, invalidate counts
queryClient.invalidateQueries({
  queryKey: ['loads', locationId], // Invalidates all load queries including counts
});
```

**Impact**: Counts update automatically, no manual refetch needed

---

## Testing Plan

### Test 1: Map color updates

1. Open map in Browser A
2. Open LoadDetailPanel in Browser B
3. Change `primary_color` in Browser B
4. **Expected**: Map markers in Browser A change color within 1 second
5. **Before fix**: Map stays stale
6. **After fix**: Map updates in real-time

### Test 2: Dashboard stats updates

1. Open Dashboard in Browser A
2. Run GE sync (adds/removes ASIS items)
3. **Expected**: "Total Items" and "On-Floor Loads" counts update within 1 second
4. **Before fix**: Stats stay stale until refresh
5. **After fix**: Stats update in real-time

### Test 3: Prep flags update

1. Open AsisLoadsWidget in Browser A (floor display)
2. Open LoadDetailPanel in Browser B
3. Check `prep_tagged` in Browser B
4. **Expected**: Widget in Browser A shows checkmark within 1 second
5. **Status**: ✅ Already working (verified via code audit)

---

## Summary

### Components Consuming Custom Fields

| Component | Custom Fields Used | Real-time Status |
|-----------|-------------------|------------------|
| LoadDetailPanel | All fields (editing UI) | ✅ Working |
| LoadManagementView | friendly_name, primary_color, status | ✅ Working |
| AsisLoadsWidget | friendly_name, primary_color, prep_*, pickup_date, ge_cso, ge_units | ✅ Working |
| WarehouseMapNew | primary_color → load_color, friendly_name → load_friendly_name | ❌ **BROKEN** |
| Dashboard (useAsisOverview) | ge_source_status, ge_cso_status (for counts) | ⚠️ Not invalidated |

### Bugs Found

1. **HIGH**: Map not updating when `primary_color` or `friendly_name` changes
2. **MEDIUM**: Dashboard stats not updating when inventory changes

### Fixes Required

1. Add `['product-locations', locationId]` invalidation to load_metadata handler
2. Add `['inventory', locationId, 'asis-overview']` invalidation to inventory_items handler

**Estimated fix time**: 5 minutes

---

## Implementation

Ready to apply fixes? Both are simple one-line additions to `RealtimeContext.tsx`.
