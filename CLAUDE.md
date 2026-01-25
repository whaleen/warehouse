# Warehouse - Agent Instructions

## Project Overview

Warehouse is an inventory management system for GE appliance dealers. It syncs data from GE DMS (Dealer Management System), tracks loads (shipments of ~60 appliances on semi trucks), and provides barcode scanning for verification.

## CLI Tools Available

This project has linked CLIs. **Use them instead of writing scripts or asking the user to use web UIs.**

Before using any CLI for the first time, ask: "Can I use the [tool] CLI to [action]?"

### If a CLI fails or isn't linked

**Do not work around it.** If a CLI command fails because the project isn't linked or needs authentication:

1. Tell the user what failed and why
2. Ask them to run the link command manually (e.g., `supabase link --project-ref wxfdrdqchfrcdgprdznr`)
3. **Wait for confirmation** before proceeding
4. Then retry the original command

Do not fall back to curl, REST APIs, or other workarounds. The CLIs are the intended interface.

### Supabase CLI

The Supabase CLI requires the database password for remote commands. Use the `--db-url` flag with the password from `.env`:

```bash
# First source the env vars
source .env

# Then use --db-url for any remote database commands
supabase inspect db table-stats --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"
supabase migration list --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"
supabase db push --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"
```

For creating migrations (local only, no password needed):
```bash
supabase migration new <name>   # Creates file in supabase/migrations/
```

### psql (for arbitrary queries)

Use psql for running SQL queries (supabase CLI doesn't support `db query` with `--db-url`):

```bash
source .env && psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "YOUR QUERY"

# Examples:
# List tables: -c "\dt public.*"
# Describe table: -c "\d table_name"
# Run query: -c "SELECT * FROM users LIMIT 5"
```

### Netlify CLI

For frontend deployments and environment variables:

```bash
netlify deploy --prod           # Deploy to production
netlify env:list                # List env vars
netlify env:set KEY value       # Set env var
```

### Railway CLI

For the ge-sync backend service:

```bash
railway status                  # Check service status
railway logs                    # View logs
railway variables               # List env vars
railway variables set KEY=value # Set env var
```

See `agent-instructions/cli-tools.md` for full documentation.

## Key Terminology

- **Load**: A shipment of ~60 GE appliances loaded on a semi truck (not a pallet)
- **ASIS**: "As-Is" inventory - open-box/damaged items sold at discount
- **GE DMS**: GE's Dealer Management System - the source of truth for inventory data
- **ge-sync**: Backend service that syncs data from GE DMS to Supabase using Playwright

## Architecture

- **Frontend**: React + Vite, deployed to Netlify
- **Backend**: ge-sync service (Node.js + Playwright), deployed to Railway
- **Database**: Supabase (PostgreSQL + Realtime)

## Don't

- Don't run `npm run dev` unless explicitly asked
- Don't create documentation files unless explicitly asked
- Don't use Claude mentions in commit messages
