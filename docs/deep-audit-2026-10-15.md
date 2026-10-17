# Reinwell deep feature audit — October 15, 2026

## Result and scope

The implemented local flows passed the checks below after six categories of
defects were corrected. This is a tested checkpoint, not a guarantee that no
bugs remain. All account/farm writes used disposable SQLite databases under
/private/tmp or in-memory PostgreSQL. Real farm data was not changed. Existing
uncommitted feature work and generated next-env.d.ts changes were preserved.

No commit, push, deployment, production migration, or purchase was performed.

## Defects corrected

1. Horse and ride/grooming endpoints accepted invalid fields or returned 500
   for malformed inputs. Shared Zod schemas now reject blank names, bad enums,
   invalid dates, negative/fractional numeric values, and oversized fields with
   400 responses before database writes. Horse updates retain partial-update
   support. Ownership checks remain in place.
2. Repeated URL parameters could produce arrays and crash horse filters or
   database queries. Listing, care, and timeline parameters now normalize to
   single strings before use.
3. Care dates such as February 31 silently rolled into another month. Creation
   and rescheduling now reject invalid calendar dates. Activity timestamps also
   validate the supplied calendar date.
4. Age zero disappeared from horse cards/details, and same-day activity could
   produce numeric zero instead of a boolean overdue flag. Zero age is displayed
   and overdue flags are explicit booleans.
5. Concurrent signup for one email could return a database error. The duplicate
   now returns 409; the concurrent regression expects one 201 and one 409.
6. Farm onboarding lacked network failure recovery. Load/create/select errors
   are handled, buttons recover, and duplicate pending submissions are blocked.

## Automated coverage

| Suite | Outcome | Coverage |
| --- | --- | --- |
| tests/features.mjs | Pass, development server | Signup terms/duplicates/concurrency, resend token rotation, farm creation, horse create/read/update/delete, invalid API inputs, rides/grooming persistence, query robustness, escaping, foreign-origin rejection, delete cascades |
| tests/isolation.mjs | Pass, development server | Verification/replay denial, own/foreign farm CRUD and pages, care actions, expired/forged sessions, farm switching, membership removal, login throttling, logout revocation |
| tests/invitations.mjs | Pass, development server | Shared/isolated listings, email binding, roles, expiry, inviter demotion, concurrent consumption, stale invitations, membership removal, invalid origins |
| tests/production-auth.mjs | Pass, production server | Email-dependent endpoints fail closed without credentials, no signup row inserted, secure/HttpOnly/SameSite cookies, logout revocation, verification GET rejected |
| tests/care-history.mjs | Pass, production server | Assignments and personal tasks, manager-only reassignment, foreign/inactive assignee rejection, invalid dates, duplicate/stale completions, recurring and one-off tasks, snapshots, legacy preservation, retained history after task deletion |
| tests/timeline.mjs | Pass, production server | 31 rides across pages with no omissions/duplicates; 580 minutes and two missing durations; inclusive UTC dates; care/grooming filters; monthly totals independent of filters; legacy/new history; invalid/empty ranges; directory status/breed/trainer filtering and sorting; foreign trainer isolation |
| tests/database-url.ts | Pass | Supabase pooler conversion, encoded credentials, TLS, unchanged SQLite/already-pooled URLs, rejected untrusted host |
| tests/email.ts | Pass, provider mocked | Missing configuration, Resend 403 for verification and invitations, HTML escaping, configured sender |
| tests/migrations.mjs | Pass, PGlite 0.5.10 | Actual PostgreSQL baseline and care migration SQL, legacy backfill, server-only policy, denied anon/authenticated reads and inserts, foreign keys, task-history preservation and horse cascade, 14 resulting tables |

The final Next.js production build, TypeScript checks, Prisma schema validation
for both providers, and whitespace checks passed. npm audit --omit=dev reported
zero known production dependency vulnerabilities.

PGlite ran only from /private/tmp/reinwell-pg-audit; it was not added to project
dependencies. To repeat the migration suite, install @electric-sql/pglite@0.5.10
in that temporary prefix and set PGLITE_MODULE to its dist/index.js file URL
before running node tests/migrations.mjs. This validates SQL behavior, not the
Supabase network, pooler, or Prisma PostgreSQL driver end to end.

Other integration suites require TEST_DATABASE_URL pointing to a freshly
initialized disposable SQLite database, TEST_BASE_URL matching its local
server, and the same disposable AUTH_SECRET for the isolation suite. Never run
these fixture-creating suites against real farm data. Care-history tests read
the matching build's server-action manifest.

## Browser coverage

Using a disposable manager and staff account, the browser checks exercised:

- Login, first-farm onboarding, empty dashboard, horse creation with age zero,
  editing, name/status filtering, and reload persistence.
- Ride and grooming dialogs, saved timeline entries and monthly totals.
- Recurring care creation, assignment at creation, rescheduling, completion,
  schedule advancement, and a new completion in the horse timeline.
- Mobile navigation at 390px, team form, local invitation creation, logout,
  signed-out invitation handoff, staff login/automatic acceptance, and shared
  farm dashboard. Staff care rows omitted manager assignment controls.
- Production-mode login and onboarding failure recovery: stop the local server,
  submit a filled form, observe the error and enabled button, restart the server,
  retry successfully, and reach the new farm dashboard.

No unexpected console errors were recorded in the inspected normal flows.
The intentionally offline check generated the expected network failure.
Horse deletion was checked through the API and cascade assertions; a full
keyboard/screen-reader audit and every browser/OS combination were not covered.

## Live checks and remaining limits

- Live login and signup pages rendered in the browser without console errors.
  No real signup or outgoing invitation was submitted during this pass.
- Supabase checks found RLS enabled on all 13 existing public tables and no
  security advisor findings. A read-only follow-up confirmed the interrupted
  audit schema was absent and public.CareCompletion was still absent.
- Vercel environment metadata, without decrypting values, confirmed Production
  and Preview have RESEND_API_KEY, DATABASE_URL, and DATABASE_POOLER_HOST but no
  EMAIL_FROM. The restricted Resend test-sender blocker remains. Mocked email
  tests do not prove real inbox delivery.
- The care-history migration passed the local PostgreSQL rehearsal but remains
  unapplied to Supabase. Apply the reviewed migration before deploying this
  checkout, then repeat authenticated browser/API/data checks against the hosted
  PostgreSQL app. Existing local non-test SQLite databases also need upgrading.
- The newest features and audit fixes are local. Live existing-account horse
  and ride persistence was verified in an earlier pass, not re-certified here.
- Google sign-in and password recovery remain unimplemented. Trainer filtering
  works for stored trainer-linked rides; no trainer-management/assignment UI is
  currently implemented.

Email setup: docs/email-delivery-setup.md. Deployment prerequisites:
docs/database-deployment.md.
