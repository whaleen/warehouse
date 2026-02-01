# Build Commands Testing Checklist

**Date:** 2026-02-01
**Purpose:** Verify all build pipelines work after Netlify sunset and Doppler policy changes

---

## Prerequisites

Before testing, ensure you have:
- [ ] Doppler CLI installed and authenticated (`doppler login`)
- [ ] Node.js 20+ installed
- [ ] pnpm installed
- [ ] All dependencies installed (`pnpm install` in each project)

---

## 1. Main App (Frontend) - Local Development

### With Doppler (Expected: ✅ Works)

```bash
# From project root
cd /Users/josh/Projects/_archive/warehouse

# Test dev server
pnpm dev
# Expected: Vite dev server starts on http://localhost:5173
# Expected: Doppler injects Supabase secrets
# Action: Open browser, verify app loads
# Action: Ctrl+C to stop

# Test build with Doppler
pnpm run build
# Expected: TypeScript compiles, Vite builds to dist/
# Expected: No errors
```

**Checklist:**
- [ ] `pnpm dev` starts without errors
- [ ] App loads in browser at localhost:5173
- [ ] Supabase connection works (can see data)
- [ ] `pnpm run build` completes successfully
- [ ] `dist/` directory created

---

## 2. Main App (Frontend) - Production Build

### Without Doppler (Expected: ✅ Works - for Vercel)

```bash
# From project root

# Test production build (what Vercel runs)
pnpm run build:prod
# Expected: Builds without Doppler
# Expected: TypeScript compiles, Vite builds to dist/
# Expected: No errors (env vars not needed at build time)
```

**Checklist:**
- [ ] `pnpm run build:prod` completes successfully
- [ ] No Doppler errors
- [ ] `dist/` directory created
- [ ] Build output looks identical to `pnpm run build`

**Note:** This is the command Vercel runs. It doesn't need Doppler because:
1. Vite build doesn't embed secrets (they're loaded at runtime in browser)
2. Vercel injects env vars via its own system

---

## 3. Marketing Site - Local Development

```bash
# From marketing site directory
cd /Users/josh/Projects/_archive/warehouse/marketing-site

# Test dev server
pnpm dev
# Expected: Vite dev server starts on http://localhost:5175
# Expected: No secrets needed (marketing site is public)
# Action: Open browser, verify site loads
# Action: Ctrl+C to stop

# Test build
pnpm run build
# Expected: TypeScript compiles, Vite builds to dist/
# Expected: No errors
```

**Checklist:**
- [ ] `pnpm dev` starts without errors
- [ ] Site loads in browser at localhost:5175
- [ ] `pnpm run build` completes successfully
- [ ] `dist/` directory created

---

## 4. GE Sync Service - Local Development

### Without Doppler (Expected: ✅ Works with .env)

```bash
# From ge-sync directory
cd /Users/josh/Projects/_archive/warehouse/services/ge-sync

# Verify .env exists
test -f .env && echo "✅ .env exists" || echo "❌ .env missing - copy from .env.example"

# Test build
pnpm run build
# Expected: TypeScript compiles to dist/
# Expected: No errors

# Test dev server
pnpm run dev
# Expected: Service starts on port 3001
# Expected: Loads secrets from .env
# Expected: "Server running on port 3001"
# Action: Ctrl+C to stop after confirming it starts
```

**Checklist:**
- [ ] `.env` file exists and has valid Supabase credentials
- [ ] `pnpm run build` completes successfully
- [ ] `pnpm run dev` starts without Doppler errors
- [ ] Service connects to Supabase successfully
- [ ] No "SUPABASE_URL is not defined" errors

**Expected Output:**
```
✅ Supabase connected
Server running on port 3001
Listening for sync requests...
```

---

## 5. GE Sync Service - Agent/Script Usage

### Scripts (Expected: ✅ Works with .env)

```bash
# From ge-sync directory
cd /Users/josh/Projects/_archive/warehouse/services/ge-sync

# Test brand products import script
pnpm run import:brand-products
# Expected: Loads from .env
# Expected: Connects to Supabase
# Expected: Downloads and imports brand product data

# Test exploration script
npx tsx src/scripts/exploreLink.ts "ASIS"
# Expected: Loads from .env via dotenv/config
# Expected: Authenticates with GE DMS
# Expected: Explores ASIS page
```

**Checklist:**
- [ ] `import:brand-products` runs without Doppler errors
- [ ] Script connects to Supabase
- [ ] Exploration scripts work
- [ ] No authentication errors

**Note:** These scripts are what Claude agents run. They MUST work without Doppler.

---

## 6. Vercel Deployment Simulation

### Test what Vercel will run

```bash
# From project root
cd /Users/josh/Projects/_archive/warehouse

# Clean dist
rm -rf dist

# Run exact Vercel build command
pnpm run build:prod

# Verify output
ls -lh dist/
```

**Checklist:**
- [ ] Build completes without errors
- [ ] No Doppler required
- [ ] `dist/index.html` exists
- [ ] `dist/assets/` directory has JS/CSS bundles
- [ ] File sizes look reasonable

---

## 7. Environment Variable Verification

### Check that secrets are isolated properly

```bash
# From project root

# Main app should use Doppler for local dev
doppler secrets
# Expected: Shows SUPABASE_URL, SUPABASE_ANON_KEY, etc.

# GE sync should NOT use Doppler
cd services/ge-sync
cat .env | grep SUPABASE_URL
# Expected: Shows local .env values
```

**Checklist:**
- [ ] Main app Doppler config shows Supabase vars
- [ ] GE sync `.env` has different/local Supabase vars (or same is fine)
- [ ] No cross-contamination between environments

---

## 8. Railway Deployment Check (Optional)

### If ge-sync is currently deployed to Railway

```bash
# Check Railway environment variables
railway variables

# Should see:
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - API_KEY
# - CORS_ORIGIN
# - PLAYWRIGHT_HEADLESS=true
# - NODE_ENV=production

# Check logs for successful start
railway logs --filter "Server running"
```

**Checklist:**
- [ ] All required env vars are set in Railway
- [ ] `CORS_ORIGIN` points to Vercel app (not Netlify)
- [ ] Service starts successfully
- [ ] No Doppler errors in logs

---

## Common Issues & Solutions

### Issue: "Doppler CLI not authenticated"

**Solution:**
```bash
doppler login
# Follow browser authentication flow
```

### Issue: "SUPABASE_URL is not defined" in ge-sync

**Solution:**
```bash
cd services/ge-sync
cp .env.example .env
# Edit .env with your actual Supabase credentials
```

### Issue: "Module not found" errors

**Solution:**
```bash
# Clean install all dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: Build works locally but fails on Vercel

**Solution:**
- Check Vercel environment variables are set
- Verify `vercel.json` uses `build:prod` command
- Check Vercel build logs for specific error

---

## Success Criteria

All builds pass when:

- ✅ Main app `pnpm dev` works with Doppler
- ✅ Main app `pnpm run build:prod` works WITHOUT Doppler
- ✅ Marketing site builds successfully
- ✅ GE sync runs without Doppler (uses `.env`)
- ✅ GE sync scripts work for agents
- ✅ No authentication or secret loading errors
- ✅ All `dist/` outputs look correct

---

## Next Steps After Testing

Once all tests pass:

1. **Update Vercel** - Verify environment variables are set
2. **Deploy to Vercel** - Push to main and verify build
3. **Update Railway** - Change CORS_ORIGIN if needed
4. **Update documentation** - Mark this testing as complete
5. **Remove Doppler from ge-sync permanently** - Already done ✅

---

## Git Hooks

### Pre-commit Hook

Runs ESLint and TypeScript checks before each commit:
- Lints and auto-fixes staged `.ts` and `.tsx` files
- Runs `tsc --noEmit` to catch type errors
- Prevents commits with lint/type errors

### Pre-push Hook

Runs production build before pushing to remote:
- Executes `pnpm run build:prod`
- Catches TypeScript errors that would break Vercel deployment
- Prevents pushing broken code to main

**Bypassing Hooks (Use Sparingly)**

When iterating rapidly or fixing urgent issues, you can skip hooks:

```bash
# Skip pre-commit hook
git commit --no-verify -m "quick fix"

# Skip pre-push hook
git push --no-verify
```

⚠️ **Important**: Only use `--no-verify` when you're certain the code is safe. The hooks exist to prevent breaking production.

**When to use --no-verify:**
- ✅ Pushing documentation-only changes
- ✅ Emergency hotfixes (but verify locally first!)
- ✅ Rapid iteration on a feature branch
- ❌ Never on main branch without testing
- ❌ Never when you know there are errors

---

## Testing Notes

Use this space to record any issues found during testing:

```
Date: 2026-02-01
Tested by: [Your name]

Results:
- Main app dev:
- Main app prod build:
- Marketing site:
- GE sync:
- Scripts:

Issues found:
[List any issues here]

Resolutions:
[How you fixed them]
```
