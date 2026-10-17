# Reinwell mobile store readiness

> October 16 release update: care history and password-reset migrations are now
> applied to hosted Supabase; Google identity was already applied. EMAIL_FROM
> and the verified sending domain were already configured. See
> docs/product-cleanup-release.md for current scope and verification status.


Reviewed October 16, 2026. Source checkpoint: `2e5f69a` on
`codex/reinwell-redesign`, plus the existing uncommitted feature work.

## Decision

Reinwell is a functioning web product, not yet a store-ready mobile build.
Keep Next.js on Vercel and Prisma/PostgreSQL on the server. Evaluate a separate,
bundled React mobile frontend using Capacitor, sharing validation/types and
portable UI with the web app. Prove authentication and one complete care flow
before committing to that architecture. React Native is an alternative if this
prototype shows poor device behavior; it would require more UI rewriting.

Do not point a production Capacitor shell at getreinwell.com using server.url.
Capacitor documents that option as intended for live reload, not production.
Do not static-export the current Next.js application: server components,
server actions, cookie-based access checks and API routes require its server.

## Repository findings

| Area | Evidence | Required work |
| --- | --- | --- |
| Packaging | package.json has only Next.js scripts; next.config.js has no export config; no native projects or Capacitor config found | Separate bundled client and signed iOS/Android projects |
| Server coupling | dashboard, horse profiles/timeline and care pages query Prisma; care mutations use server actions | Add stable JSON read/mutation APIs using the same farm/role checks and shared service functions |
| Authentication | src/lib/auth.ts reads HttpOnly cookies; middleware validates sessions and request origins | Define mobile session transport, expiry, revocation and secure device storage; retain web protections |
| Google OAuth | fixed web origin/callback, flow cookie and same-tab completion | System browser or supported native SDK, verified return to app and server-side identity validation |
| Invitations | src/lib/pending-invitation.ts uses sessionStorage; /invite reads a fragment token | Preserve pending invitations across browser/app handoff, process cold and warm app links, retain email binding |
| Account lifecycle | No reset-password or account-deletion routes found | Password recovery, account settings, verified deletion and public deletion-request page |
| Mobile UI | Responsive navigation and dialogs exist; no safe-area CSS found | Insets, keyboard, Android Back, focus/accessibility, large text and reconnect behavior on devices |
| Assets/links | No public directory found in this checkout; no manifest/native association files found | Icons, launch assets, Apple association and Android asset links, support page |
| Privacy | /privacy has general collection/sharing text and an unspecified contact instruction | Real support contact, retention/deletion details and accurate store disclosures based on actual SDK/data inventory |
| Release dependency | Local code reads CareCompletion and VetItem.assignedMemberId | Apply only the reviewed care upgrade after hosted schema/backup checks, before deploying dependent code |

These are source findings, not new browser or device verification. Earlier
verification documents describe prior disposable-database testing. Owner
reports live Google sign-in and email verification working; Google public
audience and Google-specific invitation flow still require checking.

## Ordered implementation plan

### 1. Stabilize account and web release behavior

- Verify Google public audience/publishing state and invited-user Google flow.
- Implement expiring, single-use password reset tokens, rate limits, generic
  account-discovery responses, Resend delivery and session revocation on reset.
- Add account deletion with recent authentication. Resolve sole-manager farm
  ownership before deletion; do not silently delete shared farm records.
  Define deletion/anonymization of recorder names and invitation records.
- Update handoff docs to reflect completed Google/email rollout.
- Re-run relevant local feature suites on disposable data. Reconcile hosted
  schema and migration history, obtain/verify backup, apply the targeted care
  migration, deploy, and verify real browser/API/persistence and isolation flows.
  Never run every migration blindly or change DATABASE_URL/pooler routing.

### 2. Prove the mobile architecture

- Create a separate bundled React client and minimal iOS/Android projects.
  Final bundle/application identifiers depend on publisher ownership.
- Extract shared business services behind authenticated JSON endpoints for
  dashboard, horses, timeline, care and farm switching; do not call generated
  Next.js server-action identifiers from the mobile client.
- Preserve web cookie auth. Design mobile-specific revocable sessions using
  platform secure storage and server-side membership validation. Never embed
  database, OAuth client secrets or privileged service credentials in the app.
- Use supported Google sign-in outside an embedded WebView. Bind the flow to
  the initiating device with state/PKCE. A browser completion can issue a short
  lived, single-use, device-bound exchange code; never put reusable session
  tokens in return URLs. Browser cookies do not automatically authenticate the
  bundled client. Confirm the exact platform SDK/redirect configuration during
  implementation before adding OAuth clients.
- Preserve terms consent and pending invitation intent on the server/device;
  sessionStorage alone cannot bridge separate browser and app contexts.
- Add verified Universal Links/App Links for invitations, verification and
  recovery. Test fragment handling without logging tokens.
- Prototype gate: on a real iPhone and Android device, sign in, open the
  intended farm, complete assigned care, see the persisted timeline record,
  restart the app, then sign out and confirm access is revoked.

### 3. Complete the first mobile release

- Scope: overview, horses, care schedule/history, activity recording, farm
  switching, invitations and account management. Preserve manager/staff roles.
- Add Sign in with Apple as the planned iOS equivalent to Google; validate
  stable subject identity, private relay email, linking and deletion behavior.
  Do not assume Reinwell qualifies for Apple's enterprise-login exception.
- Add opt-in care reminders as a useful mobile capability. Define a timezone
  policy first (care currently uses server-local dates, timeline uses UTC).
  Cancel/reschedule reminders on completion, reassignment and logout. Local
  reminders can become stale after another device edits a task; document that
  limit or implement synchronized server delivery before promising accuracy.
- Add offline/reconnect UI; never show an unconfirmed completion as saved.
  Offline editing/sync is a separate feature, not implied by a bundled app.
- Verify safe areas, keyboard dismissal, Back navigation, dialogs, large text,
  VoiceOver/TalkBack and expired-session recovery.

### 4. Store preparation and beta

- Owner enrolls in Apple Developer and Google Play, choosing individual or
  organization publisher identity. No enrollment/purchase performed here.
- Configure signing, app identifiers, verified domains, production API origin,
  version/build numbers and a secure release process.
- Inventory actual libraries, permissions and data flows; complete Apple App
  Privacy and Google Data safety accurately, including required privacy
  manifests for the selected native SDKs. Add a working public deletion path.
- Prepare icon, screenshots from final builds, support/privacy URLs, description,
  age ratings, reviewer instructions and an isolated demo farm/account.
- Decide launch monetization before adding checkout; digital subscriptions may
  require store billing depending on product, storefront and applicable rules.
- Run TestFlight and Play testing. New personal Play accounts created after
  November 13, 2023 require 12 continuously opted-in testers for 14 days before
  applying for production access. Recheck submission SDK/toolchain requirements
  when cutting the release; they change over time.
- Submit only after signed builds pass the device acceptance matrix below.

## Acceptance matrix

Every row must pass on both platforms against a controlled hosted test setup.
Use disposable fixtures; do not seed real farm data or commit accounts/tokens.

| Flow | Required result |
| --- | --- |
| Email signup/verification/reset | Delivery, expiry, replay rejection, safe app return and revoked old sessions |
| Google / Apple | Consent/cancel/error paths, identity preserved, secure callback and restart persistence |
| Invitation while signed out | Correct invited identity, intended farm/role, cold/warm links and replay rejection |
| Farm access | Switching, staff restrictions, foreign IDs denied, removed membership loses access |
| Horse/activity/care | Validated writes, reload persistence, retained history and duplicate completion protection |
| Connectivity | Offline launch, interrupted save, retry without duplicate data, expired session |
| Deletion | In-app and web request paths, recent auth, shared farm protection and personal-data handling |
| Native behavior | Insets, keyboard, Android Back, accessibility, reminder cancellation and denied permissions |

## Official references checked October 16, 2026

- [Capacitor configuration: bundled assets and development server options](https://capacitorjs.com/docs/config)
- [Google OAuth native applications: embedded user-agent restrictions](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Apple review guidelines: minimum functionality, login services, account deletion](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play account deletion: in-app and public web paths](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Apple enrollment](https://developer.apple.com/programs/enroll/)
- [Google Play enrollment](https://support.google.com/googleplay/android-developer/answer/6112435)

## Scope of this audit

Read-only inspection of relevant source/configuration plus official documentation,
followed by creation of this plan. No implementation, dependencies, native builds,
device/browser tests, production configuration, migration, deployment or purchase
was performed. Existing unfinished files remain preserved.
