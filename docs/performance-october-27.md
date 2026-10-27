# Performance pass — October 27

Implemented locally; not pushed or deployed. No schema, hosting, credentials,
connection-pool sizing, subscriptions or production-data changes.

## Manager summary: fifteen database statements to one

The previous summary made twelve Prisma reads (six counts and six previews).
Related horse reads made that fifteen actual statements in the query trace.
`src/lib/manager-priorities.ts` now returns all six categories in one parameterized
statement. Window counts retain full totals while each category returns only its
first five records, with explicit ordering and stable ID tie-breaks. A single
statement also gives totals and previews a consistent read snapshot.

All six categories retain explicit farm scoping. Manager authorization remains
in the Dashboard before rendering the summary. No private output is cached.
Completion notes, products, exact integer costs, currencies and authors remain
available for review; zero cost is preserved. Raw count/cost integers are converted
explicitly, and UTC timestamps retain the app's date semantics.

`tests/manager-priorities.ts` compares old and new totals/preview IDs on a disposable
SQLite fixture containing 1,080 task/history records across two farms, and tests
an empty farm and a SQL-injection-shaped farm ID. It executes the same query on
disposable PostgreSQL (PGlite) using SQL generated from the current Prisma schema.
Future care, dismissed reviews, foreign rows, full counts beyond five previews,
UTC dates and zero-cost currency are checked.

Measured query count: **15 → 1**, about 93% fewer database round trips. One local
SQLite run had median execution time 0.98ms before and 1.17ms after; this is not a
local CPU speedup. The optimization removes fourteen remote round trips rather
than claiming to improve an already sub-millisecond local query workload. Live
page latency has not been benchmarked for this change.

## Fetch only current work and displayed fields

Care now excludes unscheduled/completed items in the database and applies the
selected assignee filter there instead of loading everything and then filtering
it in memory. Existing farm and horse filters are retained. Care selects only the
fields the cards, assignment controls and workload use, with minimal teammate
identity fields. Membership context for reminder settings remains unchanged.

Dashboard reads select only displayed horse fields, latest activity timestamps,
recent activity labels, scheduled-care identifiers/dates and assigned farm-task
labels. Large care instructions and other unused profile/activity fields are no
longer fetched there. Completion still retrieves original instructions from the
database inside its authorized transaction, preserving history snapshots.

The horse directory fetches only timestamps for its latest ride/grooming previews.
Search/sorting and all displayed horse profile fields remain available.

## Navigation

Manager priority links use the existing intent-prefetched workspace links.
Explicit Refresh overview remains a normal reload. An attempted change to the
calendar's navigation failed a filtered-week edge-case test and was removed.
Calendar links and its GET filter form retain their existing behavior.

## Verification

- Production build/type checking and git diff --check.
- SQLite old/new equivalence, actual query trace and PostgreSQL execution tests.
- Calendar browser regression, including filters, scope, schedule changes,
  assignments, completion and phone layout.
- Care workflow browser regression, including notes/product/cost snapshots,
  manager summary/review/undo, exports, reminders and cross-farm boundaries.
- Staff completion browser regression, including slow/lost/rejected requests,
  reload persistence and duplicate/stale occurrence protection.
- Horse search browser regression for directory navigation/filter behavior.

Tests use disposable local data and mock reminder configuration. No real emails,
production users or production records are created. The calendar regression's
completion expectation was updated to match the previously released API-based
completion flow, which no longer waits for a full-page navigation.
