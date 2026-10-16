# Google sign-in setup and verification

Google Cloud project: Reinwell (`sturdy-shelter-511816-e0`). Billing was not enabled.
The user accepted Google's first-time Cloud terms. OAuth branding, web client,
credentials, and a real Google sign-in are still pending.

## Configuration

Production origin: https://getreinwell.com
Authorized redirect URI: https://getreinwell.com/api/auth/google/callback
Authorized JavaScript origin (if requested): https://getreinwell.com
Scopes: openid, email, profile only. No Gmail/Drive/Calendar permissions.

Server-side environment variables:
- GOOGLE_CLIENT_ID: web OAuth client ID.
- GOOGLE_CLIENT_SECRET: encrypted server-side credential; never commit or log it.
- GOOGLE_AUTH_ORIGIN: https://getreinwell.com (localhost HTTP allowed for development).

Google button is hidden when credentials are missing or the hostname differs
from GOOGLE_AUTH_ORIGIN. Preview/old-host password login remains available.
An explicit terms checkbox is required for new Google signup. Existing users
can use Google from Login; an unknown Google user is directed to Signup first.

## Account and security behavior

- Official google-auth-library 11.3.1 performs code exchange and ID-token checks.
- Authorization code flow uses PKCE S256, state, nonce, an HMAC-signed HttpOnly
  10-minute flow cookie, fixed configured callback origin, and strict POST Origin.
- OAuth tokens are not persisted. Provider errors are not logged because they
  can contain credentials. Callback redirects clear the flow cookie.
- User.googleSubject is unique and preserves stable Google identity.
- Existing verified Gmail/Workspace accounts link to the existing User ID;
  passwords, farm memberships, roles and data stay unchanged.
- Unverified existing accounts must verify their Reinwell email first. Google
  sign-in must not enable a potentially attacker pre-registered password.
- Previously unlinked third-party email Google accounts use email/password;
  Google's email_verified alone is not proof of current mailbox control.
- New Google users receive a random unguessable hashed password, no farm or
  elevated role, and explicit terms acceptance. Google verifies their email.
- Existing farm cookies are cleared at login; farm access is resolved normally.
- A same-tab completion page preserves pending invitation handoff in sessionStorage.

## Database

Only the nullable User.googleSubject column and unique index were applied to
hosted Supabase via migration google_identity. No care-history migration was
applied. Before/after security advisors returned no findings. This hosted DB
has no _prisma_migrations table; migration history is maintained in Supabase.
Prisma SQL source: prisma/migrations/20261016170000_google_identity/migration.sql.

## Verification completed

- Working checkout and isolated production-source snapshot built successfully.
- tests/google-auth.ts: state signature/expiry/origin, PKCE/nonce, terms, stable
  identity, existing farm/role/password preservation, unverified pre-hijack and
  external-email/conflicting-link rejection against disposable SQLite.
- tests/google-token.mjs: Google's actual signature/audience/issuer/expiry
  verification plus app nonce/verified-email/subject checks. Provider token/key
  transport is simulated only in the test, never in production.
- tests/google-auth-http.mjs: real local HTTP rejects forged/missing Origin,
  invalid callback state and unauthenticated completion; private flow cookie.
- Browser: local signup shows Google button disabled until terms are selected.

Not yet verified: live Google consent -> callback -> signed session -> farm;
Google signup with terms; invited Google account joining the intended farm.
Do not claim Google sign-in is operational until credentials and those real
flows have been checked. Do not deploy unrelated uncommitted local features.

Official references:
https://developers.google.com/identity/openid-connect/openid-connect
https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
https://github.com/googleapis/google-auth-library-nodejs
