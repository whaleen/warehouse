# Adjacent Project Ideas

**Context**: Real-time sync infrastructure is now live. What should we build next?
**Date**: 2026-02-06

---

## 🔥 High Impact Projects (1-3 hours each)

### 1. Custom Fields System (2 hours)

**Problem**: No way to add notes, tags, or warehouse-specific metadata to inventory items.

**Solution**: Custom fields layer on top of GE sync data.

**Implementation**:
```sql
-- Database table
CREATE TABLE custom_inventory_fields (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL,

  -- Custom fields
  notes text,
  priority integer CHECK (priority BETWEEN 1 AND 5),
  warehouse_location text, -- "Aisle 3, Shelf B"
  condition_notes text, -- "Slight damage on corner"
  custom_tags text[], -- ["urgent", "needs-inspection"]
  internal_tracking_number text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
```

**Features**:
- ✅ Edit modal on inventory item cards
- ✅ Search/filter by custom tags
- ✅ Bulk tag operations
- ✅ Audit trail (who edited what)
- ✅ Real-time sync (already built!)

**Value**: Teams can add context to items without touching GE data.

---

### 2. Load Color Customization (1 hour)

**Problem**: Load colors are auto-assigned, but users might want custom colors for better visual organization.

**Solution**: Let users pick colors for loads in the map.

**Implementation**:
- Color picker in load metadata panel
- Save to `load_metadata.primary_color`
- Map markers update via Realtime (already works!)

**UI**:
```tsx
<Popover>
  <PopoverTrigger>
    <div className="w-6 h-6 rounded border" style={{ backgroundColor: load.primary_color }} />
  </PopoverTrigger>
  <PopoverContent>
    <HexColorPicker color={color} onChange={setColor} />
  </PopoverContent>
</Popover>
```

**Value**: Better visual organization on the map.

---

### 3. Scan History Timeline (2 hours)

**Problem**: No visibility into scan history for an item (who scanned when, where).

**Solution**: Timeline view showing all scans for an item.

**Implementation**:
- Query `product_location_history` for a specific `inventory_item_id`
- Display as vertical timeline
- Show: timestamp, user, GPS accuracy, session

**UI**:
```
📍 Scanned by John at 2:34 PM (±5m accuracy)
   Session: Load E | Fog of War

📍 Scanned by Sarah at 11:22 AM (±3m accuracy)
   Session: Ad-hoc Scans

📍 Scanned by Mike at 9:15 AM (±8m accuracy)
   Session: Load E | Session #123
```

**Value**: Audit trail, troubleshooting, accountability.

---

### 4. Bulk Actions on Map (1.5 hours)

**Problem**: Can't do bulk operations (delete scans, change session, etc.).

**Solution**: Multi-select mode on map markers.

**Implementation**:
- Click "Select Mode" button
- Click markers to select (highlight with checkmark)
- Bulk actions: Delete, Move to session, Export

**UI**:
```
[Select Mode] → [✓ 23 selected] → [Delete] [Move to...] [Export CSV]
```

**Value**: Clean up mistakes, organize data faster.

---

### 5. Session Templates (1 hour)

**Problem**: Creating sessions manually is repetitive.

**Solution**: Save session configs as templates.

**Implementation**:
```typescript
interface SessionTemplate {
  name: string;
  inventoryType: InventoryType;
  subInventory?: string;
  defaultMode: 'fog' | 'adhoc';
}

// Quick start new session from template
const templates = [
  { name: "Quick ASIS Scan", inventoryType: "ASIS", defaultMode: "fog" },
  { name: "FG Audit", inventoryType: "FG", defaultMode: "fog" },
  { name: "Ad-hoc Marker", inventoryType: "all", defaultMode: "adhoc" },
];
```

**Value**: Faster session creation, consistency.

---

## 🚀 Advanced Projects (3-6 hours)

### 6. Offline Mode with Service Worker (4 hours)

**Problem**: Warehouse wifi is spotty, scans fail when offline.

**Solution**: Queue scans locally, sync when back online.

**Implementation**:
- Service Worker intercepts failed requests
- Store in IndexedDB
- Background sync when connection restored
- Show "Offline" badge with pending count

**Stack**:
- `workbox` for service worker
- `idb` for IndexedDB
- TanStack Query persister

**Value**: Never lose a scan, works in dead zones.

---

### 7. Advanced Search & Filters (3 hours)

**Problem**: No way to search across inventory by multiple criteria.

**Solution**: Advanced search builder.

**Features**:
- Search by serial, CSO, model
- Filter by load, type, status
- Date ranges (scanned between X and Y)
- Custom field filters (tags, notes)
- Save searches as presets

**UI**:
```
┌─ Search Builder ────────────────┐
│ Serial contains: "AA3"          │
│ + AND Load equals: "Load E"     │
│ + AND Scanned after: 2026-02-01 │
│ + AND Has tag: "urgent"         │
│                                  │
│ [Save as Preset] [Search]       │
└──────────────────────────────────┘

Results: 23 items
```

**Value**: Find specific items quickly.

---

### 8. Dashboard Widgets (3 hours)

**Problem**: Dashboard is static, users want custom views.

**Solution**: Draggable widget dashboard.

**Implementation**:
- `react-grid-layout` for drag-and-drop
- Widget library: Scan velocity, Top scanners, Load progress, etc.
- Save layout per user

**Widgets**:
- 📊 Scans per hour (line chart)
- 👤 Top scanners leaderboard
- 🚚 Load completion progress
- ⚠️ Items needing attention (custom tags)
- 📈 Inventory trend (growing/shrinking)

**Value**: Personalized insights, visibility.

---

### 9. Geofencing Alerts (4 hours)

**Problem**: No alerts when items are scanned in wrong areas.

**Solution**: Define geofences, alert on violations.

**Implementation**:
```typescript
interface Geofence {
  name: string;
  polygon: [lat, lng][];
  allowedInventoryTypes: InventoryType[];
  alertOnViolation: boolean;
}

// Example: "Warehouse Zone A"
{
  name: "Zone A - ASIS Only",
  polygon: [[lat1, lng1], [lat2, lng2], ...],
  allowedInventoryTypes: ["ASIS"],
  alertOnViolation: true
}
```

**Features**:
- Draw zones on map
- Real-time violation detection
- Alert: "⚠️ FG item scanned in ASIS zone"

**Value**: Enforce warehouse organization rules.

---

### 10. Export & Reporting (3 hours)

**Problem**: No way to export data for analysis.

**Solution**: Export builder with custom reports.

**Features**:
- Export to CSV, Excel, PDF
- Custom columns (select which fields)
- Date ranges
- Grouping (by load, type, scanner)
- Scheduled exports (email daily report)

**Reports**:
- Daily scan summary
- Load completion report
- Scanner productivity report
- Inventory variance report (GE vs actual)

**Value**: External analysis, compliance, audits.

---

## 🧪 Experimental Projects (2-4 hours)

### 11. AI-Powered Anomaly Detection (3 hours)

**Problem**: Manual inspection for issues (duplicates, wrong locations, etc.).

**Solution**: AI alerts for anomalies.

**Examples**:
- 🤖 "Serial AA345212 scanned 3 times in 5 minutes (possible duplicate)"
- 🤖 "Load E items clustered 200m from other Load E items"
- 🤖 "Scanner John's accuracy suddenly dropped (8m → 50m)"
- 🤖 "23 items scanned but not in inventory (sync issue?)"

**Implementation**:
- Run checks on new scans
- Store alerts in `anomaly_alerts` table
- Show in UI with "Dismiss" or "Investigate"

**Value**: Catch errors automatically.

---

### 12. Voice Commands (2 hours)

**Problem**: Hands-free operation would be faster.

**Solution**: Voice-activated scanning.

**Features**:
- "Scan barcode A-A-3-4-5-2-1-2"
- "Mark this location"
- "Switch to Load E"
- "Undo last scan"

**Implementation**:
- Web Speech API
- Speech-to-text → parse command → execute action

**Value**: Faster scanning, accessibility.

---

### 13. Collaborative Annotations (2 hours)

**Problem**: Teams can't leave notes for each other on the map.

**Solution**: Pin notes to map locations.

**Features**:
- Click map → Add note → "This pallet needs inspection"
- Show as pin with message
- Real-time (others see it instantly)
- Resolve/dismiss when handled

**Value**: Team coordination, async communication.

---

### 14. Performance Monitoring Dashboard (3 hours)

**Problem**: No visibility into app performance.

**Solution**: Internal metrics dashboard.

**Metrics**:
- TanStack Query cache hit rate
- Average query time
- Realtime event frequency
- Scan success rate
- GPS accuracy distribution
- Browser/device stats

**UI**: Hidden route `/dev/metrics`

**Value**: Identify bottlenecks, optimize.

---

## 🎨 UX Improvements (1-2 hours each)

### 15. Keyboard Shortcuts (1 hour)

**Commands**:
- `S` - Open scanner
- `M` - Toggle map view
- `Esc` - Close overlay
- `?` - Show shortcuts
- `Ctrl+K` - Command palette

**Implementation**: `react-hotkeys-hook`

---

### 16. Loading Skeletons (1 hour)

**Problem**: White flash while data loads.

**Solution**: Skeleton screens for every view.

**Value**: Feels faster, better UX.

---

### 17. Empty States (1 hour)

**Problem**: Blank screens when no data.

**Solution**: Helpful empty states with actions.

**Example**:
```
┌────────────────────────┐
│   📭                   │
│   No scans yet         │
│                        │
│   [Start Scanning]    │
└────────────────────────┘
```

---

### 18. Undo/Redo Stack (2 hours)

**Problem**: Can't undo mistakes.

**Solution**: Undo last action (delete scan, close session, etc.).

**UI**: `⌘Z` to undo, toast notification

**Value**: Confidence to experiment.

---

## 🔧 Infrastructure Projects

### 19. Migrate to Bun (1 hour)

We already have the plan! Just execute it.

**Value**: 4min builds → 30s builds.

---

### 20. E2E Test Suite (4 hours)

**Tests**:
- User A scans → User B sees update
- GE sync → UI updates
- Offline mode → Sync when back
- Scanner input (character clipping test)

**Stack**: Playwright

**Value**: Catch regressions.

---

### 21. Storybook Component Library (3 hours)

**Problem**: Components scattered, hard to reuse.

**Solution**: Storybook for all UI components.

**Value**: Design system, documentation.

---

## 📱 Mobile-Specific Projects

### 22. PWA Install Prompt (30 min)

**Problem**: Users don't know it's installable.

**Solution**: "Add to Home Screen" banner.

---

### 23. Haptic Feedback Patterns (1 hour)

**Problem**: Current haptics are basic.

**Solution**: Richer patterns for different actions.

**Patterns**:
- Double pulse: Successful scan
- Triple pulse: Error
- Long pulse: Session started

---

### 24. Camera Barcode Scanner Improvements (2 hours)

**Features**:
- Flashlight toggle
- Zoom controls
- Continuous scan mode (no need to tap)
- Scan history (last 10 scans)

---

## My Top 5 Recommendations

Based on impact and time investment:

1. **Custom Fields System** (2h) - Huge value, fills major gap
2. **Load Color Customization** (1h) - Quick win, better UX
3. **Scan History Timeline** (2h) - Audit trail is crucial
4. **Session Templates** (1h) - Speeds up daily workflow
5. **Offline Mode** (4h) - Game changer for spotty wifi

---

**Which sounds interesting?** Or want to build something else entirely?
