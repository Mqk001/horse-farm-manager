# Dashboard and horse filters — October 12, 2026

> October 16 release update: care history and password-reset migrations are now
> applied to hosted Supabase; Google identity was already applied. EMAIL_FROM
> and the verified sending domain were already configured. See
> docs/product-cleanup-release.md for current scope and verification status.


Local changes extend the existing dashboard and horse filters:

- Dashboard shows overdue care, care due today, and horses overdue for activity.
  Recent activity links to each horse. The ride total is explicitly labeled as
  the last seven days and excludes future rides.
- Horse filters include trainers who appear on recorded rides, combined with
  name/breed search, status, and overdue activity. Sorting supports name in
  either direction and most recent ride. Clear loads the unfiltered page
  directly; browser testing found the previous client navigation could stall.
- Trainer options and matching rides are scoped to the active farm, including
  both sides of the trainer/horse relation. No schema changes are required.

## Verification

The final production build and whitespace checks passed. A localhost production
server used a disposable SQLite database under /private/tmp, with two horses,
care fixtures, a trainer, and a second farm. No hosted data was changed.

Browser login and dashboard rendering showed the expected care and ride counts.
Trainer filtering returned the expected horse; combining an incompatible status
showed the empty result state. Most-recent-ride sorting showed the newer horse
first. Mobile testing at a 390px viewport exercised case-insensitive breed
search with the overdue filter. Clear was retested on the final build and
removed query parameters, cleared the field, and restored both horses. No
browser console errors were recorded during the inspected flow.

Local HTTP checks against the final build passed for combined search, trainer,
and overdue filters; reverse name sorting; foreign trainer IDs returning no
matches and no foreign trainer/horse names; and expected dashboard counts.
The own-farm database horse count remained unchanged.

These changes are local and have not been pushed or deployed. PostgreSQL and
live-site behavior were not retested. Email delivery remains pending domain
setup. Existing generated next-env.d.ts and email setup edits were preserved.
