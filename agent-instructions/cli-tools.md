# CLI Tools Available to Agents

This project has CLI tools linked for Supabase, Netlify, and Railway. Use them instead of writing custom scripts or asking the user to copy/paste into web UIs.

## Permission Model

Before using any CLI for the first time in a session, ask the user:
> "Can I use the [tool] CLI to [action]?"

Once approved for a tool, you can use it freely for that session.

---

## Supabase CLI

The Supabase CLI requires the database password for remote commands. Always use the `--db-url` flag with credentials from `.env`.

### Setup

First, source the environment variables:
```bash
source .env
```

The database URL pattern is:
```
postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres
```

### Migrations (preferred workflow)

Instead of creating a `.sql` file and asking the user to paste it in the Supabase dashboard:

```bash
# Create a new migration file (local only, no password needed)
supabase migration new <migration_name>
# This creates: supabase/migrations/<timestamp>_<migration_name>.sql

# Edit the migration file, then push it (needs --db-url)
source .env && supabase db push --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"
```

### Other useful commands

All remote commands need `source .env &&` prefix and `--db-url` flag:

```bash
# List migrations and their status
source .env && supabase migration list --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"

# Dump current schema
source .env && supabase db dump -f schema.sql --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"

# Generate migration from schema diff
source .env && supabase db diff -f <migration_name> --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"
```

### Inspecting the database

```bash
# List all tables with sizes
source .env && supabase inspect db table-stats --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"

# Other inspect commands: vacuum-stats, index-stats, bloat, etc.
```

**Note:** `supabase db query` does NOT support `--db-url`. Use psql instead for arbitrary queries.

---

## psql (PostgreSQL client)

For running arbitrary SQL queries against the database. Use this instead of `supabase db query` which doesn't support remote connections.

```bash
# Connection pattern
source .env && psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "YOUR QUERY"

# List all tables
source .env && psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "\dt public.*"

# Describe a table (columns, indexes, constraints)
source .env && psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "\d table_name"

# Run a query
source .env && psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "SELECT * FROM users LIMIT 5"
```

---

## Netlify CLI

The project is linked to the Netlify site (warehouse-tools).

### Deployments

```bash
# Deploy to production (from main branch)
netlify deploy --prod

# Deploy a preview (for testing)
netlify deploy

# View deploy status
netlify status
```

### Environment Variables

```bash
# List env vars
netlify env:list

# Set an env var
netlify env:set KEY value

# Unset an env var
netlify env:unset KEY
```

### Build & Logs

```bash
# Build locally (same as Netlify would)
netlify build

# View function logs
netlify logs:function <function_name>
```

---

## Railway CLI

The project is linked to the Railway project (warehouse/ge-sync service).

### Service Management

```bash
# View current project/service status
railway status

# View logs
railway logs

# Run a command in the Railway environment
railway run <command>
```

### Environment Variables

```bash
# List all variables
railway variables

# Set a variable
railway variables set KEY=value

# Unset a variable
railway variables unset KEY
```

### Deployments

```bash
# Deploy current code
railway up

# Redeploy the service
railway redeploy
```

---

## When to Use CLIs vs Other Methods

| Task | Use CLI | Don't Use CLI |
|------|---------|---------------|
| Database migrations | `supabase migration new` + `supabase db push` | Creating .sql files for manual paste |
| Check table structure | `supabase inspect db` or `supabase db query` | Asking user to check dashboard |
| Deploy frontend | `netlify deploy --prod` | Asking user to trigger deploy |
| Check service logs | `railway logs` | Asking user to check Railway dashboard |
| Set env vars | `railway variables set` / `netlify env:set` | Asking user to set in dashboard |

---

## Troubleshooting

If a CLI command fails with auth errors:
1. The CLI may need re-authentication: `supabase login`, `netlify login`, `railway login`
2. The project may need re-linking (run `conductor-setup.sh`)

If unsure whether a CLI is available, ask the user.
