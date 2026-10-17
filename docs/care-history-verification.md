# Care history and assignments — October 14, 2026

> October 16 release update: care history and password-reset migrations are now
> applied to hosted Supabase; Google identity was already applied. EMAIL_FROM
> and the verified sending domain were already configured. See
> docs/product-cleanup-release.md for current scope and verification status.


## Behavior

Every new care completion saves a separate CareCompletion record with its date,
task name/type, provider, notes, and recorder's name. Completing recurring care
also advances the due date in the same transaction. Task edits do not overwrite
earlier snapshots. Removing a task preserves its completion records; deleting
the entire horse deletes its associated history, consistent with other logs.

The horse timeline now reads these records instead of only VetItem.lastDoneDate.
The PostgreSQL migration preserves that pre-existing latest date as a marked
legacy record. Local SQLite databases upgraded with db push get the same
preservation on first completion, with a timeline fallback before then. Earlier
dates that were never stored cannot be recovered.

Managers can assign or unassign scheduled care to active members of the same
farm, including at task creation. Staff can view assignments and filter tasks
to "Assigned to me" but cannot change assignments. Existing permission to
complete farm care remains unchanged. Inactive assignees are flagged for review.

Task forms disable controls while saving and reload the current filtered view
after a successful save. Failed saves show an error. A due-date value plus an
optimistic database update rejects stale/concurrent completion submissions;
one-off tasks cannot be completed again once unscheduled.

## Schema and deployment

The additive Prisma migration is
`prisma/migrations/20261014000000_care_history_assignments/migration.sql`.
It adds CareCompletion and VetItem.assignedMemberId, foreign keys and indexes,
backfills the latest existing completion, enables server-only RLS, and revokes
public/anon/authenticated access to the new table in a transaction.

No hosted migration, push, or deployment was performed. The migration SQL was
generated from the schema diff and reviewed. The subsequent October 15 audit
executed it successfully against disposable PGlite PostgreSQL, including
backfill, RLS denial, and delete behavior. Hosted PostgreSQL remains unchanged;
follow docs/database-deployment.md for baseline reconciliation, backup, and
schema checks. Apply the schema upgrade before deploying this source. Preserve
DATABASE_URL and DATABASE_POOLER_HOST. Existing non-test SQLite databases were
not modified; they also require the additive schema upgrade before this code.

## Verification

- Next.js production build and type checks passed.
- tests/care-history.mjs passed against disposable SQLite through real local
  server actions: scoped assignments, manager-only changes, inactive/foreign
  assignee rejection, personal task listing, concurrent and stale submissions,
  repeated recurring completions, one-off replay denial, immutable snapshots,
  legacy preservation, unassignment, task deletion preserving history, and
  timeline rendering.
- Browser manager login, assignment save/reload, care completion and timeline
  rendering passed. The personal-task filter and mobile view were inspected.
  No console errors were recorded in the inspected browser flow.
- Existing isolation and invitation-security suites passed on a separate
  disposable SQLite database. The isolation page assertions now accept a
  streamed Next.js not-found boundary while checking no foreign horse name is
  rendered, and distinguish care action forms from the new assignment form.

To rerun the feature suite, initialize a fresh file:/private/tmp/ database with
prisma/schema.local.prisma, build the app, and start a local production server
with that DATABASE_URL and a disposable AUTH_SECRET. Set TEST_DATABASE_URL to
the same disposable database and TEST_BASE_URL to that server, then run
`node tests/care-history.mjs`. The suite creates test fixtures and must never
run against real farm data. It reads the matching build's server-action manifest.
