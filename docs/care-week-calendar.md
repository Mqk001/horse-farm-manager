# Care week calendar

Added locally alongside the pending horse-photo work. Not pushed or deployed.
The calendar itself needs no database migration, dependency or environment setting.

## Experience

Care has List and Week calendar views. The calendar shows Monday through Sunday
using the same UTC due dates and same scheduled care items as the list. Previous
week, Next week and This week are shareable GET links. Horse and assignment
filters stay selected while navigating; clearing filters keeps the selected week
and calendar view. The list remains the default.

Seven columns on wide screens; days stack vertically on phones and smaller
screens. Current day highlighting, empty-day states, per-day counts, total tasks,
unassigned count and busiest day help managers scan workload. A workload summary
shows counts by active assignee, unassigned work and inactive assignments needing
review, matching the current filters. Older overdue care is called out above the
week with a link to review it in the list.

Cards show care name, horse link, care type, assignee, provider if present, and an
overdue label. Task actions expand on demand so the week stays readable. Managers
can assign/reschedule, and completion uses the same existing actions and optimistic
feedback as the list. Mutations reload the selected URL to reconcile persisted
state; recurring items follow existing next-due-date behavior. Opening Schedule
care on a future/past week defaults to that Monday; on the current week it defaults
to today. It retains the selected horse when filtered.

Reminder preferences now appear after the schedule, keeping both views prominent.

## Scope and safeguards

- Fresh selected-farm access and existing farm-scoped queries remain the source.
  Active members can view the calendar as they can view the list. Staff do not gain
  assignment/rescheduling controls. Existing care completion authorization is unchanged.
- Calendar shows **currently scheduled next due dates**, not appointment times,
  automatic future occurrences, historical completions, ride/grooming intervals,
  or general FarmTask assignments. Completed history remains on horse timelines.
- Week range is inclusive Monday 00:00 UTC, exclusive next Monday 00:00 UTC.
  Days advance by fixed UTC days, avoiding DST drift. Strict calendar-date parsing
  (1900–2199) rejects impossible dates; invalid query dates fall back to this week.
- Query links use normal document navigation for reliable query/view changes.
  No query result cache or new client data source is introduced. Filter selects
  have explicit accessible labels; date sections and navigation have semantic names.
- Card actions reuse the existing task forms; expected due-date snapshots still
  protect completion from a stale view. Empty results suggest changing the week
  or filters. No extra tasks or dates are written just by viewing a week.

## Verification

`node --import tsx tests/care-calendar.ts` covers Monday/Sunday boundaries, DST,
leap/year transitions, malformed dates, fallback and encoded filter links.

`tests/care-calendar-browser.mjs` runs against a matching local production build
and disposable SQLite database. It checks seven-column and phone layouts, exact
week boundaries, other-farm isolation, workload/overdue states, filter and week
navigation, future-week scheduling defaults, actual assignment/rescheduling/
completion persistence, invalid/empty dates and staff controls. Optional
TEST_SCREENSHOT_PATH captures the desktop calendar for visual inspection.

Use TEST_DATABASE_URL=file:/private/tmp/<disposable>.db and matching DATABASE_URL
on the local server, TEST_BASE_URL=http://127.0.0.1:3188, a disposable AUTH_SECRET
of 32+ characters, and optional PLAYWRIGHT_MODULE_PATH/TEST_CHROME_PATH. Push the
local schema to this empty disposable database first. Never use a real database.

Final checks passed: calendar unit/browser suites, production build/type checks,
existing optimistic task completion/unassignment/dismissal success and rollback
suite, and git diff --check. Desktop calendar screenshot visually reviewed.
No production records or deployments changed.
