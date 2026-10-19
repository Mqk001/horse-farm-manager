# Daily care email reminders

Implemented locally; not pushed, migrated on production, or deployed in this change.

## Product behavior

Each active, email-verified farm member opts in on **Care → Daily email reminders**.
Default is off, including existing accounts. Staff receive only their assigned
scheduled horse care and dated, open farm tasks. Managers and owners receive the
same types of work across that farm, including unassigned work. Each farm has a
separate preference and digest; selecting another farm does not change it.

Includes overdue work, today, and the next three UTC calendar days. Dates match
Care's existing UTC convention. Undated tasks, completed one-time care (no next
due date), completed farm tasks, retired horses, inactive memberships and
unverified users are excluded. Recurring care appears again when its next due
date enters the window. No email is sent for an empty schedule. A member whose
schedule is empty on the daily run is skipped for the rest of that UTC date.

Emails have overdue/today/soon labels, dates, assignee names, horse/task links,
and a link to the live workspace. The farm name is visible throughout: a user
with multiple farms may need to select the named farm after signing in. Emails
are snapshots, not a second source of task state. Digests show at most 50 items,
ordered by due date, with a notice and workspace link for larger schedules.

The Care control turns off reminders. Each email also links to a confirmation
page that works without login. GET never changes a preference (mail scanners
cannot unsubscribe users by fetching the link). Confirmation verifies a
purpose-specific HMAC-SHA256 token using a constant-time comparison; it can
only disable reminders for that membership/version. Every preference update
revokes old links, so an old email cannot undo a later opt-in. Rotating
AUTH_SECRET also revokes email links, as it does sessions.

## Delivery and security

- Vercel cron calls `/api/cron/care-reminders` daily at `0 13 * * *` (13:00 UTC;
  execution is approximate, not a guaranteed minute). This is email only, not push.
- The endpoint bypasses session middleware only at its exact path and verifies
  `Authorization: Bearer CRON_SECRET` itself. Missing or incorrect credentials
  return 401. Configuration failures return 503; responses are never cached.
- Master switch `CARE_REMINDERS_ENABLED=true` is required, along with a canonical
  HTTPS `APP_URL`, configured sender/provider, and secrets of at least 32 characters.
  Missing configuration disables opt-in with an explanatory message. Existing
  enabled users can still turn reminders off. No fake delivery success is shown.
- A database unique constraint on `(memberId, day)` and an atomic five-minute
  lease prevent overlapping workers from sending the same membership/day twice.
- Resend's `Idempotency-Key` is derived from the durable delivery ID. The exact
  payload is persisted before sending and retained on uncertain/failed attempts,
  so a retry uses identical bytes and the same key, even after a process crash.
- At most three attempts, at least one minute between failed attempts, and at
  most twelve hours from preparation, safely inside Resend's documented 24-hour
  key lifetime. No automatic in-request email retry. Expired records are terminal.
- Membership status, verification, opt-in, role scope, email, and preference
  version are checked again before delivery. Broader manager snapshots are not
  sent after demotion. Already in-flight provider requests cannot be recalled.
- Successful/skipped/expired deliveries discard stored payloads. Remaining
  records/payloads are deleted after 30 days on a completed job. The new ledger
  has RLS enabled and no public/anon/authenticated grants; access is through the
  existing server-side Prisma connection only. No email bodies or tokens in logs.
- Queries fetch 25 memberships per batch and at most 51 horse care rows and
  51 farm tasks per recipient. A job stops after 240 seconds or 1,000 members and
  reports `incomplete` with HTTP 503. Terminal records are excluded on reruns so
  later recipients can make progress. Sends are sequential and spaced by 600ms
  per worker; the existing email timeout/circuit breaker also applies.

Vercel does not automatically retry failed cron invocations. Failed/incomplete
runs log aggregate counts and return 503; operators can rerun this same endpoint
with the bearer secret on the same UTC day. A fresh digest is prepared the next
day for still-due work. Cron delivery is best effort; this is not an emergency
notification service or a durable queue. A provider-accepted message is marked
sent; inbox receipt/bounces are not tracked by this feature.

## Activation / release order

1. Review and apply only the additive
   `prisma/migrations/20261019000000_care_reminders/migration.sql` to the existing
   production PostgreSQL schema using the project's migration process. Do not
   reset/seed the database, change connection credentials, or blindly replay the
   historical baseline. PostgreSQL migration was generated from Prisma's schema
   diff; it has not been applied to the hosted database in this change.
2. Configure production `APP_URL=https://getreinwell.com`, a freshly generated
   `CRON_SECRET` (32+ random characters), existing `AUTH_SECRET` (32+),
   `RESEND_API_KEY`, and an `EMAIL_FROM` address on a verified sending domain.
   Set `CARE_REMINDERS_ENABLED=true`. Never expose these secrets to the client.
3. Push and deploy the matching code and `vercel.json`. Check that Vercel lists
   the daily cron and that an unauthenticated call returns 401. Preview deployments
   should keep the master switch off and use test credentials.
4. An actual farm member opts in from Care. Verify a real delivered digest with
   a consenting test recipient, then verify its links and opt-out. No production
   emails were sent during development. Monitor counts and provider failures.

## Verification

- `DATABASE_URL=file:/private/tmp/<disposable>.db node --import tsx tests/care-reminders.ts`
  after pushing `prisma/schema.local.prisma` to an empty disposable SQLite DB.
  Tests real database filtering, UTC day boundaries, separate staff/manager/farm
  scopes, excluded records, empty digests, concurrent workers, stable retry
  payload/key, demotion, retry expiry, bounded 50-item payloads, token tampering,
  canonical origin validation and configuration-off behavior. Provider mocked.
- `tests/care-reminders-browser.mjs` against the matching local production build:
  mobile opt-in/persistence, per-farm preference isolation, staff/manager copy,
  public confirmation without login, nonmutating GET, stale/tampered links,
  explicit off switch and missing/wrong cron auth. No real emails.
- Existing `tests/email.ts` regression suite, TypeScript and production build.

Local browser test env: `TEST_DATABASE_URL=file:/private/tmp/<disposable>.db`,
`TEST_BASE_URL=http://127.0.0.1:3188`, matching server/test
`AUTH_SECRET=reinwell-reminder-test-disposable-secret`. The server also needs
`CRON_SECRET=reinwell-reminder-cron-disposable-secret`, mocked provider key,
`EMAIL_FROM=Reinwell <reminders@example.test>`,
`APP_URL=https://reinwell.example.test`, `CARE_REMINDERS_ENABLED=true`.
Optional `PLAYWRIGHT_MODULE_PATH` and `TEST_CHROME_PATH` select installed tooling.
Never run these fixture tests against a real database.

References: [Vercel cron security, retries and idempotency](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
