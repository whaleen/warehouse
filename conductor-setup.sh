#!/bin/bash
npm install
cp $CONDUCTOR_ROOT_PATH/.env .env
cp $CONDUCTOR_ROOT_PATH/services/ge-sync/.env services/ge-sync/.env

# CLI linking (requires being logged in: netlify login, supabase login, railway login)
[ ! -f .netlify/state.json ] && netlify link --id a3c80907-c0fb-4902-9fd7-0789114decba
[ ! -d .supabase ] && supabase link --project-ref wxfdrdqchfrcdgprdznr
[ ! -f .railway.toml ] && railway link --project 55e3fdb8-2009-420c-b9ff-9569165d9c43 --environment production
