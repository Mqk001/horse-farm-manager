# Five separate performance tasks

Completed in the requested order. Changes are local, pending push/deployment. No paid cache service, schema migration, production credentials retrieval, production load test, or production data modification was performed. Earlier resilience and optimistic-UI work was preserved.

## 1. Inline critical icons

Finding: already implemented. Navigation/dashboard/care icons use lucide-react components rendering inline `<svg>`; Google branding and deletion-dialog graphics are also inline SVG. No separate SVG image files, SVG img URLs or SVG background requests were found in application source.

No graphic was duplicated or expanded into HTML unnecessarily. `tests/inline-icons.mjs` renders eight important icons and checks inline SVG, no external references, and less than 2 KiB per icon. Actual fixture sizes: 286–539 bytes. No new request reduction is claimed: these icons already require zero separate icon-image requests. JavaScript bundle loading/hydration is a separate cost.

## 2. Database connection pooling

Finding: Prisma already maintains a pool, and existing production configuration routes the Supabase direct URL to its transaction pooler. App code does not instantiate a client per operation/request or disconnect after each operation.

Changes:
- `src/lib/prisma.ts`: global client reuse now applies in production too, preventing separate module/bundle loads in the same warm process from creating extra clients.
- `src/lib/database-url.ts`: runtime maximum of one client connection for recognized Supabase transaction pooler URLs (port 6543), with `pgbouncer=true` even for already-pooled URLs. Other PostgreSQL runtimes cap at four. Existing stricter positive timeout settings remain, with connect/acquire timeouts capped at five seconds and socket/query timeout at ten seconds from the preceding resilience work. Migration/CLI routing helper and SQLite remain unchanged.

Verification: `tests/prisma-reuse.ts` confirms identical client identity across production module reloads and 32 concurrent disposable SQLite reads. `tests/database-url.ts` covers direct conversion, already-pooled compatibility, bounds, encoded credentials, TLS during conversion and local exclusion. These are conservative connection limits, not capacity figures derived from the production database. Each serverless instance has its own client; the external Supabase pooler handles backend multiplexing. Production connection churn/capacity was not load-tested, and no measured connection-latency reduction is claimed.

## 3. In-memory cache

Candidate: Google OAuth public signing certificates, previously cached only inside the short-lived SDK client created for each sign-in.

Changes:
- `src/lib/memory-cache.ts`: bounded process-local read-through cache, concurrent-miss coalescing, TTLs, failure eviction, explicit invalidation, and fallback to source when cache lookup/storage fails. Invalidating a pending entry prevents that old result from repopulating it. No stale-on-error results.
- `src/lib/google-oauth.ts`: fixed provider/certificate-purpose key, capacity two. Honor provider Cache-Control max-age minus Age, capped at one hour; no caching for absent freshness, no-store or no-cache. Only public certificates are cached, never tokens, identity payloads, account resolution, or authorization results. SDK signature/audience/issuer/expiry and app nonce checks still execute for every token. Provider circuit deadlines remain active.

Verification: four independently verified sign-ins perform four token exchanges but only one certificate fetch with cacheable headers; no-store causes four certificate fetches. Actual SDK JWT verification uses fixture RSA keys and mocked transport (`tests/google-certificate-cache.mjs`). Generic cache tests verify 50 concurrent consumers load once, expiration, eviction, invalidation races, errors and cache-failure fallback. Each server instance populates independently; provider freshness bounds make shared infrastructure unnecessary for public keys. No real Google latency benchmark was performed.

## 4. Client request cache

Candidate: repeated `/api/me` calls from Navbar on every pathname change and from the farm picker.

Changes:
- `src/lib/workspace-client-cache.ts`: one in-memory endpoint-keyed snapshot per browser module, ten-second freshness, five-second network deadline, concurrent-miss coalescing; failed/401 responses are not cached. In-flight responses invalidated during account/farm changes are discarded and reread.
- Navbar and onboarding use the same reader. Navbar skips account requests entirely on hidden/public screens and ignores obsolete consumer results.
- Invalidate after password login, Google completion, logout, password reset, farm create/switch, invitation acceptance and membership mutation. Browser focus forces refresh. BroadcastChannel sends invalidation-only messages across tabs, with a storage-event nonce fallback. Account data is not persisted in localStorage/sessionStorage.
- `/api/me` explicitly uses private, no-store HTTP headers. The short-lived application memory cache is intentional; intermediary HTTP caches must not store account responses.

The browser's current cookie session/selected farm is the scope for the fixed `/api/me` key. Account/farm transitions clear it rather than putting tokens in keys. No parameterized endpoints were added to this cache. Other managers' changes can leave navigation labels stale until freshness expires on the next read or focus triggers refresh; backend membership checks remain authoritative and uncached.

Verification: `tests/workspace-client-cache.ts` proves 20 concurrent consumers issue one request, cache hits, TTL expiry, mutation invalidation, failed-read recovery and stale-account response rejection. `tests/workspace-cache-browser.mjs` proves three screens plus the farm picker reuse one account request, switching farms refetches, another tab updates, focus refreshes, logout clears stale account UI and no browser errors occur. Tests use only local disposable accounts.

## 5. Repeated database reads

Candidate: each Team revision poll performs four aggregates; simultaneous managers poll the same farm. The resulting hash is a refresh hint, not an authorization decision.

Changes:
- `src/lib/team-revision.ts`: key `team-revision:<farmId>`, two-second TTL, capacity 128, single-flight misses using the bounded memory cache. Failed source reads are not cached; cache failure falls through to the source.
- Local invalidation after task create/complete/assign/dismiss, care create/complete/assign/reschedule, membership changes, invitation acceptance and horse update/delete. Relevant files: team/care actions, team member API, invitation accept API, horse detail API.
- Authorization and manager membership checks still precede every revision response. No shared cache of accounts, role decisions, horse lists, task lists or rendered private pages.
- `getFarmContext` in `src/lib/farm-access.ts` lets `/api/me` reuse its user/membership snapshot, removing the previous duplicate user and membership reads: two database read calls instead of four. This is per-request reuse, not a shared authorization cache.

Process-local invalidation is immediate on the writing instance. Other instances expire their refresh hint after two seconds, on top of the existing 15-second polling cadence; this is bounded eventual refresh, not cross-instance synchronous invalidation. Expiry rather than a distributed cache keeps this non-authoritative hint inexpensive.

Verification: `tests/team-revision-cache.ts` runs actual disposable SQLite queries. Thirty sequential uncached reads issue 120 aggregate SELECTs; thirty concurrent cold readers coalesce to four SELECTs total; subsequent warm reads issue none. Example local timings: 7.7 ms versus 0.2 ms. These workloads differ in concurrency and use local SQLite: query counts prove reduced source work, while timings are illustrative, not a controlled production speedup claim. Farm-key separation, explicit invalidation, changed hashes and TTL expiration are tested.

## Combined verification

Production build/TypeScript and diff whitespace checks pass. Unit checks cover icons, pooling configuration, cache semantics, client cache, Google verification and existing circuit breakers. Final local HTTP/browser regressions cover task/history permissions and isolation, membership changes, workspace-cache navigation/farm switching/cross-tab behavior, and optimistic update success/rollback. No deployment is implied by these results.
