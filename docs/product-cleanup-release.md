# Product cleanup release — October 16, 2026

## Scope

The product loop is dashboard attention → horses and ride/grooming records →
care schedule → horse timeline → team invitations.

- Public landing at / with Reinwell, “Stable care for farm teams”, signup CTA,
  sign-in link and a three-part horses/care/team strip. No fabricated stats.
- Trainer filter and its database queries removed. Obsolete trainer URL
  parameters have no effect. Trainer storage is frozen pending a full workflow.
- Team supports invitations and an active-member list. Copy states that scope;
  member removal and role editing are intentionally outside this release.
- Auth screens use Reinwell as the primary title and the form task beneath it.
  Local verification/invitation links are development-only in clients and APIs.
- Dashboard, care and horse copy describes actual records/tasks. Navbar uses
  a farm icon; deletion copy lists ride, grooming, scheduled care and history.
- Date/overdue logic is shared in src/lib/care-dates.ts. Care calendar dates
  and display use UTC, matching the timeline; activity age uses elapsed whole
  days, clamps future records to zero and is overdue strictly after the horse's
  configured interval. Care pages explicitly disclose UTC dates.
- Alert, Settings, feedingPlanJson and Trainer are frozen legacy storage in both
  Prisma schemas. There are no product workflows or intentional application writes for
  them. No destructive schema drops were performed. createAlertKey was removed.
- Releases the previously local dashboard, timeline, care history/assignment,
  input-validation work and password recovery after regression verification.

## Hosted configuration

Target: Supabase bbawjkryrotwrkwkitmh; Vercel Reinwell project
prj_cXzNTAtaplyE8be2OmOBxhm0wHUc in team_S6GrTDpAB3DwSTyXQCtqOJRW.

Read-only inspection found Google identity already applied (20261016163700).
The reviewed care_history_assignments and password_reset migrations were then
applied individually through Supabase, without baseline replay. Before/after:
8 horses, 6 memberships, 0 care tasks; the care-history backfill had no source
rows. New tables have RLS enabled and no anon/authenticated SELECT grant.
Security advisors returned no findings before and after. No existing records
were deleted, connection variables changed, or paid services enabled.

Vercel metadata confirmed EMAIL_FROM already configured in Production/Preview
and the existing Resend and Google sensitive variables present. Secret values
were not retrieved. Prior owner verification established signup and invitation
email delivery from the verified getreinwell.com domain. Reset inbox delivery
is a separate release check; never infer it from a generic API success response.

## Verification

- Production build and TypeScript passed.
- Shared date tests pass with America/New_York host timezone, including UTC day
  boundaries, leap-day validity, future activity and strict overdue thresholds.
- Production-mode disposable SQLite suites: care-history, timeline and
  production-auth pass. Trainer assertions now check removal of the control.
- Development-mode disposable SQLite suites: features, isolation and invitations
  pass, covering real HTTP CRUD, validation, persistence, care, farm switching,
  member removal denial, session revocation and invitation security.
- PGlite PostgreSQL rehearsals pass for care and standalone reset migrations,
  including backfill, foreign keys, RLS/public-role denial and delete behavior.
- Browser inspected public landing, CTA to signup, Reinwell heading and absence
  of workspace navigation on public screens. Earlier password-recovery tests
  cover expiry, concurrent consumption, replay, session revocation and email
  generation with provider transport mocked.

Local fixtures reside only in disposable /private/tmp databases; never commit
fixtures, credentials, databases or generated account/session output. Generated
next-env.d.ts work is preserved separately from the release commit.

Production deployment and live checks are recorded after the pinned build is
ready. Google audience/publishing and Google-specific invitation flow remain
separate unfinished checks; no new claim about those is made here.

## Production result

Source commit c90a1423ab78a9a4cb930d1d13cfab577eb7b7ae was pushed and deployed
as dpl_9L1oQ8jA3kk5FVXtmJPtpkFr6YTA, READY, with getreinwell.com assigned.
The initial incomplete deployment-tool request was rejected by automatic
approval review; it made no deployment. The subsequent successful request
explicitly pinned the reviewed commit, project, team and production environment.

Live browser checks confirmed the public landing, navigation to login and
forgot-password, Reinwell-first headings, and successful reset-request feedback.
/api/auth/google still returns enabled=true. One reset email was requested for
the owner-provided inbox. A retained unexpired hashed-token row confirms that
the provider accepted the send (provider rejection deletes that row). Inbox
receipt and password-change completion await the owner; neither is claimed.
No account password was changed on production during these checks.

Authenticated care/activity flows passed locally against the release source;
this pass did not create or complete care in a real hosted farm. No test farm
or test account was created in production. Only the owner-authorized reset
request changed account-related hosted data.
