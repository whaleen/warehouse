# GE Sync - FG and STA Support

## Summary

Extended the ge-sync service to support syncing FG (Finished Goods) and STA (Staged) inventory types in addition to ASIS.

## Changes Made

### New Files

1. **`services/ge-sync/src/sync/inventory.ts`**
   - Generic inventory sync module for simple inventory types (FG, STA)
   - Uses ERP master inventory export only (no load lists)
   - Features:
     - Fetches from `/dms/erpCheckInventory/erpInventorySpreadsheet`
     - Builds synthetic serials for items without real serials (format: `FG-NS:MODEL_STATUS:1`)
     - Detects changes (new items, status changes, qty changes, disappeared items)
     - Logs all changes to `ge_changes` table
     - Upserts to `inventory_items` table
     - Deletes orphaned items (in DB but not in GE)

### Modified Files

1. **`services/ge-sync/src/index.ts`**
   - Added `POST /sync/fg` endpoint
   - Added `POST /sync/sta` endpoint
   - Imported `syncSimpleInventory` function

2. **`services/ge-sync/src/types/index.ts`**
   - Updated `SyncResult` interface to include:
     - `message?: string`
     - `changes?: GEChange[]`
     - Made `duration` optional

3. **`services/ge-sync/README.md`**
   - Documented new `/sync/fg` endpoint
   - Documented new `/sync/sta` endpoint
   - Updated architecture diagram to show all three sync endpoints

### Documentation

1. **`docs/product-lifecycle.md`** (created earlier)
   - Complete lifecycle documentation with guardrails
   - Covers ephemeral vs permanent data
   - Serial vs non-serial item tracking
   - Conflict detection
   - Edge cases

## Key Differences: ASIS vs FG/STA

| Feature | ASIS | FG / STA |
|---------|------|----------|
| **Data Source** | Load lists + Report history + Per-load CSVs + ERP export | ERP export only |
| **Load Organization** | ✅ Yes - items grouped by loads | ❌ No - flat inventory list |
| **CSO Assignment** | ✅ Yes - from report history | ❌ No |
| **Complexity** | High (1194 lines) | Low (450 lines) |
| **Sub-Inventory** | Load numbers (e.g., "9SU20260114134738") | Empty string |
| **Synthetic Serials** | `ASIS-NS:MODEL_STATUS:1` | `FG-NS:MODEL_STATUS:1` or `STA-NS:MODEL_STATUS:1` |

## API Usage

### Sync FG Inventory

```bash
curl -X POST http://localhost:3001/sync/fg \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"locationId": "your-location-uuid"}'
```

Response:
```json
{
  "success": true,
  "message": "FG sync completed successfully",
  "stats": {
    "totalGEItems": 250,
    "itemsInLoads": 0,
    "unassignedItems": 0,
    "newItems": 12,
    "updatedItems": 238,
    "forSaleLoads": 0,
    "pickedLoads": 0,
    "changesLogged": 18
  },
  "changes": [
    {
      "serial": "ABC123",
      "model": "GDT605PGM",
      "change_type": "item_appeared",
      "source": "erp_inventory"
    }
  ]
}
```

### Sync STA Inventory

```bash
curl -X POST http://localhost:3001/sync/sta \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"locationId": "your-location-uuid"}'
```

## Testing Plan

### 1. Local Testing (Today)

Before deploying to Railway, test locally:

```bash
cd services/ge-sync

# Make sure dependencies are installed
pnpm install

# Make sure Playwright browsers are installed
pnpm exec playwright install chromium

# Run service locally (with Doppler)
doppler run pnpm run dev

# In another terminal, test FG sync
curl -X POST http://localhost:3001/sync/fg \
  -H "Content-Type: application/json" \
  -d '{"locationId": "your-location-uuid"}'

# Test STA sync
curl -X POST http://localhost:3001/sync/sta \
  -H "Content-Type: application/json" \
  -d '{"locationId": "your-location-uuid"}'
```

### 2. Verify Database Changes

Check Supabase after running syncs:

```sql
-- Check FG items were imported
SELECT COUNT(*) FROM inventory_items
WHERE inventory_type = 'FG' AND location_id = 'your-location-uuid';

-- Check STA items were imported
SELECT COUNT(*) FROM inventory_items
WHERE inventory_type = 'STA' AND location_id = 'your-location-uuid';

-- Check changes were logged
SELECT * FROM ge_changes
WHERE inventory_type IN ('FG', 'STA')
ORDER BY detected_at DESC
LIMIT 20;

-- Check for synthetic serials
SELECT serial, model, inventory_type
FROM inventory_items
WHERE serial LIKE 'FG-NS:%' OR serial LIKE 'STA-NS:%';
```

### 3. Floor Test Tomorrow

1. **Morning - Run syncs:**
   ```bash
   # Sync all three types
   curl -X POST https://your-railway-service.up.railway.app/sync/asis \
     -H "X-API-Key: $API_KEY" \
     -d '{"locationId": "..."}'

   curl -X POST https://your-railway-service.up.railway.app/sync/fg \
     -H "X-API-Key: $API_KEY" \
     -d '{"locationId": "..."}'

   curl -X POST https://your-railway-service.up.railway.app/sync/sta \
     -H "X-API-Key: $API_KEY" \
     -d '{"locationId": "..."}'
   ```

2. **Verify counts in UI:**
   - Dashboard should show counts for ASIS, FG, and STA
   - Inventory view should allow filtering by type

3. **Start scanning:**
   - Create scanning session
   - Scan items from all three types
   - Verify GPS coordinates are captured
   - Check map shows all scanned items

4. **Monitor for issues:**
   - Check Railway logs for errors
   - Verify scans appear in `product_location_history`
   - Confirm `inventory_items.is_scanned` flag updates

## Frontend Changes Needed

The frontend currently only has UI for triggering ASIS sync. You'll need to add:

### 1. Settings/Admin Page

Add buttons for FG and STA syncs:

```typescript
// Example UI additions
<Button onClick={() => triggerFGSync()}>
  Sync FG Inventory
</Button>

<Button onClick={() => triggerSTASync()}>
  Sync STA Inventory
</Button>

// API calls
async function triggerFGSync() {
  const response = await fetch(`${GE_SYNC_URL}/sync/fg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': GE_SYNC_API_KEY,
    },
    body: JSON.stringify({ locationId }),
  });
  const result = await response.json();
  // Show toast notification
}
```

### 2. Inventory View Filters

Update inventory type filters to include FG and STA:

```typescript
const INVENTORY_TYPES = ['ASIS', 'FG', 'STA', 'BackHaul', ...];
```

### 3. Dashboard Stats

Add FG and STA counts to dashboard:

```sql
-- Query to add to dashboard
SELECT
  COUNT(*) FILTER (WHERE inventory_type = 'FG') as fg_count,
  COUNT(*) FILTER (WHERE inventory_type = 'STA') as sta_count
FROM inventory_items
WHERE location_id = $1;
```

## Deployment Checklist

- [ ] Commit changes to git
- [ ] Push to main branch
- [ ] Railway auto-deploys from main
- [ ] Verify health check: `https://your-service.up.railway.app/health`
- [ ] Test FG sync via curl (production URL)
- [ ] Test STA sync via curl (production URL)
- [ ] Check Railway logs for any errors
- [ ] Verify data appears in Supabase

## Known Limitations

1. **No load organization** - FG and STA items aren't grouped into loads (by design)
2. **No CSO assignment** - No CSO field for FG/STA items
3. **Synthetic serials** - Items without real serials get generated IDs
4. **Single invOrg** - Currently hardcoded to `9SU` (TODO: make configurable)

## Future Enhancements

1. **Make invOrg configurable** - Store in `locations` or `settings` table
2. **Add "Sync All" button** - Trigger ASIS + FG + STA in sequence
3. **Scheduled syncs** - Cron job to run syncs at specific times
4. **Sync history** - Track sync runs in database table
5. **Progress tracking** - Show sync progress in UI (requires job queue)

## Troubleshooting

### Sync returns empty inventory

**Cause:** GE DMS endpoint requires authentication or returns no data for this location.

**Fix:**
1. Check auth status: `GET /auth/status?locationId=...`
2. Force refresh: `POST /auth/refresh` with `{locationId: "..."}`
3. Verify SSO credentials in `settings` table

### Synthetic serials everywhere

**Cause:** GE export doesn't include serial numbers for some items.

**Solution:** This is expected behavior for items without real serials. Models typically don't have serials, only appliances do.

### Items appear in DB but not in UI

**Cause:** Frontend isn't querying for FG/STA inventory types.

**Fix:** Update inventory queries to include `inventory_type IN ('ASIS', 'FG', 'STA')`.

## Questions?

Refer to:
- `services/ge-sync/README.md` - Service architecture and deployment
- `docs/product-lifecycle.md` - Data lifecycle and guardrails
- `research/ge-dms/docs/GE-DMS-ENDPOINTS.md` - GE DMS API discovery
