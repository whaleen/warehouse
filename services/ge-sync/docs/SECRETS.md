# Secrets and Environment Configuration

Complete guide for configuring secrets across all ge-sync service scenarios: local development, deployed service, and exploration scripts.

---

## Overview

The ge-sync service requires two types of credentials:

1. **Infrastructure Secrets** - For Supabase access, API authentication
2. **GE SSO Credentials** - For authenticating with GE DMS (stored in Supabase)

**CRITICAL**: GE SSO credentials are stored IN Supabase `location_configs` table, NOT in environment variables. This allows per-location credentials and keeps sensitive data out of code.

---

## Required Environment Variables

### Infrastructure Secrets (Environment Variables)

| Variable | Required For | Description | Example | Default |
|----------|-------------|-------------|---------|---------|
| `SUPABASE_URL` | All | Supabase project URL | `https://abc123.supabase.co` | ❌ None - **Required** |
| `SUPABASE_SERVICE_KEY` | All | Supabase service role key | `eyJhbGci...` (JWT token) | ❌ None - **Required** |
| `API_KEY` | Service | Auth key for HTTP requests to service | Any secure string | ❌ None - **Required** |
| `CORS_ORIGIN` | Service | Frontend origin for CORS | `http://localhost:5173` | ❌ None - **Required** |
| `PORT` | Service | HTTP server port | `3001` | ✅ `3001` (optional) |
| `NODE_ENV` | All | Environment mode | `development`, `production` | ✅ `development` (optional) |
| `PLAYWRIGHT_HEADLESS` | Scripts/Service | Run browser headless | `true` or `false` | ✅ `true` (optional) |

**Note:** Variables with ✅ defaults are optional and can be omitted from `.env`. The service will use the default value if not specified.

### GE SSO Credentials (Stored in Supabase)

GE SSO credentials are stored in the `location_configs` table:

```sql
SELECT id, sso_username, sso_password
FROM location_configs
WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Fields**:
- `sso_username` - GE SSO username
- `sso_password` - GE SSO password (encrypted at rest by Supabase)

---

## Setup: Local Development

### 1. Infrastructure Secrets

Copy `.env.example` to `.env`:

```bash
cd services/ge-sync
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Required: Get these from Supabase project settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...your_service_key...

# Required: Generate a secure API key
API_KEY=your_secure_api_key_here

# Required: Frontend URL (Vite dev server)
CORS_ORIGIN=http://localhost:5173

# Optional (these have defaults, can be omitted):
# PORT=3001                    # Default: 3001
# NODE_ENV=development         # Default: development
# PLAYWRIGHT_HEADLESS=false    # Default: true (set to false to see browser)
```

**Getting Supabase Credentials**:
1. Go to Supabase Dashboard → Project Settings → API
2. Copy **Project URL** → `SUPABASE_URL`
3. Copy **service_role key** → `SUPABASE_SERVICE_KEY`

### 2. GE SSO Credentials in Database

**IMPORTANT**: GE SSO credentials must be in Supabase, not `.env`.

Insert/update in `location_configs` table:

```sql
-- Check if location exists
SELECT id FROM locations WHERE id = '00000000-0000-0000-0000-000000000001';

-- Insert/update credentials
INSERT INTO location_configs (id, sso_username, sso_password)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'your_ge_username',
  'your_ge_password'
)
ON CONFLICT (id)
DO UPDATE SET
  sso_username = EXCLUDED.sso_username,
  sso_password = EXCLUDED.sso_password;
```

**Via Supabase Dashboard**:
1. Go to Table Editor → `location_configs`
2. Find row with ID `00000000-0000-0000-0000-000000000001`
3. Edit `sso_username` and `sso_password` fields
4. Save

### 3. Verify Local Setup

```bash
# Test Supabase connection
npx tsx -e "
import { getLocationConfig } from './src/db/supabase.js';
getLocationConfig('00000000-0000-0000-0000-000000000001')
  .then(c => console.log('✅ Supabase connected, SSO creds:', !!c.ssoUsername, !!c.ssoPassword))
  .catch(e => console.log('❌ Error:', e.message));
"

# Test build
pnpm run build

# Test sync service (will attempt to auth with GE)
pnpm run sync
```

---

## Setup: Deployed Service (Railway)

### 1. Railway Environment Variables

Set in Railway Dashboard → Project → Variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
API_KEY=your_secure_api_key
CORS_ORIGIN=https://your-app.vercel.app
PORT=3001
PLAYWRIGHT_HEADLESS=true
NODE_ENV=production
```

**Via Railway CLI**:

```bash
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_SERVICE_KEY=eyJhbGci...
railway variables set API_KEY=your_api_key
railway variables set CORS_ORIGIN=https://your-app.vercel.app
railway variables set PLAYWRIGHT_HEADLESS=true
railway variables set NODE_ENV=production
```

### 2. GE SSO Credentials

**Same as local** - credentials are in Supabase `location_configs` table.

Railway service reads from the same Supabase database, so no additional setup needed.

### 3. Verify Deployed Setup

```bash
# Check Railway logs
railway logs

# Should see: "✅ Supabase connected, SSO creds: true true"
# Or similar authentication success messages
```

---

## Setup: Exploration Scripts

Exploration scripts (exploreLink.ts, navigateDirect.ts, etc.) use the **same credentials** as the sync service.

### Prerequisites

1. **Local `.env` configured** (as above)
2. **GE SSO credentials in Supabase** (as above)

### Running Exploration Scripts

```bash
cd services/ge-sync

# Authenticate and explore a page
npx tsx src/scripts/exploreLink.ts "ASIS"

# Direct URL navigation
npx tsx src/scripts/navigateDirect.ts "/dms/newasis"
```

**Scripts automatically**:
1. Load `.env` (via `dotenv/config`)
2. Connect to Supabase using `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
3. Fetch GE SSO credentials from `location_configs` table
4. Authenticate with GE DMS using those credentials

### Troubleshooting Exploration Auth

**Error: "SSO credentials not configured"**

```bash
# Verify credentials exist in database
npx tsx -e "
import { getLocationConfig } from './src/db/supabase.js';
getLocationConfig('00000000-0000-0000-0000-000000000001')
  .then(c => {
    console.log('ssoUsername:', c.ssoUsername || '❌ MISSING');
    console.log('ssoPassword:', c.ssoPassword ? '✅ SET' : '❌ MISSING');
  });
"
```

**Expected output**:
```
ssoUsername: your_username
ssoPassword: ✅ SET
```

**If missing**: Add credentials to Supabase (see Local Setup step 2)

---

## Secrets Checklist

### For Local Development

- [ ] `.env` file exists with all required variables
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are valid
- [ ] GE SSO credentials in `location_configs` table
- [ ] Location ID `00000000-0000-0000-0000-000000000001` exists in `locations` table
- [ ] Build succeeds: `pnpm run build`
- [ ] Credentials verified: `npx tsx -e "import { getLocationConfig } from './src/db/supabase.js'; ..."`

### For Deployed Service (Railway)

- [ ] All environment variables set in Railway
- [ ] `CORS_ORIGIN` matches frontend URL
- [ ] `PLAYWRIGHT_HEADLESS=true` for production
- [ ] GE SSO credentials in Supabase (same database)
- [ ] Railway logs show successful authentication

### For Exploration Scripts

- [ ] Same as Local Development
- [ ] Scripts can run: `npx tsx src/scripts/exploreLink.ts "ASIS"`
- [ ] Browser authenticates successfully
- [ ] No "SSO credentials not configured" errors

---

## Security Best Practices

### DO

✅ Store GE SSO credentials in Supabase `location_configs` table
✅ Use Supabase Row Level Security (RLS) to protect credentials
✅ Keep `.env` file in `.gitignore`
✅ Use different API keys for local vs deployed
✅ Rotate API keys periodically
✅ Use `service_role` key for server-side only (never expose to client)

### DO NOT

❌ Put GE SSO credentials in `.env` file
❌ Commit `.env` to git
❌ Share `SUPABASE_SERVICE_KEY` publicly
❌ Use same API key for dev and production
❌ Hardcode credentials in source code

---

## Credential Storage Architecture

```
┌─────────────────────────────────────────┐
│  Infrastructure Secrets                 │
│  (Environment Variables)                │
│                                          │
│  • SUPABASE_URL                         │
│  • SUPABASE_SERVICE_KEY                 │
│  • API_KEY                              │
│  • CORS_ORIGIN                          │
└──────────────┬──────────────────────────┘
               │
               │ Used to connect to...
               ▼
┌─────────────────────────────────────────┐
│  Supabase Database                      │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ location_configs table             │ │
│  │                                    │ │
│  │ • id (location)                    │ │
│  │ • sso_username (GE SSO)            │ │
│  │ • sso_password (GE SSO)            │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
               │
               │ Fetched by service/scripts
               ▼
┌─────────────────────────────────────────┐
│  Playwright Browser Automation          │
│                                          │
│  • Navigates to GE DMS SSO login       │
│  • Fills username/password              │
│  • Authenticates                        │
│  • Navigates to dashboard               │
└─────────────────────────────────────────┘
```

**Why this architecture?**

1. **Per-location credentials** - Different warehouses can have different GE accounts
2. **Centralized management** - Update credentials in one place (database)
3. **Secure storage** - Supabase encrypts data at rest
4. **No code changes** - Rotate credentials without redeploying
5. **Audit trail** - Database tracks credential changes

---

## Verification Commands

### Quick Health Check

```bash
# Full verification
cd services/ge-sync

echo "1. Checking .env..."
test -f .env && echo "✅ .env exists" || echo "❌ .env missing"

echo "2. Checking Supabase connection..."
npx tsx -e "import { createClient } from '@supabase/supabase-js'; const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); c.from('locations').select('count').single().then(() => console.log('✅ Supabase connected')).catch(e => console.log('❌ Supabase error:', e.message));"

echo "3. Checking GE SSO credentials..."
npx tsx -e "import { getLocationConfig } from './src/db/supabase.js'; getLocationConfig('00000000-0000-0000-0000-000000000001').then(c => console.log('✅ SSO creds:', !!c.ssoUsername && !!c.ssoPassword ? 'PRESENT' : 'MISSING')).catch(e => console.log('❌ Error:', e.message));"

echo "4. Checking build..."
pnpm run build && echo "✅ Build successful" || echo "❌ Build failed"
```

### Railway Deployment Check

```bash
# Check Railway environment variables
railway variables

# Check Railway logs for auth
railway logs --filter "auth"
```

---

## Common Issues

### Issue: "Cannot find module @supabase/supabase-js"

**Solution**: Install dependencies
```bash
pnpm install
```

### Issue: "SUPABASE_URL is not defined"

**Solution**: `.env` file missing or not loaded
```bash
# Verify .env exists
cat .env | grep SUPABASE_URL

# Scripts should load it automatically via:
import 'dotenv/config';
```

### Issue: "Row Level Security" blocking access

**Solution**: Use `service_role` key, not `anon` key
```bash
# Check your .env uses service_role key
echo $SUPABASE_SERVICE_KEY | cut -c1-20
# Should start with: eyJhbGci...
```

### Issue: GE SSO login fails

**Solutions**:
1. Verify credentials in database are correct
2. Check if GE SSO password was recently changed
3. Try logging in manually at https://dms-erp-aws-prd.geappliances.com/
4. Update credentials in Supabase if needed

---

## Next Steps

After setting up secrets:

1. **Test local sync**: `pnpm run sync`
2. **Test exploration**: `npx tsx src/scripts/exploreLink.ts "ASIS"`
3. **Deploy to Railway**: `railway up`
4. **Verify deployment**: Check Railway logs for auth success

For deployment details, see Railway documentation or run `railway help`.
