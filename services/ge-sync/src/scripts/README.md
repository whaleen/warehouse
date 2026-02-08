# GE DMS Exploration Scripts

Scripts for exploring and documenting the GE Dealer Management System.

**IMPORTANT**: Read `../../docs/EXPLORATION_GUIDE.md` before using these scripts.

---

## Available Scripts

### `catalogExplore.ts`

Navigate the GE DMS catalog by URL and capture HTML/text/screenshots to `.ge-dms-archive/`.

**Usage**:
```bash
npx tsx src/scripts/catalogExplore.ts
```

**What it does**:
1. Authenticates with GE SSO using credentials from Supabase
2. Loads all URLs from `docs/ge-sync/GE_DMS_PAGES.md`
3. Captures screenshot + HTML + text per page

---

### `navigateDirect.ts`

Navigate directly to a specific GE DMS URL path.

**Usage**:
```bash
npx tsx src/scripts/navigateDirect.ts "/dms/path"
```

**Examples**:
```bash
npx tsx src/scripts/navigateDirect.ts "/dms/newasis"
npx tsx src/scripts/navigateDirect.ts "/dms/orderdata"
npx tsx src/scripts/navigateDirect.ts "/dms/checkin/downloadsindex"
```

**What it does**:
1. Authenticates with GE SSO
2. Navigates directly to specified URL path
3. Screenshots and saves content (same as exploreLink)
4. Detects export buttons
5. Keeps browser open

**Use when**:
- You know the exact URL
- Link clicking isn't working
- Testing specific page access

---

### `explore.ts`

Generic exploration template.

**Use**: Copy and modify for specific exploration tasks.

---

## Output Files

All scripts output to `.ge-dms-archive/`:

- **Screenshots**: `.ge-dms-archive/ge-{timestamp}.png`
  - Full-page PNG screenshot
  - Includes all visible content (may be very tall)

- **Page Content**: `.ge-dms-archive/ge-content-{timestamp}.txt`
  - Extracted text content from `document.body.innerText`
  - Useful for searching/analyzing page structure
  - Does not include HTML markup

**Cleanup**:
```bash
# List recent exploration files
ls -lt .ge-dms-archive | head -20

# Clean up old files (optional)
rm .ge-dms-archive/*.png .ge-dms-archive/*.txt
```

---

## Authentication

All scripts authenticate using credentials from Supabase:

1. **Environment**: `.env` file must have `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
2. **Database**: `settings` table must have entry for location ID `00000000-0000-0000-0000-000000000001`
3. **Fields**: `ssoUsername` and `ssoPassword` must be populated

**Verify credentials**:
```bash
cd services/ge-sync
npx tsx -e "import { getLocationConfig } from './src/db/supabase.js'; getLocationConfig('00000000-0000-0000-0000-000000000001').then(c => console.log('✅ Found:', !!c.ssoUsername, !!c.ssoPassword))"
```

If credentials are missing, see `../../docs/ge-sync/SECRETS.md` for setup.

---

## Browser Management

### Headless vs Headed

Scripts run with `headless: false` to allow visual debugging.

```typescript
browser = await chromium.launch({
  headless: false, // Browser window visible
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```

**Change to headless**:
- Set `headless: true` for background execution
- Useful for automated runs
- Cannot visually debug issues

### Browser Lifecycle

Scripts may keep the browser open depending on the task. Use Ctrl+C to close.

## Export Button Detection

Scripts automatically detect common export button patterns:

```typescript
const exportButtons = await page.$$eval(
  'input[value*="SpreadSheet"], input[value*="Spreadsheet"], input[value*="Excel"], input[value*="Download"], button:has-text("Export"), button:has-text("Download")',
  els => els.map(el => (el as HTMLInputElement).value || el.textContent?.trim() || '')
);
```

**Detected patterns**:
- `<input value="Excel Spreadsheet">`
- `<input value="CSV Spreadsheet">`
- `<button>Export</button>`
- `<button>Download</button>`
- Variations: "SpreadSheet", "Spreadsheet", etc.

**Outputs**: List of detected export buttons to console.

---

## Common Issues

### Issue: "SSO credentials not configured"

**Solution**: Check Supabase credentials (see Authentication section above).

### Issue: "Could not find link: X"

**Solution**:
1. Check exact link text (case-sensitive)
2. Use `navigateDirect.ts` with known URL instead
3. Take screenshot to see actual link text

### Issue: Browser hangs/navigation timeout

**Solution**:
1. Check screenshot to see current state
2. Page may have opened in new tab (script can't detect all tabs)
3. Try direct URL navigation

### Issue: Page content empty

**Solution**:
- Page may be dynamic/JavaScript-heavy
- Content loads after initial navigation
- Check screenshot to verify page loaded

---

## Development

### Modify Scripts

Scripts use:
- **Playwright**: Browser automation
- **TypeScript**: Type safety
- **tsx**: Direct TS execution

**Run with modifications**:
```bash
npx tsx src/scripts/your-script.ts
```

**No compilation needed** - `tsx` executes TypeScript directly.

### Add New Scripts

1. Copy `explore.ts` as template
2. Modify navigation logic
3. Keep authentication and documentation helpers
4. Document in this README

### Helper Functions

**`documentPage()`** - Captures page state:
- Screenshot
- Text content
- Export button detection
- Returns: `{ url, title, screenshot, contentFile }`

**`authenticate()`** - GE SSO login:
- Fetches credentials from Supabase
- Navigates to GE DMS
- Handles SSO redirect
- Sets up popup listener

---

## Production Safety

### DO NOT

- ❌ Click destructive buttons (Delete, Cancel, etc.)
- ❌ POST/PUT operations (only read/GET)
- ❌ Modify data in GE DMS
- ❌ Use production credentials for testing

### DO

- ✅ Read-only operations (screenshots, exports)
- ✅ Document findings before implementing
- ✅ Test in isolation from production sync service
- ✅ Clean up browser instances when done

---

## See Also

- **EXPLORATION_GUIDE.md** - Complete exploration workflow
- **GE_DMS_PAGES.md** - Catalog of documented pages
- **GE_ENDPOINT_FIELDS.md** - Field mapping reference
- **SECRETS.md** - Credential setup instructions

## Audience Notes

### For Developers
- Use this to run exploration scripts safely.

### For Operators
- This is internal tooling, not daily workflow documentation.

### For Agent
- Use only for exploration process guidance.
