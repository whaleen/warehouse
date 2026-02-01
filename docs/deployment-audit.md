# Deployment & Secrets Management Audit

**Date:** 2026-02-01
**Status:** ✅ Ready for Netlify sunset

## Executive Summary

- ✅ **Netlify**: No runtime dependencies - safe to sunset
- ✅ **Vercel**: Properly configured as primary deployment
- ⚠️ **Doppler**: Mixed usage - needs documentation update

---

## Netlify Sunset Confirmation

### Current Netlify Footprint

**Files Found:**
- `.netlify/state.json` - Local CLI state only
- Claude MCP server enabled in settings
- Documentation references in `.agent/cli-tools.md`
- Example CORS origins in ge-sync docs

**Runtime Dependencies:** NONE ✅
- No `@netlify/*` packages in dependencies
- No Netlify Functions, Forms, Blobs, or Image CDN usage
- No runtime code calling Netlify services

### Safe to Remove

1. **`.netlify/`** directory - Just local CLI state
2. **Netlify MCP server** from `.claude/settings.local.json`
3. **Documentation references** - Update to Vercel equivalents
4. **Example CORS origins** - Replace with Vercel domains

### Action Items

- [ ] Delete `.netlify/` directory
- [ ] Remove Netlify MCP from Claude settings
- [ ] Update `.agent/cli-tools.md` to remove Netlify CLI commands
- [ ] Update `services/ge-sync/docs/SECRETS.md` CORS examples

---

## Vercel Configuration

### Current Setup ✅

**File:** `vercel.json`
```json
{
  "buildCommand": "pnpm run build:prod",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "pnpm install"
}
```

**Deployment Target:**
- Uses `build:prod` script (NO Doppler)
- Expects secrets via Vercel environment variables
- Output: `dist/` directory

**Status:** Correctly configured ✅

---

## Doppler Usage Inventory

### Where Doppler IS Used

#### 1. Main App (warehouse)

**Local Development:**
```json
{
  "dev": "doppler run -- vite",
  "build": "doppler run -- tsc -b && vite build",
  "preview": "doppler run -- vite preview"
}
```

**Production Build (Vercel):**
```json
{
  "build:prod": "tsc -b && vite build"  // NO Doppler ✅
}
```

**Why this works:**
- Local dev: Doppler injects secrets from Doppler dashboard
- Vercel deployment: Uses `build:prod` which reads from Vercel env vars

#### 2. GE Sync Service

**Local Development:**
```json
{
  "dev": "doppler run -- tsx watch src/index.ts",
  "import:brand-products": "doppler run -- tsx src/scripts/importBrandProducts.ts"
}
```

**Deployed Service:**
- Railway deployment
- Uses Railway environment variables (NOT Doppler)

#### 3. Marketing Site

**NO Doppler usage** ✅
```json
{
  "dev": "vite --port 5175 --strictPort",
  "build": "tsc -b && vite build"
}
```

Reads from `.env.local` or hardcoded values only.

### Doppler Issues & Solutions

#### Issue 1: GE Sync Local Development

**Problem:** When Claude agents run ge-sync locally, Doppler can fail with:
- Authentication errors
- Token expiration
- Permission issues

**Solution:**
1. Use `.env.local` for local ge-sync development
2. Reserve Doppler for main app frontend only
3. Document this in ge-sync README

#### Issue 2: Deployed Builds

**Problem:** Vercel/Railway builds don't have Doppler CLI available

**Solution:** ✅ Already solved
- Main app uses `build:prod` without Doppler
- GE sync deployed via Railway with env vars
- No Doppler in CI/CD

---

## Build Commands Matrix

| Environment | Application | Command | Secrets Source |
|-------------|-------------|---------|----------------|
| **Local Dev** | Main App (frontend) | `pnpm dev` | Doppler → Supabase |
| **Local Dev** | Marketing Site | `pnpm dev` | `.env.local` or none |
| **Local Dev** | GE Sync Service | `pnpm dev` | **Should use `.env.local`** |
| **Vercel Deploy** | Main App (frontend) | `pnpm run build:prod` | Vercel env vars |
| **Vercel Deploy** | Marketing Site | `pnpm build` | Vercel env vars |
| **Railway Deploy** | GE Sync Service | (Railway config) | Railway env vars |

### Secrets Flow

```
┌─────────────────────────────────────────────────────┐
│ LOCAL DEVELOPMENT                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Main App Frontend                                  │
│  ├─ pnpm dev                                       │
│  ├─ doppler run -- vite                            │
│  └─ Secrets: Doppler CLI → Supabase keys          │
│                                                     │
│  Marketing Site                                     │
│  ├─ pnpm dev                                       │
│  └─ Secrets: .env.local or none                    │
│                                                     │
│  GE Sync Service (agents/scripts)                  │
│  ├─ pnpm dev  ⚠️                                   │
│  ├─ Should NOT use Doppler when run by agents     │
│  └─ Secrets: .env.local with Supabase keys        │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PRODUCTION DEPLOYMENT                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Main App Frontend (Vercel)                        │
│  ├─ pnpm run build:prod                            │
│  ├─ NO Doppler ✅                                  │
│  └─ Secrets: Vercel Dashboard                      │
│                                                     │
│  Marketing Site (Vercel)                           │
│  ├─ pnpm build                                     │
│  └─ Secrets: Vercel Dashboard (if needed)          │
│                                                     │
│  GE Sync Service (Railway)                         │
│  ├─ Railway buildpack                              │
│  └─ Secrets: Railway Dashboard                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Recommended Doppler Policy

### ✅ Use Doppler For:
- **Main app frontend local development only**
- Developers working on the React app
- Quick secret rotation for the team

### ❌ Do NOT Use Doppler For:
- **GE Sync service** (use `.env.local` locally, Railway vars in prod)
- **Marketing site** (no secrets needed)
- **CI/CD builds** (use platform env vars)
- **Claude agents running services** (use `.env.local`)

### Why?

**Pros of Doppler for main app:**
- Centralized secret management
- Easy team onboarding
- Automatic secret rotation
- Works great with Vite

**Cons of Doppler for services:**
- Adds complexity when agents run code
- Authentication issues in automation
- Not available in deployment environments
- Over-engineering for simple services

---

## Documentation Updates Needed

### 1. Main README

Add section:
```markdown
## Local Development Setup

### Main App (Frontend)
```bash
# Install Doppler CLI
brew install dopplerhq/cli/doppler

# Authenticate
doppler login

# Run dev server (Doppler auto-loads secrets)
pnpm dev
```

### GE Sync Service
```bash
# Copy example env
cp services/ge-sync/.env.example services/ge-sync/.env.local

# Add your Supabase keys to .env.local

# Run service
cd services/ge-sync
pnpm dev
```
```

### 2. GE Sync README

Update to remove Doppler references, document `.env.local` usage.

### 3. Deployment Docs

Create `docs/deployment.md` with:
- Vercel setup instructions
- Environment variable checklist
- Build command explanations

---

## Verification Checklist

Before finalizing sunset:

### Netlify Cleanup
- [ ] Confirm no production traffic going to Netlify
- [ ] Delete Netlify site
- [ ] Remove `.netlify/` directory
- [ ] Remove Netlify MCP from Claude settings
- [ ] Update all docs to remove Netlify references

### Doppler Verification
- [ ] Test main app `pnpm dev` with Doppler
- [ ] Test main app `pnpm build:prod` without Doppler
- [ ] Test ge-sync with `.env.local` (no Doppler)
- [ ] Verify Vercel deployment uses env vars only
- [ ] Verify Railway deployment uses env vars only

### Build Commands
- [ ] Run `pnpm run build:prod` locally (should work without Doppler)
- [ ] Deploy to Vercel and verify build succeeds
- [ ] Deploy to Railway and verify ge-sync starts

---

## Next Steps

1. **Immediate:** Delete `.netlify/` and update docs
2. **Soon:** Create ge-sync `.env.example` file
3. **Soon:** Document Doppler setup in main README
4. **Later:** Consider migrating marketing site to Vercel too (currently where?)
