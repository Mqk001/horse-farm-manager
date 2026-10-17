# Google sign-in setup and verification

> October 16 release update: care history and password-reset migrations are now
> applied to hosted Supabase; Google identity was already applied. EMAIL_FROM
> and the verified sending domain were already configured. See
> docs/product-cleanup-release.md for current scope and verification status.


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

## Release handoff

Code commit: 02a1e8cdf970c5798562de93ea7a899b876efd25.
Production: dpl_5HWKvmrcREhgXN68PMW5bekhFRxT, READY.
Live checks: /api/auth/google returns enabled=false because no Google client
credentials exist in Vercel yet; /login responds 200 with the normal login UI.
The owner approved using their existing Gmail address as Google support/contact.
The owner still needs to complete branding/API-policy acceptance in Google Cloud.
Chrome browser control disconnected; native Chrome could show the project URL,
but not the form. In-app Google Cloud navigation loaded inconsistently and
redirected to welcome/error, so it was not safe to keep submitting setup forms.
Do not claim Google login is operational. Next: branding, web OAuth client,
server-side credentials, redeploy this commit, then real account/invitation tests.

## Credentials enabled (2026-10-16)

Owner completed branding and web client creation and saved GOOGLE_CLIENT_ID
and GOOGLE_CLIENT_SECRET as sensitive Vercel Production variables. Values were
not retrieved. Redeployed tested commit 02a1e8c as
dpl_B9mL2wZ3oiz3NrorwnMqMDpcyrHq; deployment READY. Live login now renders
Continue with Google. Real browser start reaches Google's account chooser and
consent for getreinwell.com with only name/profile picture and email.
Awaiting owner consent before callback/session verification; secret correctness
and end-to-end login remain unverified. Google public audience status remains
uninspected.

## Terms UX fix (2026-10-16)

Owner reported new Google login returned to signup for missing terms. Commit
2e5f69a now prompts for explicit terms acceptance before Google on login/signup;
no password fields required for Google. Production deployment
dpl_5xBj4WZtCwh9WkrZiJMYcUJnBJKX READY. Isolated production build and TypeScript
passed. Local and live browser confirmed terms prompt appears on Google click,
links are present, checkbox unchecked, final action disabled until acceptance.
Owner still must perform acceptance and complete Google consent for live
callback/session verification.

## Live invitation and public-audience check (October 16, 2026)

The owner completed the Google invitation flow into an authorized temporary
farm. Hosted data confirmed an accepted invitation and ACTIVE STAFF membership.
Public-audience screenshot confirms External + Testing, with Publish app
blocked until Branding configuration is completed. Public publishing is still
pending. See docs/team-management-verification.md for exact scope/evidence.
