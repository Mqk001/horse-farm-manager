# Authentication and farm isolation checkpoint

Sessions require AUTH_SECRET (at least 32 characters, randomly generated per environment). No default is provided. Old cookies are invalidated by the signed expiration format. Sessions expire after seven days; a session version is checked against the user record on each data request, and logout increments that version to invalidate copied tokens.

Production signup returns 503 when RESEND_API_KEY is absent; Resend delivery code is present but was not exercised in this verification pass. Development verification links remain available. No database schema changes or production migrations were applied in this pass.

All current horse reads/writes and care actions require an active farm membership. An explicit farm cookie is validated against memberships. A sole membership is selected automatically; multiple memberships require selection on /onboarding, accessible through Switch farm. Legacy unassigned horses, trainers, and settings remain unassigned when a farm is created.

## Verification performed

- TypeScript and git diff whitespace checks passed.
- HTTP integration tests on a separate SQLite database passed: signup, unverified login denial, verification/replay denial, farm/horse creation, own-farm access, cross-farm horse CRUD/ride/grooming denial, detail/edit page denial, forged/expired sessions, unauthorized farm selection, legacy record preservation, own-farm and cross-farm care completion/rescheduling, active-farm switching, membership removal with a stale farm cookie, login throttling, and logout token revocation.
- Browser login reached the correct farm dashboard; browser care creation persisted and appeared in the schedule.

Test runner: tests/isolation.mjs. Start Next development on port 3108 with DATABASE_URL pointing at a freshly initialized file:/private/tmp/ database and a disposable AUTH_SECRET. Run the script with the same AUTH_SECRET and TEST_DATABASE_URL matching the server database. Never point this test runner at a database containing real data.

Failed login attempts are keyed by a SHA-256 hash of the normalized email and client IP. Five failed attempts lock that key for 15 minutes; a successful password check clears earlier failures. This requires the `LoginRateLimit` table and `User.sessionVersion` column in both local and PostgreSQL databases before the app is started.

## Remaining before real users

The empty connected Supabase PostgreSQL project received the farm/auth schema upgrade and server-only RLS policy on September 8, 2026. The matching RLS SQL is tracked in `supabase/migrations/`. Google sign-in and granular staff permissions remain unfinished. Email delivery and invitation code now exist, but their live behavior was not verified in this pass. The prior Supabase migration statement above is historical and has not been independently rechecked. Production signup gating has been inspected but not run under a production server.

## September 15, 2026 local verification

The checkout was already at `265fef9`, ahead of the supplied handoff. Inspected session validation, user verification, farm selection, horse routes/pages, and care actions. Added the farm condition to care completion and rescheduling update queries so the write itself checks ownership.

Fixed the HTTP test runner to read verification tokens from URL fragments. The full suite passed against a disposable SQLite database on localhost, including new direct server-action tests proving that care creation rejects foreign and unassigned horses without inserting records, while own-farm creation persists. TypeScript and diff whitespace checks passed. The new action test reads the Next.js 14 development bundle to resolve the action ID, so run it against the development server built from this checkout.

No production deployment, PostgreSQL migration verification, live email sending, or new browser interaction was performed in this pass. Existing browser-test claims above refer to earlier work. These results cover the tested local boundaries and do not certify production readiness. Existing local package and database changes were preserved.

## September 27, 2026 continuation

Completed and browser-verified signup, email verification, farm creation, horse creation, ride logging, care scheduling/completion, logout, invitations, signed-out invitation handoff through signup, and manager-only team access. Invitation acceptance now binds the invited email, checks the inviter's current active manager role, rejects invitations predating membership removal, and atomically consumes tokens. Verification and invitation tokens are submitted in POST bodies rather than query strings.

Upgraded Next.js from 14.2.0 to 15.5.26 using the official async request API codemod. The production build passes and `npm audit` reported zero known vulnerabilities after pinning PostCSS 8.5.28. The local isolation, invitation-security, and production-auth suites passed before the final fresh-database rerun; the final rerun was blocked by the environment usage-limit approval gate.

Restored Supabase project `bbawjkryrotwrkwkitmh` and verified its current public schema: all 13 Reinwell tables exist, columns match the Prisma schema, foreign-key constraints are present, RLS is enabled on every table, and policies allow only the server role. No production data was inserted or changed. The Vercel project is `reinwell` (`prj_cXzNTAtaplyE8be2OmOBxhm0wHUc`).

Production deployment remains blocked until a disposable PostgreSQL connection is tested end to end, Vercel environment variables are audited, and Resend email delivery is exercised with a controlled test account. Google sign-in remains unimplemented.

## October 12, 2026 demo release attempt

The isolated SQLite farm-isolation, invitation-security, and production-auth suites passed in this pass, as did the Next.js production build. Updated Next.js to 15.5.27 and patched source-map-js; the production dependency audit reports zero vulnerabilities. Local SQLite files were removed from Git tracking and retained locally.

The application source was pushed to GitHub and a production deployment was created for the existing Reinwell Vercel project. A separate randomly generated production AUTH_SECRET was configured, and the existing Resend key was enabled for Production as well as Preview without reading its value.

The public login page rendered in the browser, but live sign-in failed: Prisma timed out fetching a PostgreSQL connection. Supabase management SQL independently failed with password authentication for postgres despite the project reporting ACTIVE_HEALTHY. Hosted persistence, current schema/RLS, and live email delivery therefore remain unverified in this pass. The site must not be described as a usable demo until DATABASE_URL is repaired and live save/reload tests pass. No live farm or horse data was changed by this release verification.

### October 12 recovery and live persistence verification

The user reset the database password and updated DATABASE_URL in Vercel. The supplied direct Supabase endpoint was unreachable from Vercel, so DATABASE_POOLER_HOST now routes direct Supabase URIs to the same project's transaction pooler, preserving the encoded password and database name, adding the project reference to the username, and requiring TLS. Conversion tests and the production build passed. Existing pooled and local URLs are left unchanged.

Production deployment dpl_H8AXEYbjP9wSDqfxBGgjy76CS936 is READY at https://reinwell.vercel.app, running application commit bc0a488. Browser sign-in with the existing verified account opened East Goods LLC. Creating Demo Horse and logging a 20-minute Demo Rider activity both succeeded through the live UI, were confirmed in Supabase PostgreSQL, and remained visible after full reloads. Those clearly labeled demo records remain available for demonstration. No browser console errors appeared in the tested flow. All 13 public tables have RLS enabled with policies scoped to the postgres server role.

These checks verify existing-account login and hosted horse/activity persistence. Current live signup email delivery and real-recipient invitations were not exercised; the default Resend test sender still needs a verified sending domain for general recipients. Google sign-in, password recovery, and granular staff permissions remain unfinished. The demo is not a certification of readiness for unrestricted real-user deployment.

### Separate accounts and invitation retest

The current code passed fresh isolation and invitation HTTP suites using a disposable SQLite database. Added explicit checks that separate-email accounts with separate farms have different horse listings and cannot read each other's profiles; invited staff can read the manager's farm horse and record shared activity. Wrong-email acceptance, expiration, replay, concurrent acceptance, inviter demotion, membership removal and invalid origins all passed.

Browser verification with local fixtures passed the signed-out invitation → sign-in → automatic acceptance → correct farm dashboard flow. The invited staff account could see the shared horse and was denied the manager-only invitation form. These results do not test production email delivery to a second real recipient; sending-domain verification remains required for the default Resend test sender.
