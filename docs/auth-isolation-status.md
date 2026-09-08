# Authentication and farm isolation checkpoint

Sessions require AUTH_SECRET (at least 32 characters, randomly generated per environment). No default is provided. Old cookies are invalidated by the signed expiration format. Sessions expire after seven days; a session version is checked against the user record on each data request, and logout increments that version to invalidate copied tokens.

Production signup deliberately returns 503 until real verification email delivery is implemented. Development verification links remain available. No database schema changes or production migrations were applied in this pass.

All current horse reads/writes and care actions require an active farm membership. An explicit farm cookie is validated against memberships. A sole membership is selected automatically; multiple memberships require selection on /onboarding, accessible through Switch farm. Legacy unassigned horses, trainers, and settings remain unassigned when a farm is created.

## Verification performed

- TypeScript and git diff whitespace checks passed.
- HTTP integration tests on a separate SQLite database passed: signup, unverified login denial, verification/replay denial, farm/horse creation, own-farm access, cross-farm horse CRUD/ride/grooming denial, detail/edit page denial, forged/expired sessions, unauthorized farm selection, legacy record preservation, own-farm and cross-farm care completion/rescheduling, active-farm switching, membership removal with a stale farm cookie, login throttling, and logout token revocation.
- Browser login reached the correct farm dashboard; browser care creation persisted and appeared in the schedule.

Test runner: tests/isolation.mjs. Start Next development on port 3108 with DATABASE_URL pointing at a freshly initialized file:/private/tmp/ database and a disposable AUTH_SECRET. Run the script with the same AUTH_SECRET and TEST_DATABASE_URL matching the server database. Never point this test runner at a database containing real data.

Failed login attempts are keyed by a SHA-256 hash of the normalized email and client IP. Five failed attempts lock that key for 15 minutes; a successful password check clears earlier failures. This requires the `LoginRateLimit` table and `User.sessionVersion` column in both local and PostgreSQL databases before the app is started.

## Remaining before real users

The empty connected Supabase PostgreSQL project received the farm/auth schema upgrade and server-only RLS policy on September 8, 2026. The matching RLS SQL is tracked in `supabase/migrations/`. Google sign-in, real email delivery, invitations, and granular staff permissions remain unfinished. Cross-farm care creation is guarded and own-farm creation was browser-tested, but direct adversarial care-creation testing remains to be added. Production signup gating has been inspected but not run under a production server.
