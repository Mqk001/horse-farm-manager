# Page and tab speed — November 16 follow-up

This supersedes the initial continuity-only pass in
`performance-november-16.md`. Local, uncommitted changes on
`codex/reinwell-redesign`. No deployment was performed in this work.
No schema changes, migrations, production database writes/resets/seeding, or
credential changes. All test records are disposable SQLite/PGlite records.

## What was slowing navigation

- Hover/touch intent arrived too late to prepare pages for many clicks.
- Default partial prefetches returned only routing/shell data for dynamic pages,
  adding requests without preparing the page contents. Network diagnostics
  distinguished those responses from full data responses.
- Visited dynamic pages expired immediately (`staleTimes.dynamic: 0`), so returning
  to Dashboard fetched it again even after a fast sequence through other tabs.
- Every workspace authorization loaded the user, active memberships, and farms
  in three actual database statements, before loading the screen's data.
- Team revision checks performed four separate aggregate statements.

## Changes

`WorkspacePrefetch` warms only Dashboard, Horses, Care and manager-authorized Team
with full page data after authentication/farm resolution. Requests start after
600ms and are staggered by 350ms. Timers are cancelled on route/scope changes or
unmount. Warming is skipped for Save-Data/2G connections and hidden tabs. It does
not refresh or replace the displayed page, poll continuously, or warm every horse.
Mobile navigation benefits without requiring a hover. Explicit full prefetch
uses the installed Next 15.5.27 enum; browser tests protect this version-sensitive
integration. The existing full-prefetch lifetime remains 30 seconds.

`WorkspaceLink` uses full prefetch on intent and disables automatic shell-only
prefetch. Dashboard and horse directory links now use it too, avoiding speculative
partial requests for the entire visible horse list.

Visited pages have a **15-second client router revisit window**. This caches
rendered pages in the current browser, not authorization results on the server.
Known mutations, farm switches and logout retain their cache invalidation. The
completion test deliberately preloads Team, completes work on Dashboard, waits
for reconciliation, then verifies Team does not offer that completed task as
active work. Two-tab farm-switch testing deliberately warms the first farm's
horse directory, then checks that both tabs show only the second farm's horses.

The revisit window means another person's writes can remain absent from a cached
screen for its bounded lifetime. Existing full prefetches already allow up to
30 seconds. Team retains its revision notice and explicit **Show latest** action;
no automatic displayed-Team refresh was introduced. Care calendar links, GET
forms, filter parsing and week construction are unchanged.

`farm-context-query.ts` performs one parameterized, uncached read joining verified
user/session version to active memberships and farm names. It returns only the
identity/membership fields callers need. A verified user without memberships still
resolves to onboarding; an explicitly selected unavailable farm never falls back
to another farm. Session HMAC validation and mutation transaction authorization
remain intact. User passwords and unrelated profile fields are not loaded here.

`team-revision-query.ts` combines the four aggregates into one parameterized
statement and preserves the previous fingerprint exactly, including counts,
nulls, dismissal timestamps and UTC conversion. The existing farm-keyed two-second
revision cache, expiry and invalidation remain unchanged.

The first pass's persistent shell, immediate navigation feedback and grouped
completion reconciliation remain in place.

## Measured navigation results

Production-mode Next 15.5.27, headless Chrome, fixture with **31 horses, 30 care
items and 30 farm tasks**, all assigned to its manager. Browser RSC transfers have
an explicit **500ms artificial delay**. Before: wait 2.5 seconds on Dashboard,
then click without pointer/focus intent. After: wait until all three other tabs
have returned verified full page data, then use the same DOM clicks. This tests
the benefit of completed background warming; it does not claim a first click
before warming completes can bypass the network.

Single desktop samples; no document reloads:

| Destination | Before | After |
| --- | ---: | ---: |
| Horses | 890ms | 28ms |
| Care | 873ms | 42ms |
| Team | 883ms | 13ms |
| Return to Dashboard | not recorded | 14ms |

After-only 390px mobile samples: Horses **40ms**, Care **53ms**, Team **48ms**,
Dashboard **31ms**, zero document reloads. The menu-opening time is excluded;
measurements start with the navigation-link click.

The desktop Team click coincided with one unrelated background RSC request;
its 13ms readiness did not wait for that modeled 500ms transfer. Do not interpret
the test's total `clickRequests` counter as destination-specific request counts.

A control run with automatic warming disabled via Save-Data, and a separate 900ms
modeled transfer, still waited **955–982ms** for uncached pages. Current content
and feedback remained visible at 150ms in all four directions. This is the honest
limit: cold pages still require a network/database response.

## Cold HTTP response measurements

Separate temporary Node preload, outside application source, inserts **80ms per
top-level Prisma read operation**, serializing those operations to model a constrained
remote connection. It does not model every SQL statement inside Prisma includes,
serverless cold starts, real PostgreSQL query plans, or actual production latency.
Same populated fixture; authenticated direct HTTP requests bypass client prefetch.
Three samples per endpoint; table reports medians:

| Endpoint | Before | After |
| --- | ---: | ---: |
| `/api/me` | 170ms | 87ms |
| `/dashboard` | 766ms | 675ms |
| `/horses` | 280ms | 183ms |
| `/care` | 448ms | 342ms |
| `/team` | 683ms | 612ms |

First Team request with a cold revision cache: **1032 → 696ms** (single samples).
Subsequent Team samples benefit from its pre-existing two-second revision cache.
These HTTP timings were measured after the authorization/revision query changes;
subsequent prefetch/revisit settings affect client navigation, not those direct
HTTP reads. Results support a modeled latency reduction, not a production claim.

Actual query trace: authorization **3 → 1 statements**; Team revision **4 → 1**.
Local SQLite Team-cache test: 30 uncached calls **4.6ms / 30 SELECTs**; concurrent
calls **0.2ms / 1 SELECT**; warm reads zero SELECTs. Those local timings are not
representative of a remote production database.

## Verification completed

- Final production build/type checking, process-execution audit, diff whitespace.
- `farm-context-query.ts` tests on SQLite and disposable PostgreSQL: three old
  statements versus one new statement; identity/farm-name equivalence; verified
  user with no memberships; single/multiple memberships; explicitly unavailable
  farm; revoked session/version; suspended membership; unverified user; role and
  reminder settings; injection-shaped input. No shared authorization cache.
- `team-revision-query.ts`: SQLite old/new fingerprint equivalence for empty and
  populated farms, completions, dismissal and deletion. PostgreSQL execution,
  timestamp/null/count types and foreign-farm separation. A PostgreSQL UNION
  null-type issue was caught and corrected before the final build.
- `team-revision-cache.ts`: coalescing, farm keys, mutation invalidation and expiry.
- `daily-navigation-browser.mjs`: all four desktop/mobile tabs, full-data readiness,
  zero document reloads, and completion invalidating an already warmed Team view.
- `workspace-cache-browser.mjs`: two deliberately warmed farm snapshots, farm
  switching in two tabs, no foreign horse leakage, account request deduplication,
  focus expiry and logout.
- `care-calendar-browser.mjs`: desktop/mobile, exact week/filter URL behavior,
  scope, assignment, rescheduling, completion persistence and staff controls.
- `workspace-navigation-browser.mjs`: cold/intent controls, Team remains usable
  during revision checks, explicit Show latest actually updates displayed work.
- `task-completion-browser.mjs`: staff work disappears and persists, no approval
  wording, concurrent saves, route changes during save, rejected/lost responses,
  duplicate/stale occurrences, recurrence, authentication/origin/farm boundaries.
- `farm-tasks.mjs`: server actions, assignment, staff visibility, farm isolation,
  replay/concurrency protection, removal cleanup and completion history.
- `care-workflow-browser.mjs`, `optimistic-tasks.mjs`,
  `horse-search-browser.mjs`: completion details, costs/history/export, manager
  review/undo, mock reminder preferences, optimistic rollback, search and filters.
  No browser page errors in these final runs. The isolated hydration error from
  the earlier pass has not reproduced; this is not presented as a hydration fix.

## Reproduction / deployment

Use the existing local browser test environment with a disposable
`TEST_DATABASE_URL=file:/private/tmp/<test>.db`, local `TEST_BASE_URL`, optional
`PLAYWRIGHT_MODULE_PATH` and `TEST_CHROME_PATH`. Run
`tests/daily-navigation-browser.mjs`; use `TEST_VIEWPORT_WIDTH=390` for mobile.
`PERFORMANCE_BASELINE=1` records timings without enforcing warm expectations.
Full-data prefetch is checked independently of shell-only responses.

Query tests also require `PGLITE_MODULE` and `TEST_POSTGRES_SCHEMA`, generated
from the current Prisma PostgreSQL schema into a temporary file, not a production
connection. Reminder workflow uses mock configuration and no real email keys.

Deploy these changes before evaluating production performance. Follow with
real authenticated device/farm measurements, including cold clicks, warmed clicks,
expired caches and save actions. Production was not modified by this follow-up.

Framework reference: [Next.js 15 prefetching](https://nextjs.org/docs/15/app/guides/prefetching).
