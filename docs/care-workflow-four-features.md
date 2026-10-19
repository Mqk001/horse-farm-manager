# Completion details, care exports, manager priorities and reminder preferences

Implemented and verified locally. Not pushed, migrated on production or deployed.
These changes build on the released horse photos, weekly calendar and reminders.

## 1. Completion details

Every horse-care completion form on Care (list and calendar) and the dashboard
has an optional Completion details disclosure. Quick Complete still works without
opening it. Fields mount on first expansion and stay mounted afterward, retaining
entered values when collapsed or when a failed save rolls back.

- Completion notes: 2,000 characters, normalized newlines.
- Product used: 200 characters.
- Optional cost: 0–9,999,999.99, no more than two decimal places.
- Explicit currency: USD, EUR, GBP, CAD, AUD or NZD; USD is the initial choice.

Costs are parsed into integer cents, never stored as a floating point amount.
Zero is preserved, blank means not recorded. Currency is null when no cost is
recorded. Database constraints enforce paired cost/currency and valid ranges.
The completion stores a snapshot of notes/product/cost, the authenticated user's
name and the original care instructions. Editing the schedule does not rewrite
these records. The timeline, Team completed-work review and new manager overview
show the completion details. Original care instructions and completion notes are
separate. Farm-task completion behavior remains unchanged.

Existing due-date/concurrent-completion protections and optimistic UI remain.
Input validation happens before the optimistic state change. Failed actions keep
the entered fields available for retry, with visible error/rollback feedback.

## 2. Vet-ready care history

Horse profile → Export care history opens an authenticated, date-filtered record
view. Download CSV returns an actual UTF-8 CSV attachment. Print / Save PDF opens
the browser print dialog; choose Save as PDF there. This is a printable PDF flow,
not a server-generated PDF download or a public sharing link.

Both exports use the same scoped completion records and legacy last-completion
fallback as the timeline, including completed-by, provider, product, currency,
cost, completion notes and care instructions. Filters apply to UTC completion
dates, inclusive From/To. No ride/grooming entries or future care occurrences are
included. The maximum is 1,000 records; larger requests return a clear error and
ask for a narrower date range instead of silently truncating.

CSV quotes/commas/newlines are escaped and potential spreadsheet formulas are
prefixed as literal text, including user-entered names/notes. Output filenames
use validated IDs rather than header-interpolated horse names. CSV is private,
no-store and nosniff. Cross-farm requests return 404; missing login is rejected.
Active staff can export records of their own farm, matching horse-history access.
The print view hides app navigation, filters and controls, uses white A4 pages,
and avoids splitting a record where feasible. Long records may span pages.

## 3. Manager daily overview

Manager/owner Dashboard → Today's priorities appears before My tasks. Staff keep
their existing My tasks home. Three sections combine horse care and farm tasks:

- Overdue work: open due dates before today's UTC midnight.
- Unassigned work: scheduled unassigned horse care plus open unassigned farm work.
- Awaiting review: care completions and completed farm tasks not yet dismissed.

Totals are full counts; previews show at most five in each section. Links open
Care/Team for assigning or reviewing the rest. Completion details can be expanded
in review. Reviewed · dismiss reuses the existing manager-authorized action and
keeps history, with the existing 30-second UI undo offer. Refresh overview reloads
fresh state; no real-time push/subscription has been added. All queries are scoped
to the authenticated selected farm. Roles and permissions are unchanged.

## 4. Reminder preferences

Each member's Care reminder panel now saves an advance-notice window (0, 1, 3 or
7 days) and preferred daily UTC delivery window (00:00, 08:00, 13:00 or 18:00).
Overdue work and today are always included; day 0 means no future notice.
Changing settings does not opt the member in. The separate on/off control and
email unsubscribe continue to work. Existing members retain 3 days and 13:00 UTC.

Four distinct daily schedules in vercel.json invoke the same authenticated job,
one at each delivery window. Every expression runs once a day. The worker selects
only preferences whose window has arrived and skips terminal member/day records.
This also lets later windows catch up earlier failed/missed work. Timing is
approximate; the UI says around the selected UTC time and may be delayed. There
is no arbitrary-minute or local-timezone scheduling. At most one digest per UTC
day, even after a same-day window change or overlapping invocation.

Preference changes increment the existing reminder version, invalidating stale
prepared payloads and old unsubscribe links. An already prepared ambiguous send
may therefore be skipped for the rest of that day and resume the next day. The
existing durable ledger/leases, identical-payload provider idempotency, retry caps,
12-hour retry cutoff, verified/active membership checks and role revocation checks
remain. No production emails were sent during development.

## Migration and release

Apply only the additive Prisma migration
20261019020000_care_workflow_details/migration.sql through the existing schema
release process before deploying matching code and vercel.json. It adds nullable
completion fields and defaulted member preferences; it does not alter old notes
or completion history. No new environment variables or integrations are needed.
Keep existing database/pooler/email/auth/cron settings. Do not reset/seed production
or blindly replay the historical baseline.

## Verification

- tests/care-workflow.ts: exact cents, zero/blank/invalid costs, normalized notes,
  preference validation, scoped/date-filtered history, CSV quoting/formula safety,
  export record cap, actual preferred-window/lookahead delivery and daily dedupe.
- tests/care-workflow-migration.mjs: real disposable PostgreSQL migration sequence,
  default preferences, paired/nonnegative currency constraints and stored details.
- tests/care-workflow-browser.mjs: staff completion detail entry, failed-save
  rollback preserving fields, persisted notes/product/cost/instructions/identity,
  timeline/export UI, CSV authentication/date/farm boundaries, manager summaries,
  review dismissal/undo, preference persistence without implicit opt-in, on/off,
  and phone layout. Optional TEST_PDF_PATH and TEST_OVERVIEW_SCREENSHOT_PATH create
  local verification artifacts only.
- Multi-page PDF generated with installed Chrome, rendered with Poppler and
  inspected visually; extracted text verifies full records and excluded app UI.
- Existing tests/care-reminders.ts, tests/care-reminders-browser.mjs and
  tests/optimistic-tasks.mjs regression suites passed. Production build/type checks
  and git diff --check passed.

All fixtures use a disposable SQLite database under /private/tmp and local HTTP.
PGlite PostgreSQL runs in a temporary installation, not app dependencies. Provider
email is mocked. No production accounts, records or credentials were used.

Reference: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
permits up to 100 jobs per project; each of these four schedules is daily.
