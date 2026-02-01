# CLI Tools Available to Agents

This project has CLI tools linked for Supabase and Railway. Use them instead of writing custom scripts or asking the user to copy/paste into web UIs.

## Permission Model

Before using any CLI for the first time in a session, ask the user:
> "Can I use the [tool] CLI to [action]?"

Once approved for a tool, you can use it freely for that session.

---

## Supabase CLI

The Supabase CLI requires the database password for remote commands. Always use the `--db-url` flag with credentials from Doppler.

### Setup

Environment variables are injected via Doppler:
```bash
doppler run -- <command>
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
doppler run -- supabase db push --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"
```

### Other useful commands

All remote commands need `doppler run --` prefix and `--db-url` flag:

```bash
# List migrations and their status
doppler run -- supabase migration list --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"

# Dump current schema
doppler run -- supabase db dump -f schema.sql --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"

# Generate migration from schema diff
doppler run -- supabase db diff -f <migration_name> --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"
```

### Inspecting the database

```bash
# List all tables with sizes
doppler run -- supabase inspect db table-stats --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres"

# Other inspect commands: vacuum-stats, index-stats, bloat, etc.
```

**Note:** `supabase db query` does NOT support `--db-url`. Use psql instead for arbitrary queries.

### Generating TypeScript types

Generate TypeScript types from the database schema:

```bash
# Generate types to src/types/database.ts (uses --linked, no Docker required)
supabase gen types typescript --linked --schema public > src/types/database.ts
```

This creates typed definitions for all tables including `Row`, `Insert`, and `Update` variants plus relationship metadata.

---

## psql (PostgreSQL client)

For running arbitrary SQL queries against the database. Use this instead of `supabase db query` which doesn't support remote connections.

```bash
# Connection pattern
doppler run -- psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "YOUR QUERY"

# List all tables
doppler run -- psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "\dt public.*"

# Describe a table (columns, indexes, constraints)
doppler run -- psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "\d table_name"

# Run a query
doppler run -- psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.wxfdrdqchfrcdgprdznr.supabase.co:5432/postgres" -c "SELECT * FROM users LIMIT 5"
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

## Doppler CLI

Doppler manages all environment variables and secrets for the project. Instead of using `.env` files, secrets are centralized in Doppler.

### Local Development

All npm scripts automatically inject secrets via `doppler run`:

```bash
# Scripts already configured with doppler run
npm run dev        # doppler run -- vite
npm run build      # doppler run -- tsc -b && vite build
npm run seed       # doppler run -- tsx src/scripts/seed.ts
```

### Manual Commands

For one-off commands that need env vars:

```bash
# Run any command with Doppler secrets injected
doppler run -- <command>

# Examples
doppler run -- node script.js
doppler run -- tsx src/scripts/custom.ts
```

### Viewing & Managing Secrets

```bash
# List all secrets for current project/environment
doppler secrets

# Get a specific secret value
doppler secrets get KEY_NAME

# Set a secret (usually done in dashboard)
doppler secrets set KEY_NAME=value

# Upload a .env file (initial setup)
doppler secrets upload .env
```

### Configuration

```bash
# View current project/environment configuration
doppler setup --no-interactive

# Login (if needed)
doppler login

# Change project or environment
doppler setup
```

### Integration Notes

- **Frontend**: Uses Doppler for local development
- **GE Sync**: Should use `.env.local` for local development (not Doppler)
- **Railway**: Uses Railway environment variables for deployment
- **Vercel**: Uses Vercel environment variables for deployment
- **All CLI tools**: Use `doppler run --` prefix to inject secrets when needed (Supabase, psql, etc.)

---

## When to Use CLIs vs Other Methods

| Task | Use CLI | Don't Use CLI |
|------|---------|---------------|
| Database migrations | `supabase migration new` + `supabase db push` | Creating .sql files for manual paste |
| Check table structure | `supabase inspect db` or `supabase db query` | Asking user to check dashboard |
| Generate TypeScript types | `supabase gen types typescript --linked` | Manually writing type definitions |
| Deploy frontend | Vercel auto-deploys on push to main | Manual deployment |
| Check service logs | `railway logs` | Asking user to check Railway dashboard |
| Set env vars | `railway variables set` or set in Vercel dashboard | Hardcoding in code |

---

## Troubleshooting

If a CLI command fails with auth errors:
1. The CLI may need re-authentication: `supabase login`, `railway login`
2. The project may need re-linking (run `conductor-setup.sh`)

If unsure whether a CLI is available, ask the user.
