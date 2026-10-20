# Workspace navigation and returning to browser tabs

Implemented and verified locally; not pushed or deployed. Includes the pending
employee completion repair, which remains intact.

Findings and changes:
- Team's focus/visibility/poll listener performed a full document reload whenever
  its revision changed. It now checks for changes without replacing the page and
  shows a nonblocking Team changes are ready / Show latest notice. Loading the
  latest Team view happens only when the manager chooses that link. This also
  avoids a reproduced background RSC refresh case that received fresh data but
  did not update the displayed view. Focus/visibility checks share a five-
  second cooldown, skip active edits and task saves, and time out after five
  seconds. The existing 15-second visible-tab polling remains.
- Sidebar links used default partial prefetching for dynamic pages. WorkspaceLink
  upgrades them to full route prefetch on hover, keyboard focus or touch intent.
  It does not fully fetch all screens on sidebar mount. The client prefetch cache
  has a 30-second lifetime (ordinary dynamic route freshness remains zero).
- Every focus event discarded even a fresh workspace snapshot. Focus now reuses
  the existing ten-second TTL and in-flight request. Expired snapshots refetch;
  farm/account mutations still invalidate across browser tabs immediately.
- Navbar no longer resubscribes and starts a workspace lookup on every pathname.
  A detected farm/account/role scope change refreshes the route cache, preventing
  prefetched data from a prior workspace from lingering after a farm switch.
- Manager priorities have their own Suspense boundary and reserved card skeletons,
  so their queries no longer hold back the dashboard's main content and My tasks.

Private pages remain dynamically rendered and farm scoped; no shared cache of
farm output, new infrastructure, credentials or database schema changes were
introduced. These changes remove avoidable navigation work; database/network
latency and server cold starts can still affect a cold visit.

Verification:
- Production build/TypeScript and git diff --check passed.
- tests/workspace-navigation-browser.mjs exercises cold versus intent-prefetched
  navigation with an artificial 700ms transport delay, checks zero sidebar
  document reloads, and verifies Team receives newly written rows while remaining
  interactive during a deliberately delayed revision check, displays an update
  notice and loads the new rows when Show latest is selected.
- tests/workspace-cache-browser.mjs verifies navigation reuse, quick-focus reuse,
  expired-focus refresh, cross-tab farm switching and logout.
- tests/workspace-client-cache.ts verifies concurrent deduplication, TTL expiry,
  invalidation, failed-read recovery and discarding old in-flight account data.
- tests/page-transitions.mjs verifies scroll/back behavior, interaction and reduced
  motion. tests/rendered-cache.mjs confirms private pages are not prerendered into
  a shared cache.
- Completion and care workflow browser suites passed again with the streamed
  dashboard: persisted employee completion, failures/timeouts, history, manager
  review and undo, reminders and phone layout.

One local slow-connection run measured a cold route at 1,817ms and the fully warmed
route at 51ms after click. This is a synthetic local measurement, not a production
latency guarantee.
