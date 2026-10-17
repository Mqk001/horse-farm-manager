# Password recovery — October 16, 2026

> October 16 release update: care history and password-reset migrations are now
> applied to hosted Supabase; Google identity was already applied. EMAIL_FROM
> and the verified sending domain were already configured. See
> docs/product-cleanup-release.md for current scope and verification status.


## Behavior

Login links to /forgot-password. A verified account can request a Resend email
with a 30-minute single-use reset link. Unknown and unverified accounts receive
the same success response; provider rejection also uses that response and
removes the undelivered token. Missing email configuration returns 503 for all
accounts. Separate hashed account/IP request limits use the existing database
rate limiter. The endpoint never returns the token, including in development.

/reset-password reads the token from the URL fragment and removes the fragment
from browser history. GET renders a form and never consumes a token. Passwords
must contain 8–128 characters, matching signup. The server stores only SHA-256
hashes of random 256-bit reset tokens. Issuing a new link replaces old links.
Successful consumption and password update are transactional and bound to the
account's sessionVersion; concurrent/replayed requests cannot both succeed.
Reset increments sessionVersion, clears current session/farm cookies, and
requires fresh login. Email verification, Google identity, farm memberships,
and roles remain unchanged. Unverified users must use email verification first.
Both mutation endpoints require a matching request Origin/Host/protocol.

## Deployment

This implementation remains local. No production migration or deployment was
performed. Apply only the reviewed additive PasswordResetToken migration:
prisma/migrations/20261016200000_password_reset/migration.sql, after checking
hosted schema/history and backup. It includes server-only RLS and revokes public,
anon and authenticated privileges. Both Prisma schemas include the new model.
Do not run the full migration queue: care history remains separately pending.

An isolated password-recovery release should include the auth routes/pages,
PasswordRecovery component, login link, Navbar public-page exclusion,
middleware public paths, password-reset service, email sender, the new model
and User relation in both schemas, and this specific migration. Do not include
the unrelated care schema edits merely because they share schema files.
Preserve DATABASE_URL and DATABASE_POOLER_HOST. Use the existing Production
RESEND_API_KEY and EMAIL_FROM; do not retrieve or print their values.

After deployment, verify inbox delivery, link use, new-password login and old
session rejection using an owner-approved disposable account. No real reset
email was sent during the local checks. Do not claim live recovery works yet.

## Verification

- Production build and TypeScript checks passed.
- tests/password-reset.ts passed on disposable SQLite: token hashing, expiry,
  rotation, concurrent use/replay rejection, old-session version invalidation,
  password replacement, farm/Google identity preservation, mocked Resend email
  content, generic responses, unverified-account denial, provider-failure cleanup,
  missing configuration, foreign-origin rejection and request throttling.
- tests/password-reset-http.ts passed against a local production server:
  old/new password login, reset/replay, stale session /api/me rejection,
  cleared cookies, origin denial, fail-closed email and public page access.
- tests/password-reset-migration.mjs passed on disposable PGlite PostgreSQL:
  baseline + Google identity + reset upgrade without care migration, default
  grant revocation, RLS denial for anon/authenticated, FK and deletion cascade.
- Browser checks covered the login link, email form, configuration error with
  enabled retry, missing-link message and reset form rendering. Browser testing
  found and corrected a localhost origin mismatch and same-page fragment handling.
  Password submission was verified through the real HTTP suite.

Use a fresh file:/private/tmp/reinwell-password-*.db database, initialized with
prisma/schema.local.prisma, for these tests. Never run fixture suites against
real data. Run TypeScript suites with `node --import tsx`; the HTTP suite expects
its local production server on 127.0.0.1:3187 and no RESEND_API_KEY. For the SQL
suite, set PGLITE_MODULE to a temporary @electric-sql/pglite@0.5.10 installation's
dist/index.js file URL. PGlite was not added to project dependencies.

## Owner live confirmation

After the production release, the owner confirmed that reset email delivery,
password change and login with the new password worked. Earlier local-only
statements above describe the original verification checkpoint.
