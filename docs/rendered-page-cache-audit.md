# Rendered page caching audit

## Outcome

The useful shared output is already cached. No runtime caching changes were needed. This audit added a regression/verification script and this report; it does not claim a new speedup.

## Cache inventory

| Pages / fragments | Existing handling | Refresh / variation |
| --- | --- | --- |
| `/`, `/terms`, `/privacy` | Build-time HTML and React Server Component output, served from Next/Vercel full-route/CDN cache. No user-specific server rendering. | Content is source-controlled and regenerated on build/deployment when edited. No periodic refresh is needed for content that cannot change independently of a deploy. |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/invite`, `/auth/google/complete` | Prerendered shells; interactive form state, fragment tokens, and authentication requests handled on the client/API. | New build refreshes shells. Authentication results are not embedded into the shared page. |
| `/onboarding` | Prerendered shell with client-side loading of `/api/me`. | Farm selection/account data loaded separately for the current session. |
| Navbar | Client component; farm name and role-dependent navigation loaded through `/api/me`, not server-injected into shared public HTML. Navbar is hidden on public/auth screens. | Current pathname/session determines client state. No shared account data cache introduced. |
| Dashboard, horses, care, team, horse edit/create | Per-request authenticated farm data, guarded by membership checks; absent from prerendered route manifest. | Existing action/API invalidation retained. Task status, roles, assignments, and due dates change frequently; no shared full-page cache introduced. |
| Account and task APIs | Dynamic, session-scoped routes. | Not added to a shared rendered-output cache. |

Caching a few static labels inside dynamic farm pages would not remove their database/auth work and would add complexity without an established rendering bottleneck. Experimental partial prerendering is unnecessary for the existing public shells.

## Cache keys and privacy

There is no localization or header-based content negotiation in the current pages: root layout is `lang="en"`. Public output does not vary by selected farm, account, or Accept-Language; client state is fetched separately. Vercel/Next retain their own deployment, path and RSC variant handling; no manual cache key or Cache-Control override was added. If localized content is introduced, use explicit locale routes or an appropriately varied cache key rather than reuse this English-only assumption.

Public-page checks compare rendered HTML with default/en-US/fr-FR language requests and an invalid selected-farm cookie. These checks do not simulate two authenticated accounts. Private-route exclusion was confirmed from the build manifest/source, plus live unauthenticated redirects/401 responses; this audit is not a new cross-account authorization penetration test.

## Evidence

The latest local production build's `.next/prerender-manifest.json` lists every shared shell above with `initialRevalidateSeconds: false` (static build output), and excludes the private pages/APIs checked by the script.

Live site https://getreinwell.com, deployed commit 023eb28:

- Home, terms, privacy and login all returned `x-vercel-cache: HIT` during repeat verification, without Set-Cookie.
- Earlier first requests to terms/privacy reported PRERENDER followed by HIT.
- Warm observed requests were generally around 40–70 ms, with occasional higher network timings. Initial home measurement was 875 ms despite being a HIT, demonstrating connection/network effects.
- Shared cached HTML matched byte-for-byte across tested language/farm variations.
- Unauthenticated `/dashboard` redirected to login; `/api/me` returned 401 without a shared-cache-hit header.

These results verify cached delivery, not a controlled before/after latency improvement or aggregate invocation reduction. Public React pages are rendered at build time rather than per request; middleware validation and client API requests can still execute, so caching does not eliminate all server work.

Commands (run after a production build):

```
node tests/rendered-cache.mjs
node tests/rendered-cache.mjs https://getreinwell.com
```

Both pass. No production cache purge, source modification to app behavior, or deployment was performed. Existing circuit-breaker work and earlier audit files in the working tree were preserved.

References:
- https://nextjs.org/docs/15/app/guides/caching
- https://vercel.com/docs/caching
