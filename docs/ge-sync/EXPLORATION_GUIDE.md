# GE DMS Exploration Guide

## Overview

This guide explains how to explore the GE DMS system to discover new data sources, understand workflows, and map available data without breaking the production sync service.

**CRITICAL**: The production sync service must continue working during exploration. Never modify production code or credentials during exploration sessions.

---

## Prerequisites Checklist

Before starting exploration, verify:

- [ ] Supabase credentials configured in `.env`
- [ ] GE SSO credentials stored in Supabase `settings` table for location `00000000-0000-0000-0000-000000000001`
- [ ] Node.js and npm installed
- [ ] Playwright browsers installed (`npx playwright install chromium`)
- [ ] No other exploration sessions running (check for open Chrome instances)
- [ ] Production sync service is NOT running (or running separately without interference)

### Verify Credentials

```bash
# Check if .env has Supabase credentials
grep -q "SUPABASE_URL" services/ge-sync/.env && echo "✅ Supabase URL configured" || echo "❌ Missing SUPABASE_URL"

# Test database connection
cd services/ge-sync
npx tsx -e "import { getLocationConfig } from './src/db/supabase.js'; getLocationConfig('00000000-0000-0000-0000-000000000001').then(c => console.log('✅ Credentials found:', !!c.ssoUsername)).catch(e => console.log('❌ Error:', e.message))"
```

If credentials are missing, see `docs/ge-sync/SECRETS.md` for setup instructions.

---

## Exploration Scripts

### Available Scripts

Located in `services/ge-sync/src/scripts/`:

1. **`catalogExplore.ts`** - Crawl the full GE DMS catalog by URL
   - Usage: `npx tsx src/scripts/catalogExplore.ts`
   - Writes HTML/text/screenshots to `.ge-dms-archive/`

2. **`navigateDirect.ts`** - Navigate directly to a URL path
   - Usage: `npx tsx src/scripts/navigateDirect.ts "/dms/path"`
   - Example: `npx tsx src/scripts/navigateDirect.ts "/dms/newasis"`
   - Useful when you know the exact URL

### Script Output

All scripts output to:
- **Archive**: `.ge-dms-archive/` (HTML, text, screenshots)
- **Console logs**: Show authentication, navigation, and export button detection

---

## Exploration Workflow

### Step 1: Reference GE DMS Documentation

**BEFORE exploring**, check existing documentation:
- `docs/ge-sync/GE_ENDPOINT_FIELDS.md` - Known data exports and field mappings
- `docs/ge-sync/GE_DMS_PAGES.md` - Complete page catalog

Search these docs first to answer questions like:
- "Where can I export order data?"
- "What fields are in the ASIS load export?"
- "How does the check-in process work?"

### Step 2: Plan Your Exploration

**DO NOT** immediately start scripting. Instead:

1. **Define the goal**: What data/workflow are you investigating?
2. **Check documentation**: Has this been explored before?
3. **Identify the page**: Which dashboard page likely has this data?
4. **Note export options**: Does the page have a "Spreadsheet" or "Export" button?

### Step 3: Single Browser Session Exploration

**IMPORTANT**: Reuse a single browser session instead of starting fresh each time.

```bash
cd services/ge-sync

# Start exploration - browser stays open
npx tsx src/scripts/navigateDirect.ts "/dms/newasis"

# Browser is now open and authenticated
# Navigate to next page by running another script
# (the browser will reuse the session)

# When done, press Ctrl+C to close browser
```

**DO NOT** kill and restart the browser for each page unless absolutely necessary.

### Step 4: Pause and Ask for Approval

**When to stop and ask the user for approval:**

1. **Authentication fails** - Credentials issue, can't proceed
2. **Page structure unexpected** - UI changed, scripts don't work
3. **New workflow discovered** - Found a workflow not documented
4. **Breaking production risk** - Action might affect live sync service
5. **Multiple valid approaches** - Unsure which path to take
6. **Script modification needed** - Need to change script logic

**What to include in approval request:**
- What you were trying to do
- What stopped you (error, blocker, uncertainty)
- What you need to change or clarify
- Proposed next steps

**Example:**
```
I was exploring the "Downloads" page and found 5 export types.
The script detected export buttons but I'm unsure which reports
to download first without creating large files or duplicate data.

Options:
1. Download all 5 reports to sample data
2. Download only CHECK-IN report (most relevant to current sync)
3. Ask user which reports are priority

Which approach should I take?
```

---

## Browser Instance Management

### Prevent Browser Leaks

**Problem**: Running exploration scripts in background leaves Chrome instances open.

**Solution**: Always run scripts in foreground when possible, or track background tasks.

```bash
# ✅ GOOD - Foreground, easy to stop with Ctrl+C
npx tsx src/scripts/exploreLink.ts "ASIS"

# ⚠️  USE CAREFULLY - Background task
npx tsx src/scripts/exploreLink.ts "ASIS" &
# Must manually kill later: pkill -f chromium
```

### Check for Orphaned Browsers

```bash
# List Chrome instances from exploration
ps aux | grep -i chromium | grep headless=false

# Kill all test browsers
pkill -f "chromium.*headless=false"
```

### Best Practice

At the end of each exploration session:
1. Press Ctrl+C to stop the script gracefully
2. Verify browser closed: `ps aux | grep chromium`
3. Kill any orphaned instances if needed

---

## Production Safety Rules

### DO NOT

- ❌ Modify `services/ge-sync/src/sync/` files during exploration
- ❌ Change `.env` credentials while sync service is running
- ❌ Run exploration scripts that POST/PUT data (only GET/read operations)
- ❌ Click "Delete" or destructive actions in GE DMS during exploration
- ❌ Use production database for test data

### DO

- ✅ Read-only operations (screenshots, page content, export downloads)
- ✅ Use separate terminal session for exploration vs sync service
- ✅ Test new endpoints in isolation before integrating into sync
- ✅ Document findings before implementing code changes

### Verify Sync Service Status

```bash
# Check if sync service is running
ps aux | grep "pnpm dev" | grep -v grep
```

---

## Common Issues and Solutions

### Issue: "SSO credentials not configured"

**Cause**: Missing or incorrect credentials in Supabase.

**Solution**:
1. Check `.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
2. Verify `settings` table has entry for location ID `00000000-0000-0000-0000-000000000001`
3. Ensure `ssoUsername` and `ssoPassword` fields are populated
4. See `docs/ge-sync/SECRETS.md` for detailed setup

### Issue: Browser hangs or navigation times out

**Cause**: Page requires manual interaction or doesn't exist.

**Solution**:
1. Take screenshot to see current state
2. Check if page opened in new tab (script may be on wrong tab)
3. Try direct URL navigation with `navigateDirect.ts`
4. **Ask user for approval** if page structure is unexpected

### Issue: "Could not find link"

**Cause**: Link text doesn't match exactly or page layout changed.

**Solution**:
1. Check screenshot to see actual link text
2. Try variations: "ASIS" vs "Asis" vs "asis"
3. Use direct URL if known: `navigateDirect.ts "/dms/newasis"`
4. **Ask user** if you can't find the link after 2-3 attempts

### Issue: Page has no export button but contains data

**Cause**: Not all pages have export functionality.

**Solution**:
1. Check GE_DMS_PAGES.md to see if export is expected
2. Note in documentation: "Workflow page - no export available"
3. If data is critical, **ask user** if manual data entry or API needed

---

## Data Export Strategy

### Identifying Export Pages

When exploring a new page, check for:
- Buttons labeled: "Spreadsheet", "Excel", "CSV", "Export", "Download"
- Links that say "Click HERE to export"
- Dropdowns with export format options

### Documenting Exports

For each export found, document:
1. **Page name and URL**
2. **Export button text** (exact wording)
3. **Filters available** (date range, location, status, etc.)
4. **Expected data** (what this export contains)
5. **File format** (CSV, Excel, PDF, etc.)

### Downloading Sample Data

**Before downloading large exports:**
1. Check filters - set narrow date range or limit results
2. **Ask user approval** if file might be very large
3. Save to `.ge-dms-archive/` for consistency
4. Document file location and size

**Example:**
```bash
# Document what you're about to download
echo "Downloading ASIS Load export with filter: Last 7 days, Location 9SU"

# Download (if script supports it)
# Then document the file
ls -lh .ge-dms-archive/*.csv
```

---

## Session Cleanup

At the end of exploration session:

```bash
# 1. Stop any running scripts
# Press Ctrl+C in each terminal

# 2. Kill orphaned browsers
pkill -f "chromium.*headless=false"

# 3. Clean up temp files (optional)
# rm .ge-dms-archive/*.png .ge-dms-archive/*.txt

# 4. Document findings
# Update GE_DMS_PAGES.md or relevant docs

# 5. Commit changes if documentation updated
git status
git add docs/ge-sync/
git commit -m "docs(ge-sync): update exploration findings"
```

---

## Next Handoff

When starting a fresh agent session, the agent should:

1. **Read this guide first** (`EXPLORATION_GUIDE.md`)
2. **Check existing docs** (`GE_DMS_PAGES.md`, `GE_ENDPOINT_FIELDS.md`)
3. **Verify prerequisites** (credentials, environment)
4. **Reference documented pages** before exploring
5. **Ask for approval** at decision points
6. **Clean up** browser instances when done

**Expected outcome**: Agent can explore GE DMS and answer questions about available data without repeating credential issues, browser leaks, or breaking production sync.

---

## Quick Reference Commands

```bash
# Navigate to ge-sync directory
cd services/ge-sync

# Explore a page by link text
npx tsx src/scripts/exploreLink.ts "ASIS"

# Navigate to direct URL
npx tsx src/scripts/navigateDirect.ts "/dms/newasis"

# Check for running browsers
ps aux | grep chromium | grep headless=false

# Kill test browsers
pkill -f "chromium.*headless=false"

# Verify credentials
npx tsx -e "import { getLocationConfig } from './src/db/supabase.js'; getLocationConfig('00000000-0000-0000-0000-000000000001').then(c => console.log('✅', !!c.ssoUsername))"

# Check if sync service is running
ps aux | grep "npm run sync" | grep -v grep
```

---

## Reference Documentation

- **GE DMS Pages Catalog**: `docs/ge-sync/GE_DMS_PAGES.md`
- **Field Mappings**: `docs/ge-sync/GE_ENDPOINT_FIELDS.md`
- **Auth Setup**: `docs/ge-sync/SECRETS.md`

## Audience Notes

### For Developers
- Use this guide for safe exploration and data capture.

### For Operators
- This is internal tooling; daily workflows are in the Docs UI.

### For Agent
- Use this for exploration process only, not UI instructions.
