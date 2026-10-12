# Database deployment checkpoint

The old migration directory contained SQLite SQL (`DATETIME`) and omitted farm/auth tables. It has been preserved in `prisma/legacy-sqlite-migrations`. The active PostgreSQL baseline is generated from the current Prisma schema.

## Fresh disposable PostgreSQL database

1. Set DATABASE_URL to the empty test database.
2. Run `npx prisma migrate deploy` using `prisma/schema.prisma`.
3. Validate the resulting schema against the Prisma schema and run application integration tests against this database.
4. For Supabase, also apply the server-only RLS migration in `supabase/migrations`; the Prisma baseline alone does not establish those policies.

## Existing database

Do not run the baseline CREATE TABLE statements against existing tables. Back up the database and compare the actual schema with the Prisma schema. Resolve any drift with a reviewed additive migration. Only once equivalent, use `prisma migrate resolve --applied 20260927000000_postgresql_baseline` to mark the baseline. Do not mark it applied merely to silence a migration error.

The connected Supabase project was INACTIVE on September 27, 2026. Its current schema and migration history have not yet been inspected in this pass. Production readiness remains blocked until PostgreSQL execution, RLS, environment configuration, and email delivery are verified.
