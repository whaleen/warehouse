# TanStack Query Migration Guide

**Status**: Phase 1 Complete + Phase 2/3 partial (17/19 components migrated)
**Last Updated**: 2026-01-31
**Target**: TanStack Query v5

## Overview

This document tracks the migration from manual useState/useEffect data fetching to TanStack Query v5. The migration eliminates duplicate loading states, enables request deduplication, provides automatic caching, and simplifies mutation handling.

## Current Status

### ✅ Completed (Phase 0 - Setup)

**Infrastructure:**
- [x] Dependencies installed (`@tanstack/react-query` v5.90.20, `@tanstack/react-query-devtools` v5.91.2)
- [x] QueryClient provider configured in `src/App.tsx:287`
- [x] ReactQueryDevtools integrated (dev mode only)
- [x] Query key convention established in `src/lib/queryKeys.ts`

**Configuration Details:**
```typescript
// src/App.tsx:32-44
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes (inventory changes slowly)
      gcTime: 1000 * 60 * 30,        // 30 minutes cache retention
      retry: 1,
      refetchOnWindowFocus: false,   // Warehouse kiosks stay open
    },
    mutations: {
      retry: 0,
    },
  },
});
```

**Custom Hooks Created:**
- [x] `src/hooks/queries/useParts.ts` - 8 hooks (parts CRUD + history)
- [x] `src/hooks/queries/useLoads.ts` - 7 hooks (load management)
- [x] `src/hooks/queries/useActivity.ts` - Infinite query for activity log
- [x] `src/hooks/queries/useRealtimeSync.ts` - Realtime subscriptions
- [x] `src/hooks/queries/useInventory.ts` - Inventory item details
- [x] `src/hooks/queries/useMap.ts` - 2 hooks (product locations + genesis point)
- [x] `src/hooks/queries/useProducts.ts` - Product search + upsert
- [x] `src/hooks/queries/useSessions.ts` - Sessions queries + mutations
- [x] `src/hooks/queries/useDisplays.ts` - Display management queries + mutations
- [x] `src/hooks/queries/useSettings.ts` - Locations, companies, users, settings
- [x] `src/hooks/queries/useInventoryImport.ts` - Inventory import mutation hooks
- [x] `src/hooks/queries/useGeSync.ts` - GE sync mutation hooks

### ✅ Completed (Phase 1 - Core Inventory Components)

| Component | File | Changes | Benefits |
|-----------|------|---------|----------|
| ReorderAlertsCard | `src/components/Dashboard/ReorderAlertsCard.tsx` | Replaced 3 state vars with `useReorderAlerts` + `useMarkAsReordered` | Optimistic updates |
| PartsInventoryTab | `src/components/Inventory/PartsInventoryTab.tsx` | Replaced 10+ state vars with query/mutation hooks | Automatic cache invalidation |
| PartsHistoryTab | `src/components/Inventory/PartsHistoryTab.tsx` | Uses `usePartsHistory` + `useTrackedParts` | Dynamic filtering |
| InventoryItemDetailDialog | `src/components/Inventory/InventoryItemDetailDialog.tsx` | Uses `useInventoryItemDetail` | Conditional fetching |
| LoadDetailPanel | `src/components/Inventory/LoadDetailPanel.tsx` | Uses `useLoadDetail` + `useLoadConflicts` | Parallel queries |
| LoadManagementView | `src/components/Inventory/LoadManagementView.tsx` | Uses `useLoads` hook | Request deduplication |
| DashboardView | `src/components/Dashboard/DashboardView.tsx` | Uses `useLoads` + `useActivityRealtime` | Shared cache with LoadManagementView |
| ActivityLogView | `src/components/Activity/ActivityLogView.tsx` | Infinite query + realtime sync | Proper pagination |
| InventoryView | `src/components/Inventory/InventoryView.tsx` | Uses `useInventoryPages` + export/import hooks | Pagination + filters via query cache |

**Key Achievements:**
- **Request Deduplication**: DashboardView and LoadManagementView share load data (1 query instead of 2)
- **Optimistic Updates**: Parts inventory updates are instant with automatic rollback on error
- **Infinite Scroll**: ActivityLogView properly implements pagination with `useInfiniteQuery`
- **Realtime Integration**: Activity logs and inventory sync via `useActivityRealtime` and `useInventoryRealtime`

**InventoryView migration notes:**
- Now uses TanStack Query pagination (`useInventoryPages`) with filter-driven query keys
- Export/import are handled via query-backed hooks (`useInventoryExport`, `useImportInventorySnapshot`, `useNukeInventory`)

### ✅ / ⏳ Phase 2 - Floor Display

| Component | File | Priority | Estimated Hooks Needed |
|-----------|------|----------|------------------------|
| AsisLoadsWidget | `src/components/FloorDisplay/widgets/AsisLoadsWidget.tsx` | Medium | `useLoads` with filters (done) |
| AsisOverviewWidget | `src/components/FloorDisplay/widgets/AsisOverviewWidget.tsx` | Medium | Uses inline `useQuery`; could move to `useLoads`/`useInventory` hook |
| DisplayManager | `src/components/FloorDisplay/DisplayManager.tsx` | Low | Still manual state; needs `useDisplays` hook |
| FloorDisplayView | `src/components/FloorDisplay/FloorDisplayView.tsx` | Medium | Still manual state + Supabase fetch |

### ✅ Completed (Phase 3 - Map Component)

| Component | File | Changes | Benefits |
|-----------|------|---------|----------|
| MapView | `src/components/Map/MapView.tsx` | Uses `useProductLocations` + `useGenesisPoint` | Parallel queries, automatic caching |

### ✅ Completed (Phase 3 - Other Components)

| Component | File | Changes | Benefits |
|-----------|------|---------|----------|
| PartsTrackingDialog | `src/components/Inventory/PartsTrackingDialog.tsx` | Uses `useAvailablePartsToTrack` + `useAddTrackedPart` | Debounced search + cached results |
| SettingsView | `src/components/Settings/SettingsView.tsx` | Uses `useSettings` hooks | Shared cache for admin data |
| ProductEnrichment | `src/components/Products/ProductEnrichment.tsx` | Uses `useProductSearch` + `useUpsertProduct` | Debounced search + cache invalidation |
| CreateSessionView | `src/components/Session/CreateSessionView.tsx` | Uses session + inventory hooks | Cached lists + mutations |
| ScanningSessionView | `src/components/Session/ScanningSessionView.tsx` | Uses session detail + mutation hooks | Cache-backed scans |
| DisplayManager | `src/components/FloorDisplay/DisplayManager.tsx` | Uses `useDisplays` + mutation hooks | Shared cache + refetch |

### ✅ Phase 3 Complete

## Migration Patterns

### Pattern 1: Simple Query Replacement

**Before:**
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetch() {
    setLoading(true);
    const { data, error } = await getData();
    setData(data ?? []);
    setLoading(false);
  }
  fetch();
}, []);
```

**After:**
```typescript
const { data, isLoading: loading } = useTrackedParts();
```

### Pattern 2: Mutation with Optimistic Update

**Before:**
```typescript
const handleUpdate = async (id: string, newValue: number) => {
  const { success } = await updateCount(id, newValue);
  if (success) {
    setData(prev => prev.map(item =>
      item.id === id ? { ...item, count: newValue } : item
    ));
  }
};
```

**After:**
```typescript
const updateMutation = useUpdatePartCount();

const handleUpdate = (productId: string, newQty: number) => {
  updateMutation.mutate({ productId, newQty });
};
```

The mutation hook handles optimistic updates automatically:
```typescript
// In useParts.ts
export function useUpdatePartCount() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: ({ productId, newQty }) => updatePartCount(productId, newQty),

    onMutate: async ({ productId, newQty }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.parts.tracked(locationId) });
      const previous = queryClient.getQueryData(queryKeys.parts.tracked(locationId));

      queryClient.setQueryData(queryKeys.parts.tracked(locationId), (old: any) => {
        if (!old) return old;
        return old.map((part: any) =>
          part.product_id === productId ? { ...part, current_qty: newQty } : part
        );
      });

      return { previous };
    },

    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.parts.tracked(locationId), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
    },
  });
}
```

### Pattern 3: Infinite Query (Pagination)

**Before:**
```typescript
const [items, setItems] = useState([]);
const [page, setPage] = useState(0);

const fetchPage = async (pageNum: number) => {
  const { data } = await supabase
    .from('table')
    .select('*')
    .range(pageNum * 50, (pageNum + 1) * 50 - 1);
  setItems(prev => [...prev, ...data]);
};
```

**After:**
```typescript
const { data, fetchNextPage, hasNextPage } = useActivityLog();
const items = data?.pages.flatMap(page => page.data) ?? [];
```

Hook implementation:
```typescript
// In useActivity.ts
const PAGE_SIZE = 50;

export function useActivityLog() {
  const { locationId } = getActiveLocationContext();

  return useInfiniteQuery({
    queryKey: queryKeys.activity.all(locationId),
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        data: data ?? [],
        nextPage: (data?.length ?? 0) === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}
```

### Pattern 4: Realtime Sync with Cache

**Before:**
```typescript
useEffect(() => {
  const channel = supabase
    .channel('activity-log')
    .on('postgres_changes', { event: 'INSERT' }, (payload) => {
      setItems(prev => [payload.new, ...prev]);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

**After:**
```typescript
// In component
useActivityRealtime();

// In useRealtimeSync.ts
export function useActivityRealtime() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`activity-log-${locationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `location_id=eq.${locationId}`,
      }, (payload) => {
        const newEntry = payload.new;

        // Update infinite query cache
        queryClient.setQueryData(queryKeys.activity.all(locationId), (old: any) => {
          if (!old?.pages) return old;

          const newPages = [...old.pages];
          newPages[0] = {
            ...newPages[0],
            data: [newEntry, ...newPages[0].data],
          };

          return { ...old, pages: newPages };
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [locationId, queryClient]);
}
```

### Pattern 5: Conditional Query (Modal/Dialog)

**Before:**
```typescript
const [item, setItem] = useState(null);

useEffect(() => {
  if (open && itemId) {
    fetchItem();
  }
}, [open, itemId]);
```

**After:**
```typescript
const { data: item } = useInventoryItemDetail(itemId, open);
```

Hook with `enabled` option:
```typescript
export function useInventoryItemDetail(itemId: string, enabled: boolean = true) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['inventory-item', locationId, itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, products:product_fk (*)')
        .eq('id', itemId)
        .eq('location_id', locationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!itemId && !!locationId,
  });
}
```

## Query Key Structure

All query keys follow a hierarchical structure defined in `src/lib/queryKeys.ts`:

```typescript
export const queryKeys = {
  loads: {
    all: (locationId: string) => ['loads', locationId] as const,
    byType: (locationId: string, type: string) => ['loads', locationId, type] as const,
    detail: (locationId: string, type: string, name: string) =>
      ['loads', locationId, type, name] as const,
  },
  parts: {
    tracked: (locationId: string) => ['parts', locationId, 'tracked'] as const,
    alerts: (locationId: string) => ['parts', locationId, 'alerts'] as const,
    history: (locationId: string, productId?: string, days?: number) =>
      ['parts', locationId, 'history', productId, days] as const,
  },
  // ... etc
};
```

**Key principles:**
- Always include `locationId` as the first segment (enables multi-tenant invalidation)
- Use hierarchical structure (enables partial invalidation with prefix matching)
- Use `as const` for type safety
- Optional params go last in the array

## Common Issues & Solutions

### Issue 1: Data is undefined initially

**Problem:** Components crash with `Cannot read property 'map' of undefined`

**Solution:** Always provide fallback values:
```typescript
const { data } = useTrackedParts();
const parts = data ?? []; // Not just 'data'
```

### Issue 2: Stale queries after mutation

**Problem:** Data doesn't update after mutation

**Solution:** Invalidate related queries in `onSettled`:
```typescript
return useMutation({
  mutationFn: updateData,
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.parts.tracked(locationId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.parts.alerts(locationId) });
  },
});
```

### Issue 3: Infinite re-renders

**Problem:** Component re-renders continuously

**Solution:** Check dependency arrays in hooks. TanStack Query hooks are stable and don't need to be in deps:
```typescript
// ❌ Bad
useEffect(() => {
  refetch();
}, [refetch]); // refetch is stable, don't include it

// ✅ Good
useEffect(() => {
  refetch();
}, []); // Or use a trigger state
```

### Issue 4: N+1 query problem

**Problem:** Component fetches item count for each load individually

**Solution:** This is partially solved. LoadManagementView still augments loads with counts. Future optimization:
- Add count to `load_metadata` table (denormalized)
- Or create a DB view that joins counts
- Or use `Promise.all` with parallel queries (current approach)

### Issue 5: Realtime updates duplicate data

**Problem:** Realtime subscription adds duplicate entries

**Solution:** Use unique keys and check before adding:
```typescript
queryClient.setQueryData(queryKeys.activity.all(locationId), (old: any) => {
  if (!old?.pages) return old;

  // Check if entry already exists
  const existsInFirstPage = old.pages[0].data.some((item: any) => item.id === newEntry.id);
  if (existsInFirstPage) return old;

  // Add to first page
  const newPages = [...old.pages];
  newPages[0] = {
    ...newPages[0],
    data: [newEntry, ...newPages[0].data],
  };

  return { ...old, pages: newPages };
});
```

## Next Steps for Continuation

### 1. Create Missing Hooks

Before migrating Phase 2/3 components, create these hooks:

**`src/hooks/queries/useDisplays.ts`:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';

export function useDisplays() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.displays.all(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('floor_displays')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Add mutations: useCreateDisplay, useUpdateDisplay, useDeleteDisplay
```

**`src/hooks/queries/useProducts.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';

export function useProductSearch(searchTerm: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.products.search(searchTerm),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`model.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: enabled && searchTerm.length >= 2,
    staleTime: 1000 * 60 * 10, // Products change infrequently
  });
}
```

**`src/hooks/queries/useSessions.ts`:**
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';

export function useSessions() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.sessions.all(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanning_sessions')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useSessionDetail(sessionId: string) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.sessions.detail(locationId, sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanning_sessions')
        .select('*, scans:scanning_session_scans(*)')
        .eq('id', sessionId)
        .eq('location_id', locationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });
}

// Add useCreateSession, useUpdateSession mutations
```

### 2. Migrate Floor Display Components (Phase 2)

**Priority order:**
1. AsisOverviewWidget - Move inline `useQuery` to a dedicated hook or reuse `useLoads`
2. DisplayManager - Needs new `useDisplays` hook
3. FloorDisplayView - Replace manual Supabase fetch with query hook

### 3. Migrate Secondary Components (Phase 3)

**Priority order:**
All Phase 3 components are migrated.

### 4. Optimize InventoryView (Post-migration cleanup)

**Recommended approach (if needed):**
1. Extract filter logic to custom hook `useInventoryFilters`
2. Create `useInventoryItems` hook with filter params
3. Replace batched fetching with TanStack Query's built-in pagination
4. Use `keepPreviousData` option for smooth transitions
5. Test thoroughly - this is the most complex component

**Example structure:**
```typescript
export function useInventoryItems(filters: InventoryFilters) {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: queryKeys.inventory.byType(locationId, filters.type, filters.brand, filters.search),
    queryFn: async () => {
      let query = supabase
        .from('inventory_items')
        .select('*, products:product_fk (*)')
        .eq('location_id', locationId);

      if (filters.type !== 'all') {
        query = query.eq('inventory_type', filters.type);
      }

      if (filters.brand !== 'all') {
        query = query.eq('products.brand', filters.brand);
      }

      // ... apply other filters

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    keepPreviousData: true, // Smooth transitions while filtering
  });
}
```

## Performance Considerations

### Current Performance Wins

1. **Request Deduplication**: DashboardView and LoadManagementView share load data
   - Before: 2 separate requests for same data
   - After: 1 request, shared cache
   - Savings: ~50% reduction in load queries

2. **Automatic Caching**: 5-minute stale time with 30-minute cache retention
   - Users navigating between views don't trigger new fetches
   - Estimated 60-80% reduction in unnecessary API calls

3. **Optimistic Updates**: Parts inventory feels instant
   - Before: 200-500ms perceived latency per update
   - After: 0ms perceived latency (instant UI update)

### Future Optimization Opportunities

1. **Prefetching**: Use `queryClient.prefetchQuery` for likely next steps
   ```typescript
   // In LoadManagementView when hovering over a load
   const prefetchLoadDetail = (load: LoadMetadata) => {
     queryClient.prefetchQuery({
       queryKey: queryKeys.loads.detail(locationId, load.inventory_type, load.sub_inventory_name),
       queryFn: () => getLoadWithItems(load.inventory_type, load.sub_inventory_name),
     });
   };
   ```

2. **Background Refetching**: Keep data fresh without blocking UI
   ```typescript
   // Add to high-value queries
   refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
   refetchIntervalInBackground: true,
   ```

3. **Selective Invalidation**: Invalidate only affected queries
   ```typescript
   // Instead of invalidating all loads
   queryClient.invalidateQueries({ queryKey: queryKeys.loads.all(locationId) });

   // Invalidate specific load
   queryClient.invalidateQueries({
     queryKey: queryKeys.loads.detail(locationId, inventoryType, subInventoryName)
   });
   ```

4. **Parallel Queries**: Use `useQueries` for multiple independent queries
   ```typescript
   const results = useQueries({
     queries: loads.map(load => ({
       queryKey: queryKeys.loads.count(locationId, load.inventory_type, load.sub_inventory_name),
       queryFn: () => getLoadItemCount(load.inventory_type, load.sub_inventory_name),
     })),
   });
   ```

## Testing Strategy

### Manual Testing Checklist (Per Component)

- [ ] Data loads correctly on mount
- [ ] Loading states display properly
- [ ] Error states show meaningful messages
- [ ] Mutations work and invalidate cache
- [ ] Optimistic updates roll back on error
- [ ] No duplicate queries (check DevTools)
- [ ] Realtime updates sync with cache
- [ ] Navigation preserves cached data
- [ ] Refresh button works correctly

### Using ReactQueryDevtools

Open the DevTools panel (bottom-left icon in dev mode):

1. **Queries Tab**: See all active queries
   - Green = Fresh data
   - Yellow = Stale data
   - Gray = Inactive (cached)
   - Red = Error

2. **Mutations Tab**: See all mutations and their status

3. **Actions**:
   - Click a query to see its data
   - Use "Refetch" to manually trigger
   - Use "Remove" to test cache invalidation
   - Use "Reset" to clear all cache

### Network Tab Verification

Before/after migration, check Chrome DevTools Network tab:

1. Navigate through Dashboard → Loads → Parts
2. Count number of requests
3. Navigate back to Dashboard
4. Should see 0 new requests (cache hit)

## Rollback Plan

If issues arise, rollback is safe per component:

### Per-Component Rollback
```bash
git log --oneline --all -- src/components/Dashboard/DashboardView.tsx
git revert <commit-hash>
```

### Full Rollback
1. Remove QueryClientProvider from `src/App.tsx:287`
2. Revert all component changes
3. Delete hooks in `src/hooks/queries/`
4. Uninstall packages:
   ```bash
   pnpm remove @tanstack/react-query @tanstack/react-query-devtools
   ```

TanStack Query coexists with manual state management, so partial rollbacks are safe.

## Resources

- **TanStack Query Docs**: https://tanstack.com/query/latest/docs/framework/react/overview
- **Migration Guide**: https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5
- **Examples**: See migrated components in this codebase
- **DevTools**: https://tanstack.com/query/latest/docs/framework/react/devtools

## Questions & Issues

If you encounter issues during migration:

1. Check DevTools to see query state
2. Verify query keys match the convention
3. Check for missing null checks (`data ?? []`)
4. Ensure `locationId` is in scope
5. Verify mutation `onSettled` invalidates correctly

For complex scenarios, reference the migrated components as examples:
- **Simple query**: ReorderAlertsCard
- **Complex mutations**: PartsInventoryTab
- **Infinite query**: ActivityLogView
- **Realtime sync**: DashboardView
- **Conditional query**: InventoryItemDetailDialog
