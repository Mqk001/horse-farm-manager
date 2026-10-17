# Team management and Google invitation verification — October 16, 2026

## Team behavior

Managers and owners can change another active member between STAFF and MANAGER
or remove that member from the selected farm. No owner promotion, owner mutation,
or self-change is supported. Blocking self-change and rechecking the actor under
a per-farm write lock ensures that concurrent managers cannot leave the farm
without an active administrator. Changes do not alter global user roles or
memberships in other farms.

DELETE marks membership REMOVED, preserves recorded history, and clears that
member's care assignments in the same farm. Pending invitations to the removed
member and invitations sent by a removed/demoted manager are revoked. A new
invitation can re-add a removed member. Creation/acceptance and access changes
acquire the same farm write lock before reading authorization or membership
state. The API rechecks active manager access inside that transaction.

PATCH accepts only a strict {role: STAFF|MANAGER} body. Both methods require a
matching Origin/Host/protocol. UI offers explicit confirmation, pending states,
error recovery, and refreshed member state. Owner/self rows omit edit controls.
No schema migration or new paid service is required.

## Local evidence

- Production build and TypeScript checks pass.
- tests/team-management.mjs passes through real local production HTTP: anonymous,
  staff, foreign-farm, owner and self denial; strict role/body/origin validation;
  promotion/demotion; immediate permission changes and removal; preserved other
  farm membership; assignment cleanup; stale-invitation revocation; removal
  concurrent with invitation acceptance; competing manager demotions.
- tests/google-invitation.ts passes against disposable SQLite and real local
  invitation HTTP with Google identity resolution: terms gate, email binding,
  no default farm/elevated access, correct farm/role, replay rejection, existing
  memberships preserved. It does not simulate Google's consent UI as proof of
  live OAuth.
- Existing tests/invitations.mjs passes, including expiry, inviter demotion,
  concurrent consumption, role preservation and farm isolation.
- Browser manager login, farm selection, member controls, protected owner/self
  rows, removal confirmation and cancellation were inspected. No warnings or
  errors were recorded in the inspected browser flow. Mutations and concurrent
  permission behavior were verified through the HTTP suite.

All local tests use file:/private/tmp/reinwell-team.db or a freshly initialized
disposable equivalent and a disposable AUTH_SECRET. No test credentials,
sessions, tokens, or databases belong in source control.

## Live Google invitation

The owner authorized a temporary test farm and a test invitation to their own
Google email. A disposable inviter was provisioned for this test; this does not
constitute evidence of signup/email verification. Farm creation and invitation
sending used Reinwell's real production APIs. The owner followed the email and
reported reaching the farm via Google sign-in. A targeted hosted check confirmed
the invitation was accepted and membership was ACTIVE with role STAFF in that
temporary farm. Existing real farms were not used for the test.

A request to list private production memberships while choosing the farm was
rejected by automatic approval review. No data was returned. Work proceeded
only after the owner authorized an isolated temporary farm instead.

## Google public audience

Owner-provided screenshot confirms External + Testing. Publish app is disabled
with an explicit requirement to finish Branding. Public publishing is therefore
NOT complete. Google Cloud failed to load Branding reliably in the agent's
isolated browser; native Chrome was in active use and tab actions were
interrupted. Owner assistance on the missing Branding fields was requested.
Do not equate successful Google login/invitation with public publishing.

## Release status

Deployment and temporary-fixture cleanup evidence will be appended after the
pinned production build is ready. Google branding/publishing remains separate
until verified in the Cloud console.

Owner's Branding screenshots show App name, support email, authorized domain
and developer contact already present. Homepage/privacy/terms URLs are blank.
Owner was instructed to enter the three existing public getreinwell.com URLs,
save, and return to Audience to publish. No logo or credentials were requested.

## Production result

Code commit ace0e7f67f4f6a3603ac1d01720d9e7e6772b0f1 deployed as
 dpl_3fPZEFKfTA3pdW5ZBftrZAFA5TpK, READY, assigned to getreinwell.com.
Live authenticated Team HTTP confirmed new controls, the protected self row,
and the invited member. Live rejection checks confirmed 401 for anonymous,
403 for foreign Origin and 404 for an unknown member. Google remains enabled.

Automatic approval review rejected creation of an additional production user
and membership for mutation testing. That fixture was not created. Successful
role/removal mutations were tested locally; live checks were read-only or
expected denials, without changing the owner's access for testing.

After the owner confirmed the Google invitation, the authorized temporary farm
and its disposable inviter were deleted with exact fixture IDs and a no-horses
guard. Both deletion counts were one. The owner's real user and real farms were
not deleted; only membership in the temporary farm was removed by its cascade.
No production test account/farm from this flow remains.

The owner reports completing the Branding/save/publish instructions. Explicit
confirmation that Audience now displays In production was requested; pending
that confirmation, do not describe public publishing as independently verified.
