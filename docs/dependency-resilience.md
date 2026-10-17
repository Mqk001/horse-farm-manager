# External dependency resilience

## Inventory and changes

| Dependency / entry points | Protection |
| --- | --- |
| Resend: verification, invitation, password-reset emails (`src/lib/email.ts`) | One shared email breaker: 5-second deadline, maximum 4 active calls, no pending queue, opens after 3 consecutive failed calls, 30-second cooldown, then one recovery probe. A successful probe closes it; failure starts another cooldown. AbortSignal reaches fetch; unused response bodies are canceled. Non-2xx/network failures count. No automatic delivery retries. |
| Google OAuth token exchange and signing-certificate fetch (`src/lib/google-oauth.ts`) | Separate breaker with the same limits. Five seconds covers the whole exchange/verification, not 5 seconds per sequential call. Transport wrapper applies abort signal, 5-second native timeout and retry:false at request time, overriding SDK retry settings. Network errors, 429 and server errors count; ordinary 4xx rejections and invalid identity claims do not trip it. Existing signature, nonce, audience, issuer and expiry verification remains intact. |
| PostgreSQL/Supabase through Prisma (`src/lib/database-url.ts`, `src/lib/prisma.ts`) | Runtime URL bounds: at most 4 connections per Prisma instance, connect_timeout 5 seconds, pool_timeout 5 seconds, socket_timeout 10 seconds. Existing stricter positive settings are retained, including the Supabase pooler's connection_limit=1. Zero/unbounded, invalid or larger settings are capped. SQLite and CLI/migration URL helper behavior stay unchanged. No database circuit breaker or fake data fallback was added; the database is essential to most signed-in functionality. |
| Browser same-origin API fetches | These call this app, not additional third-party services. They do not share either outbound provider circuit. |

The helper is in `src/lib/dependency-circuit.ts`. Circuit state and concurrency budgets are per warm server instance, not fleet-wide. Cold starts and horizontal scaling have independent budgets. No new distributed service is required.

## Failure behavior

Email errors flow through existing handlers: signup/invitation return delivery errors and perform their existing cleanup; resend reports failure; password recovery keeps its generic response and removes the failed token. An open/busy circuit throws before starting provider work. There is no fallback that pretends an email was delivered. Email timeouts can have ambiguous delivery outcomes; no automatic retry was added.

Google errors follow the existing failed-sign-in redirect. Password sign-in does not call Google. An unavailable Google provider never bypasses identity verification.

On timeout, the caller is released and cancellation is requested. The concurrency slot remains occupied until the underlying operation actually settles. This avoids creating an unlimited number of abandoned calls if a transport ignores cancellation. Old concurrent successes cannot close a circuit that opened after they started.

Database limits are native Prisma PostgreSQL connector settings; queries are not merely abandoned with Promise.race. A connection acquisition timeout and query timeout are distinct, so they are not a single end-to-end request deadline. The database changes bound waits/connections but do not guarantee other database-dependent requests remain healthy during a database outage. No live database fault injection was performed.

## Verification

- `node --import tsx tests/dependency-circuit.ts`: simulated failing/slow operations cover cancellation, bounded actual concurrency even when abort is ignored, threshold/open rejection, one half-open probe, failed probe, successful recovery, late-completion isolation, expected input errors, and independent circuits.
- `node --import tsx tests/outbound-dependencies.ts`: real email and Google wrappers with mocked transports prove concurrency admission, shared email breaker across templates, Google timeout/signal/retry options, invalid-grant classification, provider failures opening circuits, and separate provider budgets. No real emails or Google requests.
- Existing email tests pass.
- Existing Google-token test passes using the actual SDK signature verifier with fixture keys and simulated provider transport.
- Database URL tests pass for pooler routing, credentials preservation, bounds, stricter values and SQLite exclusion. These test configuration, not live PostgreSQL timeout behavior.
- TypeScript and production build pass.

Source references for transport/connector options:
- https://github.com/googleapis/gaxios
- https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql (Prisma 5 Rust connector settings also checked against installed client usage)

No schema migration, production data change or deployment was performed. These changes are local pending push/deployment.
