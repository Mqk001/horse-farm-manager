# Perceived-speed pass — November 16, 2026

This records the first pass. The subsequent page/tab fixes and final measurements
are in [performance-navigation-november-16.md](performance-navigation-november-16.md).

Local changes on `codex/reinwell-redesign`, based on deployed commit `6ed5d57`.
Not deployed. Read `performance-october-27.md` and the earlier navigation,
optimistic-task, cache, calendar and workflow tests before changing code.
No migration, production database operation, seed, or credential change.

## Findings and changes

The persistent Navbar already avoids repeated account reads during navigation.
Intent prefetching already makes warmed navigation fast. However, the root
`loading.tsx` boundary replaces the current page with a skeleton immediately on
cold navigation. Its pathname change also clears Navbar's pending-route feedback.
The former 300ms feedback delay leaves an especially unresponsive-looking gap.

Removed that root loading boundary. Next's transition now retains the current
page while preparing the replacement; the persistent Navbar shows the requested
destination immediately, with the existing eight-second direct-link recovery.
The active route remains the displayed route until the replacement is ready.
This also means initial document requests wait for server rendering rather than
showing that root skeleton. Existing nested Suspense boundaries still stream.
No new page-data cache or longer freshness lifetime was introduced.

Each successful completion formerly called `router.refresh()` independently,
including while another completion was still pending. A coordinator above route
content now tracks in-flight completion requests and performs one reconciliation
100ms after the group settles. Optimistic row feedback and durable success still
happen per task without waiting for the group. Errors restore the original row,
inputs and alert. A failed request also releases its coordinator slot; uncertain
lost responses retain the existing 15-second timeout and refresh-before-retry
wording. There is no automatic mutation retry.

The coordinator stays mounted during navigation, so a write finishing after its
origin page unmounts still refreshes the current route and invalidates prefetched
views. It stores only counters/dirty state, not user or farm data. Server writes,
occurrence keys, permissions and invalidation paths remain authoritative. Counts
and recurring-task dates reconcile after outstanding writes settle (at most the
existing request timeout plus the debounce for a lost response).

Team's revision polling and explicit **Show latest** document navigation are
unchanged. Care calendar links, GET filters, weeks and URL construction are
unchanged. Creation, assignment, rescheduling, dismissal and undo retain their
existing authoritative save/reload flows; this pass coordinates completion only.

## Authentication, database and waterfall review

Middleware verifies the HMAC locally; it does not call a remote authentication
service. Server handlers independently verify session version/email verification
in the database, then resolve active memberships and the selected farm cookie.
Those authorization reads remain request-scoped and uncached across requests.
Client account snapshots already deduplicate `/api/me` for ten seconds and
invalidate on farm switch/logout, including other tabs; regression tests pass.

Workspace page reads use `Promise.all` after authorization. Dashboard's manager
summary streams separately after the base reads; Team's revision includes four
aggregate reads and a farm-keyed two-second revision cache. Those remain possible
remote-latency costs, particularly with the existing single-connection transaction
pooler. They were not weakened or tuned without authenticated production traces.
No claim is made that SQLite latency represents the production PostgreSQL pooler,
or that fewer client refresh requests imply a measured database execution speedup.

## Before / after measurements

Production-mode Next 15.5.27 builds, headless Chrome, desktop 1440×1000, disposable
SQLite `file:/private/tmp/reinwell-speed-20261116.db`. The navigation fixture is a
minimal manager farm, not a representative large production farm. Each destination
RSC request has an explicitly modeled **900ms transfer delay**; DOM clicks avoid
hover/focus prefetch. One sample per direction; timings include browser work and
local load. These are controlled UI continuity measurements, not production
latency benchmarks or statistically significant page-speed comparisons.

| Switch | Old page visible at 150ms, before → after | Destination ready, before → after |
| --- | --- | --- |
| Dashboard → Horses | no → yes | 945 → 1147ms |
| Horses → Care | no → yes | 949 → 949ms |
| Care → Team | no → yes | 1460 → 971ms |
| Team → Dashboard | no → yes | 965 → 950ms |

Navigation feedback visible at 150ms: **0/4 → 4/4**. Sidebar/app shell retained and
navigation document reloads: **0 before and after**. The new page still waits for
its response; there is no demonstrated general server-latency improvement.

After-only 390px mobile run: retained content and visible feedback **4/4** at
150ms; destination ready 961, 962, 963 and 963ms; zero document reloads.

Held concurrent completion experiment: after the second task saved while the
first request remained held, Dashboard reconciliation requests **1 → 0**.
After releasing the first request, exactly **one** reconciliation updates the
confirmed state. A separate assertion verifies reconciliation on Horses when a
Dashboard save finishes after navigation, then returning to Overview excludes
the completed task.

Existing intent-prefetch regression after the change: cold navigation **1807ms**
versus warmed **31ms**, with a modeled 700ms delay per matching request. The cold
path can involve more than one RSC request. This is after-only confirmation of
previously implemented prefetching, not a new before/after speedup.

### Production: read-only, signed-out measurements

Public home: one sample 212ms TTFB / 224ms total; a later sample 165ms / 177ms.
Signed-out workspace requests returned HTTP 307, with TTFBs Dashboard 99ms,
Horses 241ms, Care 159ms and Team 343ms. These measure public delivery and session
redirects only. They do **not** measure authenticated navigation, database latency,
completion actions, or the undeployed changes. No production account was used.

## Validation

- Production build/type checking, command execution audit and `git diff --check`.
- `perceived-speed-browser.mjs`: all four cold workspace switches, retained page,
  immediate status, preserved shell DOM, no document reloads or page errors;
  desktop and mobile. `PERFORMANCE_BASELINE=1` records old behavior without
  requiring the new expectations.
- `task-completion-browser.mjs`: concurrent saves produce one reconciliation;
  navigation during a held save still reconciles; staff tasks disappear, persist
  after reload, never show waiting-for-approval; rejection and lost-response
  recovery; authentication, origin/farm boundaries; idempotent farm completion,
  recurring care and stale occurrence protection.
- `care-calendar-browser.mjs`: desktop/mobile filters, exact weeks and URLs,
  scope, rescheduling, assignment and completion persistence.
- `workspace-navigation-browser.mjs`: intent prefetch; Team remains interactive
  during checks, displays the update notice and changes displayed data only with
  explicit Show latest.
- `workspace-cache-browser.mjs`: one account request across screens, farm switch,
  cross-tab invalidation and logout.
- `optimistic-tasks.mjs`: duplicate task presentations, failures, unassignment,
  dismissal and persistence.
- `care-workflow-browser.mjs`: completion detail rollback, integer costs,
  instructions/history/exports, manager review/dismiss/undo, reminder preferences
  and mobile layout. The first run stopped at reminders because the local server
  lacked reminder configuration. Reran with mock-only reminder settings, no real
  email keys. One concurrent run reported React hydration error #418; two later
  runs with URL diagnostics passed without reproducing it. This isolated error
  remains an observation, not a claimed fix.

Reproduce with matching generated SQLite schema/client, a local production-mode
server, `TEST_DATABASE_URL=file:/private/tmp/<disposable>.db`, optional
`PLAYWRIGHT_MODULE_PATH`, `TEST_CHROME_PATH`, and `TEST_BASE_URL`. For mobile set
`TEST_VIEWPORT_WIDTH=390` on the perceived-speed test. Never point these tests at
production. Reminder workflow requires mock configuration, as in prior testing.

Deployment should be followed by authenticated desktop/mobile measurements on a
real farm, including cold/warm route timings, RSC waterfalls and save failures.
The local results establish improved continuity and fewer overlapping refreshes,
not production backend speed.
