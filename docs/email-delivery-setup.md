# Public signup and invitation email setup

## Setup update (October 16, 2026)

- User purchased getreinwell.com. Resend domain status is Verified.
- Published Resend DKIM TXT and rsend/send CNAME records through Network
  Solutions; added monitoring-only DMARC. Existing website A records preserved.
- EMAIL_FROM is now `Reinwell <no-reply@getreinwell.com>` in Production and Preview.
- Production redeployed as dpl_CzdjStWr4j5EeDoF8w9riga7K7Ed, READY, using
  unchanged source commit 45671b41f7249c34671b6df2db1dc6f28551592a.
- Database settings and hosted schema unchanged. Unreleased local features were
  not deployed.
- A production resend request returned ok, but no email appeared in Resend.
  This endpoint intentionally returns ok for absent/already verified users,
  so this does not prove delivery. Subsequently, the user confirmed real public
  signup, emailed verification on phone, and laptop login. Resend showed the
  staff invitation Delivered; the user accepted it and the live team roster
  confirmed the staff membership.

## Original blocker (October 12, 2026)

The handoff reports that Production and Preview have RESEND_API_KEY but lack
EMAIL_FROM. Both functions in src/lib/email.ts therefore send from
onboarding@resend.dev. Resend restricts that test sender to the email address
associated with the Resend account; other recipients receive HTTP 403.
Existing-account login and manually provisioned demo accounts do not verify
public signup. No live delivery retest was performed in this documentation pass.

## Minimum setup for the existing Resend integration

1. Obtain a domain you control, including permission to edit its DNS. No domain
   purchase has been authorized. The website can stay at reinwell.vercel.app.
2. Add that domain (or a sending subdomain) in Resend, publish the exact DNS
   records Resend supplies, and wait for its sending status to be verified.
3. Set EMAIL_FROM in Vercel Production and Preview to an address on that verified
   domain, for example `Reinwell <accounts@your-domain.example>` (placeholder).
   Keep the existing RESEND_API_KEY and ensure it has access to that domain.
   A separate paid mailbox is not required for sending through Resend.
4. Redeploy so the new sender reaches the application runtime. Preserve
   DATABASE_URL and DATABASE_POOLER_HOST; this fix requires no schema changes.

A personal Gmail address cannot be used as the From address with this Resend
integration because the user cannot verify gmail.com. Sending through Gmail
would require a separate implementation and Google account setup, which has
not been selected or configured. Google sign-in does not fix invitation mail.

## Completion checks after setup

Use controlled real inboxes with permission to receive the test messages:

- Submit public signup through the live browser, confirm receipt at an inbox
  other than the Resend owner's, follow the emailed link, and confirm verified
  login plus farm creation persists after reload.
- From a manager account, send an invitation to another controlled inbox,
  confirm receipt, accept through the browser, and confirm the invited account
  shares the intended farm while a separate farm remains inaccessible.
- Exercise resend verification for an unverified account and confirm its new
  emailed link works. Check provider delivery status and database state as well
  as API responses; provider acceptance alone does not prove inbox delivery.

Keep verification enabled. Do not return production tokens, manually mark test
accounts verified to claim signup success, or commit credentials or test data.

Sources:

- https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
- https://resend.com/docs/dashboard/domains/introduction
