---
description: Inspect or change the hosted Supabase database for DuoQueue - run SQL, check grants and RLS policies, or apply a migration safely. Use whenever the task involves reading database state, writing a migration, or verifying that a schema change actually took effect.
---

## Current migration state

!`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -Query "select max(version) as latest_applied from supabase_migrations.schema_migrations"`

## Migration files on disk

!`powershell -NoProfile -Command "Get-ChildItem supabase/migrations -Name | Select-Object -Last 5"`

## How to work with this database

There is no `psql` on this machine and no stored database password, but the Supabase CLI
is logged in, so `scripts/db/` reaches the project through the Management API using the
token in Windows Credential Manager. Nothing needs to be pasted or committed.

### Reading state

```
powershell -NoProfile -File scripts/db/run-sql.ps1 -Query "<sql>"
```

Use this to check things rather than assuming them. The queries that have earned their
keep on this project:

- **Column-level grants** — the source of the worst bug found so far, where a table-wide
  UPDATE grant let any user set their own `is_admin`:
  `select table_name, privilege_type, column_name from information_schema.column_privileges where grantee='authenticated' and table_schema='public' and table_name='<t>'`
- **Function execute grants** — Postgres grants EXECUTE to PUBLIC by default, which is
  almost never what you want for a SECURITY DEFINER function:
  `select routine_name, grantee from information_schema.routine_privileges where specific_schema='public'`
- **RLS policies and their roles** — a policy with no `TO` clause applies to PUBLIC,
  which includes `anon`:
  `select tablename, policyname, cmd, roles::text from pg_policies where schemaname='public'`

### Applying a migration

Always dry-run first. It wraps the file in a transaction and rolls back, so a colliding
policy name or a constraint that fails on existing rows surfaces before anything is
half-applied:

```
powershell -NoProfile -File scripts/db/apply-migration.ps1 supabase/migrations/0034_x.sql
powershell -NoProfile -File scripts/db/apply-migration.ps1 supabase/migrations/0034_x.sql -Commit
```

`-Commit` also records the version in `supabase_migrations.schema_migrations`, which
keeps `supabase migration list` honest and stops a later `db push` re-applying the file.

Prefer this over `supabase db push` here: push is all-or-nothing across every unapplied
file, and this repo's migration history has needed manual repair before.

### Verifying a change

A migration that applies is not a migration that works. For anything touching grants,
policies, or auth, write the check as SQL and run it against the real schema — ideally
both directions: that the attack is blocked *and* that ordinary app queries still
succeed. The pattern that has caught real regressions is a temp table of results plus
`set local role authenticated` with a `request.jwt.claims` setting, run inside
`begin; ... rollback;` so the test leaves nothing behind.

Skipping this is how the `is_admin_user` lockout was nearly shipped: revoking EXECUTE
from `authenticated` looked correct in isolation, but that function is called inside RLS
policies, which are evaluated as the querying role — so it would have locked every user
out of their own profile row.

## Conventions

- Migrations are `NNNN_snake_case_name.sql`, applied in filename order, never edited
  after being applied — add a new one instead.
- Every migration explains *why* in a header comment, not just what. The schema's
  security model lives in those comments.
- New tables need RLS enabled and explicit grants; this schema has no default-permissive
  policy anywhere and that property is worth preserving.
