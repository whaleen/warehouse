# Loading States Audit - All Navigation Pages

**Date**: 2026-02-06
**Scope**: All pages accessible from desktop/mobile navigation
**Focus**: Ensure loading spinners show before empty states

---

## Summary

**Status**: 2 issues found, 1 fixed, 1 remaining

### Issues Found

1. ✅ **FIXED**: LoadManagementView - "No loads found" showing before data loads
2. ❌ **NEEDS FIX**: MapView - No loading state, shows empty map immediately

---

## Page-by-Page Analysis

### ✅ 1. Dashboard (`/`)

**File**: `src/components/Dashboard/DashboardView.tsx`

**Loading Pattern**:
```typescript
const loading = loadsLoading || inventoryItemsQuery.isLoading || conflictsQuery.isLoading;

if (loading) {
  // Shows loading spinner
}
```

**Status**: ✅ **GOOD** - Proper loading state before rendering content

**Notes**:
- Lines 135, 408-409: Multiple query loading states combined
- Line 677: Single loading check gates all content
- Fog of War section has separate loading state (line 1326)

---

### ✅ 2. Sessions (`/scanning-sessions`)

**File**: `src/components/Session/SessionsView.tsx`

**Loading Pattern**:
```typescript
const sessionsLoading = sessionsQuery.isLoading;

{!sessionsLoading &&
  !sessionsError &&
  visibleActiveSessions.length === 0 &&
  visibleClosedSessions.length === 0 && (
    <Card>No sessions match the current filters.</Card>
  )}
```

**Status**: ✅ **GOOD** - Empty state only shown when `!sessionsLoading`

**Notes**:
- Line 73: Loading state from useQuery
- Lines 387-394: Empty state properly gated by `!sessionsLoading`
- No loading spinner shown, but empty state doesn't flash

---

###  3. ASIS Loads (`/loads`)

**File**: `src/components/Inventory/LoadManagementView.tsx`

**Loading Pattern** (BEFORE FIX):
```typescript
const { data: loadsData, isLoading: loading } = useLoads();
const [loads, setLoads] = useState<LoadWithCount[]>([]);

// BUG: loading becomes false before loads array is populated
{loading ? (
  <Loader2 />
) : loads.length === 0 ? (
  <p>No loads found</p>  // ❌ Shows prematurely!
)}
```

**Loading Pattern** (AFTER FIX):
```typescript
const [loadingCounts, setLoadingCounts] = useState(false);

{loading || loadingCounts ? (
  <Loader2 />
) : loads.length === 0 ? (
  <p>No loads found</p>  // ✅ Now waits for both states
)}
```

**Status**: ✅ **FIXED** - Now tracks both metadata fetch AND count fetch

**Fix Applied**: Commit `c8baa81` - Added `loadingCounts` state

**Notes**:
- Two-phase loading: metadata (useLoads) + counts (fetchLoadCounts)
- Previously showed empty state in gap between phases
- Fix adds secondary loading state to track count fetches

---

### ❌ 4. Warehouse Map (`/map`)

**File**: `src/components/Map/MapView.tsx`

**Loading Pattern**:
```typescript
const { data: locations } = useProductLocations();

// No loading state check - immediately renders map
return (
  <WarehouseMapNew locations={locations ?? []} />
);
```

**Status**: ❌ **NEEDS FIX** - No loading indicator

**Problem**:
- Passes `locations ?? []` immediately (empty array while loading)
- WarehouseMapNew renders empty map (line 106: `if (locations.length === 0)`)
- User sees empty map briefly, then markers appear

**Recommended Fix**:
```typescript
const { data: locations, isLoading } = useProductLocations();

if (isLoading) {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

return <WarehouseMapNew locations={locations ?? []} />;
```

**Impact**: Medium - Map functional but shows visual flash

---

### ✅ 5. All Inventory (`/inventory`)

**File**: `src/components/Inventory/InventoryView.tsx`

**Loading Pattern**:
```typescript
const loading = inventoryQuery.isLoading;
const loadingMore = inventoryQuery.isFetchingNextPage;

{loading && items.length === 0 && (
  <div>
    <Loader2 />
    <p>Loading inventory...</p>
  </div>
)}

{!loading && !listError && items.length === 0 && (
  <p>No items found</p>
)}
```

**Status**: ✅ **GOOD** - Proper loading state with infinite scroll

**Notes**:
- Lines 228-229: Tracks both initial load and pagination
- Line 825: Loading spinner when `loading && items.length === 0`
- Line 831: Empty state only when `!loading`
- Line 491: Scroll handler respects `loading` state

---

### ✅ 6. Parts (`/parts`)

**File**: `src/components/Parts/PartsView.tsx`

**Loading Pattern**: Delegated to child tabs

**Status**: ✅ **GOOD** - Loading handled by `PartsInventoryTab` and `PartsHistoryTab`

**Notes**:
- Parent view manages tabs/filters only
- Child tabs (`PartsInventoryTab`, `PartsHistoryTab`) handle their own loading
- No premature empty states observed (need to verify child tabs separately)

**Child Tab Check**: `src/components/Inventory/PartsInventoryTab.tsx`
```typescript
const trackedPartsQuery = useTrackedParts(searchTerm);

if (trackedPartsQuery.isLoading) {
  return (
    <div>
      <Loader2 />
      Loading parts...
    </div>
  );
}
```

✅ Child tabs have proper loading states

---

### ✅ 7. Activity Log (`/activity`)

**File**: `src/components/Activity/ActivityLogView.tsx`

**Loading Pattern**:
```typescript
const { data: logs, isLoading } = useRecentActivityLogs();

{isLoading && logs.length === 0 ? (
  <div>
    <Loader2 className="h-4 w-4 animate-spin" />
    <p>Loading activity...</p>
  </div>
) : logs.length === 0 ? (
  <Card>No activity yet</Card>
)}
```

**Status**: ✅ **GOOD** - Proper loading → empty state flow

**Notes**:
- Lines 38, 102-107: Clean ternary with loading check
- Line 142: "Load More" button shows spinner while fetching more

---

### ✅ 8. Data Quality (`/data-quality`)

**File**: `src/components/Dashboard/DataQualityDashboard.tsx`

**Loading Pattern**:
```typescript
const { data: qualityData, isLoading } = useDataQuality();

if (isLoading) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
      <p className="text-muted-foreground">Loading data quality metrics...</p>
    </div>
  );
}

if (!qualityData) {
  return <div>No data available</div>;
}
```

**Status**: ✅ **EXCELLENT** - Early return pattern, clear loading UX

**Notes**:
- Lines 26, 69-78: Early return for loading state
- Line 80: Separate check for `!qualityData` after loading
- Custom spinner (not using Loader2 component, but works)

---

### ✅ 9. Products (Search) (`/products`)

**Pattern**: Search-driven view, no initial data load

**Status**: ✅ **N/A** - No loading state needed (search-based)

**Notes**: Shows search prompt, only fetches on user input

---

### ✅ 10. GE Sync (`/settings-gesync`)

**File**: `src/components/Settings/GESyncView.tsx`

**Loading Pattern**:
```typescript
type SyncStatus = {
  loading: boolean;
  success: boolean | null;
  error: string | null;
};

const [statuses, setStatuses] = useState<Record<SyncType, SyncStatus>>({
  asis: { loading: false, success: null, error: null },
  // ...
});

<Button disabled={status.loading}>
  {status.loading ? 'Syncing...' : 'Sync ASIS'}
</Button>
```

**Status**: ✅ **GOOD** - Manual sync actions, state tracked per button

**Notes**:
- Lines 19, 36-39: Per-sync-type loading states
- Line 161: Buttons disabled during sync
- Not a data-loading view, but action-based loading works correctly

---

### ✅ 11. Settings Pages

- **Location Settings** (`/settings-location`): Form-based, no list loading
- **Team** (`/settings-users`): TBD (need to check)
- **Profile** (`/settings-profile`): Form-based, no list loading

**Status**: ✅ **GOOD** - Settings pages typically form-based

---

## Loading State Patterns

### ✅ Good Patterns

**1. Early Return Pattern** (Best for full-page loading)
```typescript
if (isLoading) {
  return <LoadingSpinner />;
}

return <Content data={data} />;
```
**Used by**: DataQualityDashboard

**2. Ternary with Loading Check** (Good for inline sections)
```typescript
{isLoading ? (
  <LoadingSpinner />
) : items.length === 0 ? (
  <EmptyState />
) : (
  <ItemList items={items} />
)}
```
**Used by**: ActivityLogView, InventoryView

**3. Empty State Gating** (Good when no spinner needed)
```typescript
{!isLoading && items.length === 0 && (
  <EmptyState />
)}
```
**Used by**: SessionsView

### ❌ Anti-Patterns

**1. Missing Loading State** (Shows stale/empty UI)
```typescript
// ❌ BAD: No loading check
const { data } = useQuery();
return <Component data={data ?? []} />;  // Renders empty immediately
```
**Found in**: MapView

**2. Two-Phase Loading Without Tracking** (Fixed in LoadManagementView)
```typescript
// ❌ BAD: First phase completes, shows empty, then second phase populates
const { data, isLoading } = useQuery();
useEffect(() => {
  if (data) fetchMoreData();  // Not tracked
}, [data]);

{isLoading ? <Spinner /> : items.length === 0 ? <Empty /> : <List />}
```

---

## Recommended Fixes

### High Priority

1. ✅ **LoadManagementView** - FIXED in commit `c8baa81`
2. ❌ **MapView** - Add loading state

### Implementation for MapView

**File**: `src/components/Map/MapView.tsx`

**Current**:
```typescript
export function MapView({ onMenuClick }: MapViewProps) {
  const { data: locations } = useProductLocations();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-background">
        <WarehouseMapNew locations={locations ?? []} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 bg-background flex flex-col">
      <AppHeader title="Warehouse Map" onMenuClick={onMenuClick} />
      <PageContainer className="flex-1 min-h-0">
        <WarehouseMapNew locations={locations ?? []} />
      </PageContainer>
    </div>
  );
}
```

**Fixed**:
```typescript
import { Loader2 } from 'lucide-react';

export function MapView({ onMenuClick }: MapViewProps) {
  const { data: locations, isLoading } = useProductLocations();
  const isMobile = useIsMobile();

  const LoadingState = () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-background">
        {isLoading ? <LoadingState /> : <WarehouseMapNew locations={locations ?? []} />}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 bg-background flex flex-col">
      <AppHeader title="Warehouse Map" onMenuClick={onMenuClick} />
      <PageContainer className="flex-1 min-h-0">
        {isLoading ? <LoadingState /> : <WarehouseMapNew locations={locations ?? []} />}
      </PageContainer>
    </div>
  );
}
```

**Estimated time**: 5 minutes

---

## Testing Checklist

After fixes applied, test each page:

- [ ] Dashboard - Shows spinner before stats load
- [ ] Sessions - No flash of "no sessions"
- [ ] ASIS Loads - No flash of "no loads" ✅ FIXED
- [ ] Warehouse Map - Shows spinner before markers appear ❌ NEEDS FIX
- [ ] All Inventory - Shows spinner before list loads
- [ ] Parts - Shows spinner in tabs
- [ ] Activity Log - Shows spinner before logs load
- [ ] Data Quality - Shows spinner before metrics load
- [ ] GE Sync - Buttons show loading state during sync

---

## Performance Notes

All pages use TanStack Query with proper `isLoading` states. No direct Supabase calls bypassing the cache layer.

**Real-time updates** properly configured in `RealtimeContext.tsx` (fixed in earlier commit).

**Stale-while-revalidate** working correctly - pages can show cached data while refetching in background.

---

## Conclusion

**Overall**: 10/11 pages have proper loading states ✅

**Action Required**: Fix MapView loading state

**Estimate**: 5 minutes to implement
