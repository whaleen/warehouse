# Appliance Inventory Scanner - Planning Document

## Project Overview
A mobile-first PWA for scanning and tracking appliance inventory in a warehouse/logistics environment. The system provides a digital checklist to verify physical inventory against expected items, replacing manual paper-based tracking.

## Tech Stack
- **Frontend**: Vite + React + TypeScript
- **UI Library**: shadcn/ui (mobile-first design)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Netlify
- **Version Control**: GitHub
- **PWA**: vite-plugin-pwa

## Core Functionality

### 1. Barcode Scanning
- Camera-based barcode scanner using `html5-qrcode` library
- Supports Code 128 format (primary format on inventory labels)
- Full-screen camera view when scanning
- Manual entry fallback for damaged/unreadable barcodes
- Auto-focus on barcode input for keyboard wedge scanner compatibility (future-proofing)

### 2. Inventory Management
- Upload spreadsheet (CSV) of expected inventory
- Parse and store in Supabase
- Track scan status per item
- Support multiple sub-inventory types with different scan rules

### 3. Visual Checklist
- Mobile-optimized list view
- Color-coded status indicators (scanned vs pending)
- Progress counter (X of Y scanned)
- Search functionality
- Filter by sub-inventory type
- Sort capabilities

## Sub-Inventory Types
Each type has configurable scan priority rules (primary → fallback 1 → fallback 2):

1. **ASIS** 
   - Primary: Serial Number
   - Fallback 1: CSO Number
   - Fallback 2: Model Number

2. **Back Haul**
   - (Configure rules in-app or during implementation)

3. **Salvage**
   - (Configure rules in-app or during implementation)

4. **Staged**
   - (Configure rules in-app or during implementation)

5. **Inbound**
   - (Configure rules in-app or during implementation)

## Data Schema

### Appliances Table
```sql
create table appliances (
  id uuid primary key default uuid_generate_v4(),
  serial_number text,
  cso_number text,
  model_number text,
  sub_inventory text not null, -- ASIS, BackHaul, Salvage, Staged, Inbound
  date_received date,
  is_scanned boolean default false,
  scanned_at timestamp,
  scanned_by text,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Indexes for fast lookups
create index idx_serial on appliances(serial_number);
create index idx_cso on appliances(cso_number);
create index idx_model on appliances(model_number);
create index idx_sub_inventory on appliances(sub_inventory);
create index idx_scanned on appliances(is_scanned);
```

### Scan Rules Table (for configurability)
```sql
create table scan_rules (
  id uuid primary key default uuid_generate_v4(),
  sub_inventory text unique not null,
  primary_field text not null, -- 'serial_number', 'cso_number', 'model_number'
  fallback_1 text,
  fallback_2 text,
  created_at timestamp default now()
);

-- Default rules
insert into scan_rules (sub_inventory, primary_field, fallback_1, fallback_2) values
  ('ASIS', 'serial_number', 'cso_number', 'model_number'),
  ('BackHaul', 'serial_number', 'cso_number', 'model_number'),
  ('Salvage', 'serial_number', 'cso_number', 'model_number'),
  ('Staged', 'serial_number', 'cso_number', 'model_number'),
  ('Inbound', 'serial_number', 'cso_number', 'model_number');
```

### Upload History Table (optional, for audit trail)
```sql
create table upload_history (
  id uuid primary key default uuid_generate_v4(),
  filename text,
  row_count integer,
  uploaded_by text,
  uploaded_at timestamp default now()
);
```

## Mobile-First UI Structure

### Layout
```
┌─────────────────────────┐
│  Header (Logo/Title)    │
├─────────────────────────┤
│  Search Bar             │
├─────────────────────────┤
│  Filter Chips           │
│  [All][ASIS][Staged]... │
├─────────────────────────┤
│  Progress Bar           │
│  45/120 scanned         │
├─────────────────────────┤
│                         │
│  Scrollable List        │
│  ┌───────────────────┐  │
│  │ Serial: VA715942  │  │
│  │ Model: GTD58...   │  │
│  │ ✓ Scanned         │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ Serial: VA812345  │  │
│  │ Model: GTE22...   │  │
│  │ ○ Pending         │  │
│  └───────────────────┘  │
│                         │
├─────────────────────────┤
│  [  SCAN BARCODE  ]     │ ← Fixed bottom button
└─────────────────────────┘
```

### Scanner View (Full-Screen)
```
┌─────────────────────────┐
│ [X]     ASIS      [⚙]   │ ← Close, Sub-Inv, Settings
├─────────────────────────┤
│                         │
│                         │
│    ┌─────────────┐      │
│    │             │      │
│    │   CAMERA    │      │
│    │   VIEWFINDER│      │
│    │             │      │
│    └─────────────┘      │
│                         │
│  Scanning frame guide   │
│                         │
├─────────────────────────┤
│  [Manual Entry]         │ ← Fallback option
└─────────────────────────┘
```

## Key shadcn Components to Use

### Main Views
- `Card` - Appliance list items
- `Badge` - Status indicators (Scanned/Pending)
- `Button` - Large scan button, action buttons
- `Input` - Search bar, manual entry
- `Tabs` - Sub-inventory type switcher
- `Progress` - Overall completion progress

### Overlays & Interactions
- `Sheet` - Bottom drawer for filters/settings
- `Dialog` - CSV upload, confirmation dialogs
- `Alert` - Success/error messages
- `Select` - Dropdown for sub-inventory selection
- `RadioGroup` - Scan rule configuration

### Mobile Optimizations
- Minimum 44px touch targets
- Large, readable text (16px base minimum)
- High contrast for outdoor/warehouse visibility
- Generous spacing between interactive elements
- Pull-to-refresh gesture support

## Phase 1: MVP Features (Build Today)

### Must-Have
1. CSV upload and parsing
2. Camera barcode scanner
3. Basic appliance list view
4. Scan to mark as complete
5. Progress counter
6. Search by serial/CSO/model
7. Filter by sub-inventory type

### Nice-to-Have (if time permits)
1. Manual barcode entry
2. Duplicate detection
3. Export scanned list to CSV
4. Scan timestamp tracking

## Phase 2: Future Enhancements (Post-POC)

### If POC is successful
1. Configurable scan rules per sub-inventory (UI for editing)
2. User authentication and multi-user support
3. Offline-first with sync capability
4. Photo capture of appliances
5. Notes/condition reporting
6. Scan history and audit trail
7. Dashboard with analytics
8. Native mobile app with dedicated scanner SDK integration

## Implementation Steps

### 1. Project Setup
```bash
npm create vite@latest appliance-scanner -- --template react-ts
cd appliance-scanner
npm install
npx shadcn-ui@latest init
```

### 2. Install Dependencies
```bash
npm install @supabase/supabase-js
npm install html5-qrcode
npm install papaparse @types/papaparse
npm install vite-plugin-pwa -D
```

### 3. Add shadcn Components
```bash
npx shadcn-ui@latest add button card input badge tabs sheet dialog alert select progress
```

### 4. Configure Supabase
- Create Supabase project
- Run schema SQL
- Add environment variables to `.env`:
  ```
  VITE_SUPABASE_URL=your-project-url
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

### 5. Configure PWA
Update `vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Appliance Scanner',
        short_name: 'Scanner',
        description: 'Warehouse appliance inventory scanner',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
```

### 6. Build Core Features
Priority order:
1. Supabase client setup and database connection
2. CSV upload and parsing functionality
3. Basic list view with data from Supabase
4. Search and filter implementation
5. Barcode scanner component
6. Scan matching logic (serial → CSO → model)
7. Update scan status in database
8. Progress tracking

### 7. Mobile Testing
- Test on actual Android phone at work
- Test on iPhones
- Verify camera permissions work
- Test barcode detection with actual inventory labels
- Verify touch targets are large enough
- Test in various lighting conditions (warehouse environment)

### 8. Deploy
```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main

# Connect to Netlify
# - Import from GitHub
# - Configure build: npm run build
# - Publish directory: dist
# - Add environment variables
```

## CSV Upload Format

Expected columns in spreadsheet:
```csv
serial_number,cso_number,model_number,sub_inventory,date_received
VA715942,1064836060,GTD58EBSVWS,ASIS,2025-12-31
VA812345,1064836061,GTE22EBSVWS,Staged,2025-12-31
```

Optional columns:
- `tracking_number`
- `quantity`
- `notes`

## Scanning Logic Pseudocode

```typescript
async function processScan(scannedValue: string, subInventory: string) {
  // 1. Get scan rules for this sub-inventory
  const rules = await getScanRules(subInventory);
  
  // 2. Try to match against primary field
  let appliance = await findAppliance(rules.primary_field, scannedValue);
  
  // 3. If not found, try fallback 1
  if (!appliance && rules.fallback_1) {
    appliance = await findAppliance(rules.fallback_1, scannedValue);
  }
  
  // 4. If still not found, try fallback 2
  if (!appliance && rules.fallback_2) {
    appliance = await findAppliance(rules.fallback_2, scannedValue);
  }
  
  // 5. If found, mark as scanned
  if (appliance) {
    await markAsScanned(appliance.id);
    showSuccess();
  } else {
    showError("Item not found in inventory");
  }
}
```

## Auth Strategy (Start Simple)

### Option 1: No Auth (Simplest for POC)
- Shared access via URL
- Anyone with link can scan
- Track by device/browser

### Option 2: Simple Passcode (Recommended)
- Single shared passcode for warehouse team
- Store in localStorage after first entry
- Supabase RLS: allow all operations with valid passcode

### Option 3: Full Auth (Future)
- Individual user accounts
- Role-based permissions
- Full audit trail of who scanned what

**Recommendation**: Start with Option 1 or 2 for POC, upgrade to Option 3 if this becomes production tool.

## Performance Considerations

### Optimization Strategies
1. **Virtual scrolling** for large inventory lists (use `@tanstack/react-virtual` if needed)
2. **Debounced search** to avoid excessive database queries
3. **Optimistic UI updates** - mark as scanned immediately, sync to database
4. **Image optimization** - compress PWA icons
5. **Code splitting** - lazy load scanner component
6. **Service worker caching** - cache app shell for offline use

### Expected Scale
- Typical batch: 50-200 appliances
- Multiple batches per day
- Design for 500-1000 items in active inventory at once

## Success Criteria

### POC is successful if:
1. ✅ Can upload CSV and see items in list
2. ✅ Camera scanner reliably detects barcodes on inventory labels
3. ✅ Scanned items are marked and database updates correctly
4. ✅ Progress tracking is accurate
5. ✅ UI is easy to use on mobile phones
6. ✅ Search and filter work smoothly
7. ✅ Team finds it faster/easier than paper tracking

### Move to native app if:
- Scanner needs to work offline reliably
- Want integration with dedicated hardware scanners
- Need better camera performance
- Want to add advanced features (photo capture, etc.)

## Questions to Resolve During Build

1. Should duplicate scans be prevented or allowed?
2. Do you need to "unscan" items if scanned by mistake?
3. Should there be different user roles (scanner vs. supervisor)?
4. How long should inventory data persist in database?
5. Do you need to export results for reporting?
6. Should the app work completely offline or require internet?

## Development Tips

### For Claude CLI
- Build incrementally: database → list view → upload → scanner → polish
- Test each feature before moving to next
- Use TypeScript for type safety
- Keep components small and focused
- Mobile test frequently during development
- Use Supabase dashboard to verify data is saving correctly

### Git Workflow
```bash
# Feature branches
git checkout -b feature/csv-upload
# ... build feature ...
git add .
git commit -m "Add CSV upload functionality"
git push origin feature/csv-upload
git checkout main
git merge feature/csv-upload
```

### Debugging Tips
- Use React DevTools for component inspection
- Use Supabase logs for database query debugging
- Test camera permissions in HTTPS environment only
- Use Chrome DevTools device emulation for mobile testing

## Resources

### Documentation Links
- [Vite](https://vitejs.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Supabase Docs](https://supabase.com/docs)
- [html5-qrcode](https://github.com/mebjas/html5-qrcode)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Netlify Deployment](https://docs.netlify.com/)

### Design Inspiration
- Keep it brutally simple
- Big buttons, clear actions
- High contrast colors
- Generous spacing
- Immediate feedback on actions
- Mobile-first always

---

## Ready to Build!

This document provides everything needed to build the MVP. Start with the database schema, then the list view, then add the upload functionality, and finally integrate the scanner. Test on real devices with actual inventory labels as early as possible.

Good luck! 🚀
