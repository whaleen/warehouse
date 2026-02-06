# State Management & Data Freshness Audit

**Date**: 2026-02-06
**Status**: Analysis & Proposal
**Goal**: Establish reliable, real-time data sync across all features

---

## Executive Summary

**Current State**: React Query (TanStack) with manual invalidation, no real-time sync
**Scale**: ~2-3k inventory items (totally cacheable in memory)
**Problem**: Data staleness, inconsistent updates, no live collaboration
**Proposal**: Hybrid React Query + Supabase Realtime architecture

---

## Current Architecture Analysis

### Data Flow (As-Is)

```
GE System (External Truth)
    ↓
GE Sync Process (Updates Supabase)
    ↓
Supabase Database (inventory_items, load_metadata, etc.)
    ↓
React Query (Client Cache)
    ↓
UI Components
```

**Problem**: UI only updates on:
1. Manual refetch
2. Query invalidation after mutations
3. Page reload
4. `staleTime` expiration

**Missing**: Real-time propagation when:
- Another user scans an item
- GE sync updates data
- Custom fields are edited
- Session status changes

---

## Current React Query Usage Audit

### ✅ Well-Implemented Queries

#### 1. `useInventoryScanCounts()` (Map Inventory Panel)
```typescript
// src/hooks/queries/useMap.ts
queryKey: ['inventory-scan-counts-v4', locationId]
staleTime: 0  // Always refetch
gcTime: 0     // Don't cache
```
**Good**: Forces fresh data
**Bad**: No real-time, requires manual invalidation

#### 2. `useProductLocations()` (Map Markers)
```typescript
queryKey: ['product-locations', locationId]
// No staleTime set (defaults to 0)
```
**Good**: Fresh on mount
**Bad**: Doesn't update when other users scan

#### 3. `useSessionSummaries()` (Session Lists)
```typescript
queryKey: ['sessions', 'summaries', locationId, companyId]
// Invalidated after session mutations
```
**Good**: Updates after actions
**Bad**: No live session status changes

#### 4. `useDataQuality()` (Dashboard)
```typescript
staleTime: 5 * 60 * 1000  // 5 minutes
refetchInterval: 60 * 1000  // Refresh every minute
```
**Good**: Polling keeps it fresh
**Bad**: Polling is inefficient, not truly real-time

### ❌ Inconsistent Patterns

**Cache Invalidation Scatter**:
```typescript
// Sometimes done:
queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });

// Sometimes forgotten:
// (mutations that don't invalidate related queries)
```

**Varying staleTime**:
- Some queries: `staleTime: 0` (always fresh)
- Some queries: `staleTime: 5 minutes` (can be stale)
- Some queries: Not set (defaults to 0)

**No Coordination**:
- Each component decides when to refetch
- No global "data updated" event
- No optimistic updates

---

## Data Dependencies Map

### Core Data Tables

```
inventory_items (PRIMARY SOURCE)
    ↓
├─ product_location_history (scan positions)
├─ scanning_sessions (session tracking)
├─ load_metadata (ASIS load info)
└─ products (catalog enrichment)
```

### UI Dependencies

**Map View** needs:
- `inventory_items` (for counts)
- `product_location_history` (for markers)
- `scanning_sessions` (for active session)
- `load_metadata` (for load names/colors)

**Dashboard** needs:
- `inventory_items` (for counts)
- `scanning_sessions` (for session stats)
- `product_location_history` (for scan counts)
- `ge_changes` (for data quality)

**Sessions View** needs:
- `scanning_sessions` (for session list)
- `inventory_items` (for total counts)
- `product_location_history` (for scanned counts)

**Scanner** needs:
- `inventory_items` (to find items)
- `scanning_sessions` (for active session)
- `product_location_history` (to log scans)

---

## Pain Points Identified

### 1. 🔴 No Real-Time Collaboration
**Problem**: User A scans item → User B doesn't see it until refetch
**Impact**: Teams can't coordinate, duplicate work, confusion
**Example**: Two users scanning same load, no visibility

### 2. 🔴 GE Sync Data Lag
**Problem**: GE sync updates database → UI shows stale data
**Impact**: Users see outdated inventory, wrong counts
**Example**: Load delivered in GE, still shows "active" in app for 5 minutes

### 3. 🔴 Inconsistent Invalidation
**Problem**: Some mutations invalidate queries, some don't
**Impact**: Stale data after actions, requires page reload
**Example**: Scan item → map doesn't update → user confused

### 4. 🟡 Over-Fetching
**Problem**: Each component fetches entire datasets independently
**Impact**: Multiple identical queries, network waste
**Example**: Dashboard + Map both fetch `inventory_items` separately

### 5. 🟡 No Optimistic Updates
**Problem**: Actions show loading state until server responds
**Impact**: Feels slow, no immediate feedback
**Example**: Scan item → wait 500ms → see marker appear

### 6. 🟡 Custom Fields Not Integrated
**Problem**: Custom field updates don't propagate
**Impact**: Edits don't reflect across views
**Example**: Update load color → map doesn't change until reload

---

## Proposed Architecture: Hybrid Real-Time

### Core Concept

**React Query**: Initial data loading, optimistic updates, mutations
**Supabase Realtime**: Live updates from database changes
**Integration**: Realtime events update React Query cache

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│              Supabase Database                  │
│  (inventory_items, sessions, locations, etc.)  │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴──────────┐
       │                  │
   PostgreSQL         Realtime
    Changes          Broadcast
       │                  │
       │                  ▼
       │         ┌─────────────────┐
       │         │ Supabase Client │
       │         │  (Subscriptions)│
       │         └────────┬─────────┘
       │                  │
       ▼                  ▼
┌──────────────────────────────────┐
│      React Query Cache           │
│  ┌────────────────────────────┐  │
│  │ inventory-items (global)   │  │
│  │ product-locations          │  │
│  │ sessions                   │  │
│  │ load-metadata              │  │
│  └────────────────────────────┘  │
└──────────────┬───────────────────┘
               │
               ▼
         UI Components
    (auto-update on cache change)
```

### Key Principles

1. **Single Source of Truth**: React Query cache
2. **Real-Time Sync**: Supabase subscriptions keep cache fresh
3. **Optimistic Updates**: Immediate UI feedback
4. **Smart Invalidation**: Related queries update together
5. **Global Inventory State**: One query, many consumers

---

## Implementation Strategy

### Phase 1: Consolidate Inventory Queries (Week 1)

**Goal**: Single global inventory query

#### Create Global Inventory Hook

```typescript
// src/hooks/queries/useGlobalInventory.ts
export function useGlobalInventory() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['inventory', 'global', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, products(*)')
        .eq('location_id', locationId);

      if (error) throw error;

      // Apply ASIS/STA deduplication
      return deduplicateAsisStaItems(data);
    },
    staleTime: Infinity, // Never goes stale (updated via realtime)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    enabled: !!locationId,
  });
}
```

#### Derive Specific Data

```typescript
// src/hooks/queries/useInventoryCounts.ts
export function useInventoryCounts() {
  const { data: inventory } = useGlobalInventory();

  return useMemo(() => {
    if (!inventory) return null;

    // Count by load
    const loadCounts = inventory
      .filter(item => item.sub_inventory)
      .reduce((acc, item) => {
        const key = `load:${item.sub_inventory}`;
        acc.set(key, (acc.get(key) || 0) + 1);
        return acc;
      }, new Map<string, number>());

    // Count by type
    const typeCounts = inventory
      .filter(item => !item.sub_inventory)
      .reduce((acc, item) => {
        const key = `type:${item.inventory_type}`;
        acc.set(key, (acc.get(key) || 0) + 1);
        return acc;
      }, new Map<string, number>());

    return { loadCounts, typeCounts };
  }, [inventory]);
}
```

**Benefits**:
- Fetch once, use everywhere
- Consistent data across UI
- Easy to add computed values
- No redundant queries

---

### Phase 2: Add Supabase Realtime (Week 2)

**Goal**: Live updates when data changes

#### Setup Realtime Provider

```typescript
// src/context/RealtimeContext.tsx
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  useEffect(() => {
    if (!locationId) return;

    // Subscribe to inventory_items changes
    const inventoryChannel = supabase
      .channel(`inventory:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'inventory_items',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('Inventory change:', payload);

          // Invalidate global inventory query
          queryClient.invalidateQueries({
            queryKey: ['inventory', 'global', locationId],
          });
        }
      )
      .subscribe();

    // Subscribe to product_location_history (scan events)
    const scanChannel = supabase
      .channel(`scans:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'product_location_history',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('New scan:', payload);

          // Invalidate map locations
          queryClient.invalidateQueries({
            queryKey: ['product-locations', locationId],
          });

          // Invalidate scan counts
          queryClient.invalidateQueries({
            queryKey: ['inventory-scan-counts-v4', locationId],
          });
        }
      )
      .subscribe();

    // Subscribe to session changes
    const sessionChannel = supabase
      .channel(`sessions:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scanning_sessions',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          console.log('Session change:', payload);

          queryClient.invalidateQueries({
            queryKey: ['sessions'],
          });
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      inventoryChannel.unsubscribe();
      scanChannel.unsubscribe();
      sessionChannel.unsubscribe();
    };
  }, [locationId, queryClient]);

  return children;
}
```

#### Add to App

```typescript
// src/App.tsx
<RealtimeProvider>
  <AuthenticatedApp />
</RealtimeProvider>
```

**Benefits**:
- Automatic updates when data changes
- Real-time collaboration
- No polling needed
- Consistent across all users

---

### Phase 3: Optimistic Updates (Week 3)

**Goal**: Immediate UI feedback

#### Example: Optimistic Scan

```typescript
// src/hooks/mutations/useScanItem.ts
export function useScanItem() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async (params: ScanParams) => {
      const result = await logProductLocation(params);
      if (!result.success) throw result.error;
      return result;
    },

    // Optimistic update
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['product-locations', locationId],
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData([
        'product-locations',
        locationId,
      ]);

      // Optimistically update cache
      queryClient.setQueryData(
        ['product-locations', locationId],
        (old: ProductLocation[] = []) => [
          ...old,
          {
            id: 'temp-' + Date.now(), // Temporary ID
            raw_lat: params.raw_lat,
            raw_lng: params.raw_lng,
            product_type: params.product_type,
            scanned_at: new Date().toISOString(),
            scanned_by: params.scanned_by,
            // ... other fields
          },
        ]
      );

      return { previous };
    },

    // Rollback on error
    onError: (err, params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['product-locations', locationId],
          context.previous
        );
      }
    },

    // Refetch to get real data
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['product-locations', locationId],
      });
    },
  });
}
```

**Benefits**:
- Instant feedback
- Feels fast and responsive
- Automatic rollback on error
- Real data replaces optimistic data

---

### Phase 4: Custom Fields Integration (Week 4)

**Goal**: Propagate custom field changes

#### Custom Fields Table

```sql
-- If not already exists
CREATE TABLE custom_inventory_fields (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) NOT NULL,

  -- Custom fields
  notes text,
  priority integer,
  custom_tags text[],
  warehouse_location text,
  condition_notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Realtime enabled
ALTER TABLE custom_inventory_fields REPLICA IDENTITY FULL;
```

#### Hook for Custom Fields

```typescript
export function useUpdateCustomFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      itemId: string;
      fields: Partial<CustomFields>;
    }) => {
      const { data, error } = await supabase
        .from('custom_inventory_fields')
        .upsert({
          inventory_item_id: params.itemId,
          ...params.fields,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return data;
    },

    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
```

**Benefits**:
- Custom fields tracked separately
- Updates propagate via Realtime
- Doesn't interfere with GE sync data
- Easy to query/filter

---

## Cache Invalidation Strategy

### Smart Invalidation Rules

**When `inventory_items` changes**:
```typescript
queryClient.invalidateQueries({ queryKey: ['inventory'] });
queryClient.invalidateQueries({ queryKey: ['inventory-scan-counts'] });
queryClient.invalidateQueries({ queryKey: ['data-quality'] });
```

**When `product_location_history` changes**:
```typescript
queryClient.invalidateQueries({ queryKey: ['product-locations'] });
queryClient.invalidateQueries({ queryKey: ['inventory-scan-counts'] });
```

**When `scanning_sessions` changes**:
```typescript
queryClient.invalidateQueries({ queryKey: ['sessions'] });
```

**When `load_metadata` changes**:
```typescript
queryClient.invalidateQueries({ queryKey: ['loads'] });
queryClient.invalidateQueries({ queryKey: ['map-metadata'] });
```

### Centralized Invalidation Helper

```typescript
// src/lib/cacheInvalidation.ts
export const invalidationGroups = {
  inventory: () => [
    { queryKey: ['inventory'] },
    { queryKey: ['inventory-scan-counts'] },
    { queryKey: ['data-quality'] },
  ],

  scans: () => [
    { queryKey: ['product-locations'] },
    { queryKey: ['inventory-scan-counts'] },
  ],

  sessions: () => [
    { queryKey: ['sessions'] },
  ],

  loads: () => [
    { queryKey: ['loads'] },
    { queryKey: ['map-metadata'] },
  ],
};

export function invalidateGroup(
  queryClient: QueryClient,
  group: keyof typeof invalidationGroups
) {
  const queries = invalidationGroups[group]();
  queries.forEach(query => queryClient.invalidateQueries(query));
}
```

**Usage**:
```typescript
invalidateGroup(queryClient, 'inventory');
```

---

## Performance Considerations

### With ~3k Inventory Items

**Memory Usage**:
- 3000 items × ~2KB each = ~6MB
- Totally fine for modern browsers
- Fast to filter/search in memory

**Network**:
- Initial load: ~6MB (one-time)
- Realtime updates: <1KB per change
- Much better than repeated full fetches

**Rendering**:
- Use virtualization for large lists
- Memoize computed values
- Only re-render changed components

### Optimization Techniques

#### 1. Virtual Scrolling
```typescript
// For large inventory lists
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: inventory.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});
```

#### 2. Memoized Selectors
```typescript
const loadEItems = useMemo(
  () => inventory?.filter(item => item.sub_inventory === '9SU20260203102320'),
  [inventory]
);
```

#### 3. Debounced Updates
```typescript
// Batch rapid realtime events
const debouncedInvalidate = useDebouncedCallback(
  () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  500
);
```

---

## Migration Path

### Week 1: Foundation
- [ ] Create `useGlobalInventory()` hook
- [ ] Migrate Dashboard to use global inventory
- [ ] Test performance with full dataset

### Week 2: Realtime Setup
- [ ] Create `RealtimeProvider`
- [ ] Subscribe to `inventory_items` changes
- [ ] Subscribe to `product_location_history` changes
- [ ] Subscribe to `scanning_sessions` changes
- [ ] Test multi-user scenarios

### Week 3: Optimistic Updates
- [ ] Add optimistic updates to scan mutations
- [ ] Add optimistic updates to session mutations
- [ ] Add optimistic updates to custom field edits
- [ ] Test error rollback

### Week 4: Polish
- [ ] Add custom fields table (if not exists)
- [ ] Migrate all components to new patterns
- [ ] Remove old polling/manual refetch code
- [ ] Performance testing & optimization
- [ ] Documentation

---

## Alternative: Lightweight State (Jotai/Zustand)

If React Query feels too heavy, consider:

```typescript
// Using Jotai
import { atom } from 'jotai';

export const inventoryAtom = atom<InventoryItem[]>([]);
export const sessionAtom = atom<Session | null>(null);

// Supabase subscription updates atoms directly
supabase.channel('inventory').on('postgres_changes', (payload) => {
  setInventory(current => [...current, payload.new]);
});
```

**Pros**:
- Simpler mental model
- Direct state updates
- Less abstraction

**Cons**:
- Lose React Query features (loading states, error handling, retries)
- More manual work
- Not leveraging existing patterns

**Verdict**: Stick with React Query + Realtime (hybrid) for now.

---

## Testing Strategy

### Unit Tests
- Test query hooks in isolation
- Mock Supabase client
- Verify cache updates

### Integration Tests
- Test Realtime event handlers
- Verify optimistic updates + rollback
- Test multi-query invalidation

### E2E Tests (Playwright)
- User A scans → User B sees update
- GE sync completes → UI updates
- Custom field edit → Map updates

---

## Monitoring & Debugging

### DevTools

**React Query DevTools**:
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />
```

**Supabase Realtime Logger**:
```typescript
const channel = supabase.channel('debug', {
  config: { broadcast: { self: true } }
});

channel.on('system', {}, (payload) => {
  console.log('Realtime system event:', payload);
});
```

### Metrics to Track

- Query cache hit rate
- Realtime event frequency
- Invalidation cascade size
- Time to live update (scan → UI update)

---

## Conclusion

### Recommended Approach

✅ **Hybrid Architecture**:
- React Query for data fetching & caching
- Supabase Realtime for live updates
- Global inventory query (single source of truth)
- Optimistic updates for instant feedback

### Expected Outcomes

✅ **Real-time collaboration** - Users see each other's scans
✅ **Fresh data always** - GE sync updates propagate immediately
✅ **Fast UI** - Optimistic updates, no waiting
✅ **Efficient** - Fetch once, use everywhere
✅ **Scalable** - Handles 3k items easily, room to grow

### Next Steps

1. Review this proposal
2. Decide on migration timeline
3. Start with Phase 1 (global inventory query)
4. Incrementally add realtime
5. Measure & optimize

---

**Ready to start implementing?** Let me know which phase to begin with!
