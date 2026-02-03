# Session Architecture Refactor - Implementation Plan

## Overview

Sunset custom session creation and implement immutable session ownership with mutable location tracking. All sessions will be derived from GE Sync (ASIS, FG, STA, BackHaul) or system sessions (Ad-hoc, Fog of War).

## Problem Statement

**Current Issues:**
- Users can create custom sessions manually from CreateSessionView
- Sessions are temporary audits with snapshots of inventory
- No cross-session item checking - same barcode can be scanned into multiple sessions
- Location markers always create new records (duplicates on map)
- No feedback about which session owns an item
- Scanning is session-isolated, not location-aware

**User Requirements:**
- Remove custom session creation UI entirely
- All sessions derived from GE sync or system-generated
- Immutable session ownership - items never move between sessions
- Mutable location tracking - scanning updates location markers
- Cross-session awareness - scanner shows which session owns an item
- Mode-aware feedback in scanner overlay

---

## Mental Model Shift

### Before (Current)
**Sessions are temporary audits**
- User creates session from inventory snapshot
- Items copied into session as JSONB
- Scanning marks items as "scanned" in session
- Multiple sessions can contain same item (duplicates)
- Sessions can be deleted

### After (New)
**Sessions are immutable manifests**
- GE Sync creates sessions automatically from loads
- System sessions (Ad-hoc, Fog of War) always exist
- Items belong to one session forever (ownership immutable)
- Scanning updates location markers (location mutable)
- Scanner checks all sessions, shows ownership
- Sessions persist forever (audit trail)

---

## Architecture Changes

### 1. Session Sources

**GE Sync-Derived Sessions** (automatic creation on sync):
- **ASIS Loads**: Each load becomes a session (e.g., "ASIS-LOAD-001")
- **FG Sessions**: Per-route or bulk FG (e.g., "FG-ROUTE-12")
- **STA Sessions**: Staging area sessions
- **BackHaul Sessions**: Return shipments
- Created during GE sync, linked via `sub_inventory` field
- Status managed by GE sync (active, in_transit, delivered)

**System Sessions** (permanent, reusable):
- **Ad-hoc Scans**: Test/junk scans, no inventory storage
- **Fog of War**: Location marker updates for any inventory item

### 2. Scanning Behavior Changes

#### Current Behavior
```
User scans barcode
  → Search current session items only
  → If found: Mark as scanned
  → Create location history record
```

#### New Behavior
```
User scans barcode
  → Search ALL sessions for item ownership
  → If found in current session: Mark scanned + update location marker
  → If found in OTHER session: Show "Belongs to X" + update location marker
  → If not found:
     - Ad-hoc mode: Show "Not in inventory" (no storage)
     - Fog of War: Show "Not in inventory - marked for review"
     - Regular session: Error
```

### 3. Location Marker Logic

#### Current (Always Create)
```typescript
async function logProductLocation(item, gps, session) {
  await supabase.from('product_location_history').insert({
    inventory_item_id: item.id,
    scanning_session_id: session.id,
    position_x, position_y,
    raw_lat, raw_lng,
    created_at: now()
  });
}
```

#### New (Update Recent or Create)
```typescript
async function updateOrCreateLocationMarker(item, gps, session) {
  // Check if recent marker exists (< 5 minutes old)
  const recent = await findRecentMarker(item.id, session.id);

  if (recent) {
    // UPDATE existing marker
    await supabase.from('product_location_history')
      .update({ position_x, position_y, raw_lat, raw_lng, updated_at: now() })
      .eq('id', recent.id);
    return { action: 'updated', marker: recent };
  } else {
    // CREATE new marker
    const marker = await supabase.from('product_location_history').insert({...});
    return { action: 'created', marker };
  }
}
```

### 4. Feedback System

**MinimalScanOverlay Feedback Text (above input):**

| Mode | Scenario | Feedback |
|------|----------|----------|
| Fog of War | Item found, first scan | "Marked" |
| Fog of War | Item found, rescan | "Mark updated" |
| Ad-hoc | Item in inventory | "Belongs to LOAD-A" |
| Ad-hoc | Item not in inventory | "Not in inventory" |
| Session (own) | Item scanned | "Scanned - LOAD-A" |
| Session (other) | Item in different session | "Belongs to LOAD-B - marker updated" |

---

## Database Changes

### 1. New Session Types

Update `scanning_sessions` to distinguish session sources:

```sql
ALTER TABLE scanning_sessions
ADD COLUMN session_source TEXT DEFAULT 'manual'
CHECK (session_source IN ('manual', 'ge_sync', 'system'));

-- Mark system sessions
UPDATE scanning_sessions
SET session_source = 'system'
WHERE created_by = 'system';

-- Future GE sync sessions will use 'ge_sync'
```

### 2. Inventory Item Ownership

Add session ownership tracking to `inventory_items`:

```sql
ALTER TABLE inventory_items
ADD COLUMN owning_session_id UUID REFERENCES scanning_sessions(id);

-- Backfill existing items from sessions
-- (decide strategy: match by serial/CSO or leave NULL)
```

### 3. Location History Indexing

Optimize marker update queries:

```sql
CREATE INDEX idx_location_recent_markers
ON product_location_history(inventory_item_id, scanning_session_id, created_at DESC);
```

---

## Component Modifications

### Files to Remove

1. **`src/components/Session/CreateSessionView.tsx`** - Entire custom session creation UI
   - Remove tab "New Session"
   - Keep tabs: "Active Sessions", "Closed Sessions" for viewing

### Files to Modify

#### 1. `src/lib/geSync.ts` - Auto-create sessions on sync (EAGER)

**Add after inventory sync:**
```typescript
async function createSessionsFromSync(inventoryType: 'ASIS' | 'FG' | 'STA') {
  if (inventoryType === 'ASIS') {
    // Get all loads from load_metadata
    const loads = await getLoadsByType('ASIS');
    for (const load of loads) {
      // Eager creation: create session immediately during sync
      await getOrCreateLoadSession(
        load.sub_inventory_name,
        load.status, // Sync status from GE
        load.friendly_name
      );
    }
  } else {
    // Create single session for FG/STA
    await getOrCreateInventoryTypeSession(inventoryType);
  }
}
```

#### 2. `src/lib/sessionManager.ts` - Add load session creation

**New function:**
```typescript
async function getOrCreateLoadSession(
  subInventoryName: string,
  geStatus: string,
  friendlyName?: string
) {
  // Check if session exists
  const existing = await supabase
    .from('scanning_sessions')
    .select('id, status')
    .eq('location_id', locationId)
    .eq('sub_inventory', subInventoryName)
    .eq('session_source', 'ge_sync')
    .maybeSingle();

  if (existing) {
    // Update status from GE (GE wins)
    const mappedStatus = mapGeStatusToSessionStatus(geStatus);
    if (existing.status !== mappedStatus) {
      await supabase.from('scanning_sessions')
        .update({ status: mappedStatus })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new session
  const { data } = await supabase.from('scanning_sessions').insert({
    name: friendlyName || `Load ${subInventoryName}`,
    inventory_type: 'ASIS',
    sub_inventory: subInventoryName,
    status: mapGeStatusToSessionStatus(geStatus),
    session_source: 'ge_sync',
    created_by: 'system',
    location_id: locationId
  }).select('id').single();

  return data.id;
}

function mapGeStatusToSessionStatus(geStatus: string): 'active' | 'closed' {
  // Map GE load status to session status
  // active, in_transit, staged → 'active'
  // delivered, completed → 'closed'
  return ['delivered', 'completed'].includes(geStatus) ? 'closed' : 'active';
}
```

#### 3. `src/lib/sessionScanner.ts` - Add cross-session checking

**New function:**
```typescript
async function findItemOwningSession(barcode: string, locationId: string) {
  // Search all inventory items by serial, CSO, or model
  const items = await supabase
    .from('inventory_items')
    .select('id, serial, cso, model, sub_inventory, inventory_type, owning_session_id')
    .eq('location_id', locationId)
    .or(`serial.eq.${barcode},cso.eq.${barcode},model.eq.${barcode}`);

  if (items.data?.length === 1) {
    const item = items.data[0];
    // Find owning session
    const session = await supabase
      .from('scanning_sessions')
      .select('id, name, sub_inventory')
      .eq('id', item.owning_session_id)
      .single();

    return { item, owningSession: session };
  }

  return null;
}
```

#### 4. `src/lib/mapManager.ts` - Update marker logic

**Modify `logProductLocation()`:**
```typescript
async function logProductLocation(item, gps, session) {
  // Find recent marker (< 5 min)
  const { data: recent } = await supabase
    .from('product_location_history')
    .select('id')
    .eq('inventory_item_id', item.id)
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    // UPDATE
    await supabase.from('product_location_history')
      .update({
        position_x: gps.x,
        position_y: gps.y,
        raw_lat: gps.lat,
        raw_lng: gps.lng,
        updated_at: new Date().toISOString()
      })
      .eq('id', recent.id);
    return { action: 'updated' };
  } else {
    // CREATE
    await supabase.from('product_location_history').insert({...});
    return { action: 'created' };
  }
}
```

#### 5. `src/components/Scanner/MinimalScanOverlay.tsx` - Mode-aware feedback

**Add feedback state:**
```typescript
const [feedbackText, setFeedbackText] = useState<string>('');

// Update after scan
const handleScan = async (barcode: string) => {
  const result = await findItemOwningSession(barcode);

  if (!result) {
    if (mode === 'ad-hoc') {
      setFeedbackText('Not in inventory');
    } else if (mode === 'fog-of-war') {
      setFeedbackText('Not in inventory - marked for review');
    }
    return;
  }

  const { item, owningSession } = result;
  const isSameSession = owningSession.id === currentSessionId;

  if (mode === 'fog-of-war') {
    const markerResult = await updateOrCreateLocationMarker(item, gps, currentSession);
    setFeedbackText(markerResult.action === 'created' ? 'Marked' : 'Mark updated');
  } else if (isSameSession) {
    setFeedbackText(`Scanned - ${owningSession.name}`);
  } else {
    setFeedbackText(`Belongs to ${owningSession.name} - marker updated`);
  }
};
```

**Add feedback UI:**
```tsx
<div className="text-xs text-muted-foreground mb-2">
  {feedbackText}
</div>
<Input ref={inputRef} ... />
```

#### 6. `src/App.tsx` - Remove session creation route

**Remove from routing:**
```typescript
// Remove this case:
case 'create-session':
  return <CreateSessionView onNavigate={navigate} />;
```

#### 7. `src/components/Navigation/*` - Remove "New Session" links

**MobilePrimaryNav.tsx, AppSidebar.tsx**:
- Remove navigation item for 'create-session'
- Keep only: Dashboard, Loads, Map, Scanner (quick)

---

## Implementation Phases

### Phase 1: Database Schema (30 min)
1. Add `session_source` column to `scanning_sessions`
2. Add `owning_session_id` column to `inventory_items`
3. Create index on `product_location_history` for marker updates
4. Run migrations

### Phase 2: Session Auto-Creation (1 hour)
1. Implement `getOrCreateLoadSession()` in `sessionManager.ts`
   - Eager creation: runs during sync, not on-demand
   - Status sync: maps GE status to session status (GE wins)
2. Add session creation to GE sync flow in `geSync.ts`
3. Update system session creation (Ad-hoc, Fog of War)
4. Test GE sync creates sessions correctly
5. Test status updates: GE sync overwrites user-closed sessions

### Phase 3: Scanner Cross-Session Logic (2 hours)
1. Implement `findItemOwningSession()` in `sessionScanner.ts`
2. Update `logProductLocation()` to upsert markers in `mapManager.ts`
3. Add feedback state to `MinimalScanOverlay.tsx`
4. Wire up scan handlers to use cross-session checking
5. Test scanning items across different sessions

### Phase 4: UI Cleanup (1 hour)
1. Remove `CreateSessionView.tsx` entirely
2. Remove 'create-session' route from `App.tsx`
3. Remove "New Session" links from navigation components
4. Update session list views to show only GE sync + system sessions
5. Test navigation still works

### Phase 5: Testing & Polish (1 hour)
1. Test GE sync creates sessions
2. Test Fog of War marking/updating
3. Test Ad-hoc mode feedback
4. Test cross-session scanning shows ownership
5. Test location markers update instead of duplicate
6. Verify map shows correct item positions

**Total estimated time:** 5-6 hours

---

## Verification

### Manual Testing

**1. GE Sync Session Creation**
```
1. Open Settings → GE Sync
2. Click "Sync ASIS"
3. Navigate to Map or Sessions view
4. Verify: New sessions created for each load
5. Verify: Session names match load numbers
```

**2. Fog of War Mode**
```
1. Open Map view
2. Activate Fog of War session (auto-created)
3. Scan an item from inventory
4. Feedback shows: "Marked"
5. Scan same item again
6. Feedback shows: "Mark updated"
7. Verify: Only one marker on map (not duplicated)
```

**3. Ad-hoc Mode**
```
1. Activate Ad-hoc session
2. Scan item from ASIS-LOAD-A
3. Feedback shows: "Belongs to ASIS-LOAD-A"
4. Scan unknown barcode
5. Feedback shows: "Not in inventory"
```

**4. Cross-Session Scanning**
```
1. Open session ASIS-LOAD-A
2. Scan item that belongs to ASIS-LOAD-B
3. Feedback shows: "Belongs to ASIS-LOAD-B - marker updated"
4. Map shows marker in scanned location (not original)
```

**5. Session List View**
```
1. Navigate to Sessions view
2. Verify: No "New Session" tab
3. Verify: Only GE sync sessions + system sessions shown
4. Verify: Can't create custom sessions
```

### Database Verification

```sql
-- Check session sources
SELECT session_source, COUNT(*)
FROM scanning_sessions
GROUP BY session_source;

-- Check recent marker updates
SELECT
  inventory_item_id,
  COUNT(*) as marker_count,
  MAX(created_at) as last_scan
FROM product_location_history
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY inventory_item_id
HAVING COUNT(*) > 1; -- Should be empty (no duplicates)

-- Check item ownership
SELECT
  inventory_type,
  COUNT(*) as total,
  COUNT(owning_session_id) as with_session
FROM inventory_items
GROUP BY inventory_type;
```

---

## Risks & Mitigations

### Risk: Existing custom sessions in database

**Mitigation:**
- Don't delete existing sessions (audit trail)
- Mark as `session_source: 'manual'` (legacy)
- Hide from UI but keep data intact
- Future: Add cleanup job if needed

### Risk: GE sync creates duplicate sessions

**Mitigation:**
- Use `getOrCreateLoadSession()` with uniqueness check
- Query by `location_id + sub_inventory + session_source`
- Reuse existing sessions instead of creating new

### Risk: Location marker updates too aggressive

**Mitigation:**
- Use 5-minute window for "recent" check
- Only update if same session + same item
- Prevents overwriting intentional re-scans

### Risk: Item ownership backfill unclear

**Mitigation:**
- Start with NULL `owning_session_id` for existing items
- GE sync populates for new items going forward
- Manual backfill script can match by serial/CSO later

---

## Critical Files Reference

### Database
- `supabase/migrations/*` - Schema changes
- `scanning_sessions` table - Add `session_source` column
- `inventory_items` table - Add `owning_session_id` column
- `product_location_history` table - Add index for updates

### Session Management
- `src/lib/sessionManager.ts` - Session creation logic
- `src/lib/geSync.ts` - GE sync integration
- `src/hooks/queries/useSessions.ts` - Session queries

### Scanner Logic
- `src/lib/sessionScanner.ts` - Cross-session item search
- `src/lib/mapManager.ts` - Location marker upsert
- `src/components/Scanner/MinimalScanOverlay.tsx` - Feedback UI

### UI Components to Remove
- `src/components/Session/CreateSessionView.tsx` - Delete entire file
- `src/App.tsx` - Remove 'create-session' route
- `src/components/Navigation/MobilePrimaryNav.tsx` - Remove "Scanner" link
- `src/components/Navigation/AppSidebar.tsx` - Remove "New Session" item

### Types
- `src/types/inventory.ts` - Session types
- `src/types/scanner.ts` - Scanner feedback types
