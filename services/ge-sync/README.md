# GE Sync Service

Node.js service for syncing data from GE DMS to Supabase. Uses Playwright for SSO authentication.

## Architecture

```
Frontend (Netlify)
       │
       │ POST /sync/asis
       ▼
┌──────────────────────────────────┐
│  GE Sync Service (Railway)       │
│                                  │
│  ┌─────────────────────────────┐ │
│  │ Express Server              │ │
│  │ - /health                   │ │
│  │ - /auth/status              │ │
│  │ - /auth/refresh             │ │
│  │ - /sync/asis                │ │
│  └─────────────────────────────┘ │
│              │                   │
│              ▼                   │
│  ┌─────────────────────────────┐ │
│  │ Playwright Auth             │ │
│  │ (SSO login when needed)     │ │
│  └─────────────────────────────┘ │
│              │                   │
│              ▼                   │
│  ┌─────────────────────────────┐ │
│  │ GE DMS Fetch                │ │
│  │ (XLS/CSV endpoints)         │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
       │
       │ writes to
       ▼
┌──────────────────────────────────┐
│  Supabase                        │
│  - inventory_items               │
│  - ge_changes                    │
│  - load_metadata                 │
└──────────────────────────────────┘
```

## Local Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run in development mode
npm run dev
```

## API Endpoints

### `GET /health`
Health check endpoint.

### `GET /auth/status`
Check if GE DMS authentication is valid for a specific location.

Request (required):
- `locationId` query param (`/auth/status?locationId=...`) or `x-location-id` header.

Response:
```json
{
  "authenticated": true,
  "cookiesValid": true,
  "lastAuthAt": "2024-01-24T10:30:00Z"
}
```

### `POST /auth/refresh`
Force re-authentication with GE DMS using Playwright.

Request:
```json
{
  "locationId": "uuid-of-location"
}
```

### `POST /sync/asis`
Sync ASIS inventory from GE DMS.

Request:
```json
{
  "locationId": "uuid-of-location"
}
```

Headers (optional):
```
X-API-Key: <API_KEY>
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalGEItems": 450,
    "itemsInLoads": 380,
    "unassignedItems": 70,
    "newItems": 15,
    "updatedItems": 365,
    "forSaleLoads": 12,
    "pickedLoads": 3,
    "changesLogged": 25
  },
  "duration": 12500
}
```

Notes:
- ASIS data is sourced from report history + per-load CSVs and merged with ERP inventory export.
- CSO comes from report history (`ASISReportHistoryData.xls`).

## Scaling Notes (for beta+)

Current behavior:
- Syncs run inline in the request handler (no queue).
- No per-location lock or global concurrency cap yet.
- Each sync may spin up a Playwright browser as needed.

Implications:
- If two syncs for the same location overlap, results are undefined and may duplicate work.
- If many syncs fire at once across locations, Playwright processes can exhaust CPU/RAM.

Planned mitigations:
- Per-location lock to prevent overlapping syncs for the same location.
- Global concurrency cap (DB-backed semaphore) to limit Playwright load.
- Job queue + worker for async syncs and progress tracking.

Operational guidance (beta):
- Run one sync per location at a time.
- Keep total concurrent syncs low (1–2) to avoid Playwright resource spikes.
- If a sync fails mid-run, wait ~60 seconds before retrying to avoid overlapping auth/browser sessions.
- Prefer manual syncs during beta; avoid cron/scheduled syncs until locks are added.

## Railway Deployment

1. Connect your GitHub repo to Railway
2. Set the root directory to `services/ge-sync`
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `API_KEY`
4. Deploy

## Frontend configuration (dev vs prod)

The frontend reads the sync service URL at build time via Vite env vars.

- **Local dev** (frontend):
  - `VITE_GE_SYNC_URL=http://localhost:3001`
  - `VITE_GE_SYNC_API_KEY=your_api_key`
- **Production** (frontend):
  - `VITE_GE_SYNC_URL=https://<your-railway-service>.up.railway.app`
  - `VITE_GE_SYNC_API_KEY=<same API_KEY as Railway>`

If you change these values, you must rebuild the frontend so Vite can bake them in.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (server-side) |
| `API_KEY` | No | API key for authenticating requests |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment (development/production) |

## Database Requirements

The service expects these tables in Supabase:
- `inventory_items` - Main inventory table with `ge_*` columns
- `ge_changes` - Change tracking table
- `locations` - Location configuration
- `settings` - SSO credentials + stored cookies per location
- `products` - Product catalog for model lookup

## Security Notes

- The `SUPABASE_SERVICE_KEY` has full database access - keep it secure
- Set `API_KEY` in production to prevent unauthorized sync requests
- SSO credentials are stored in the `settings` table (should be encrypted)
- Cookies are stored in memory and DB for session persistence
