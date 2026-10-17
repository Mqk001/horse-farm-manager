# Horse timeline — October 14, 2026

> October 16 release update: care history and password-reset migrations are now
> applied to hosted Supabase; Google identity was already applied. EMAIL_FROM
> and the verified sending domain were already configured. See
> docs/product-cleanup-release.md for current scope and verification status.


Horse profiles now show a combined timeline of rides, grooming, and the latest
completion of each care task. Date filters are inclusive calendar dates in UTC;
activity type can be filtered separately. Pages contain 25 entries, with newer
and older navigation. Invalid or reversed date ranges show a validation message.

The selected month's ride count and recorded minutes are computed across all
matching database rides, independently of timeline filters and pagination.
Missing durations are counted explicitly. Care uses VetItem.lastDoneDate, so
earlier completions of a recurring task cannot be reconstructed from the
existing schema. The interface states this limitation. No schema migration or
production data change was made.

The server checks the active farm before rendering the profile; each timeline
and aggregate query also scopes the horse to that farm. Unused ride and wash
arrays are no longer serialized as horse props to the client.

## Verification

- Final Next.js production build passed, including type checks.
- Local production HTTP checks used disposable SQLite fixtures under
  /private/tmp: 31 rides spanning more than one page, grooming, completed care,
  and a horse in another farm. Monthly totals matched 31 rides, 580 recorded
  minutes, and two missing durations. Pagination, inclusive date filtering,
  care/grooming filters, invalid/reversed dates, and empty ranges passed.
- A foreign-farm horse rendered the Next.js not-found boundary and did not
  expose its name or timeline. With streaming, the transport can be HTTP 200;
  the assertion checks the rendered denial rather than assuming HTTP 404.
- Browser checks confirmed the combined timeline, the care-only filter,
  independent November totals of zero, and mobile layout at 390px. No console
  errors were recorded in the inspected flow.

Changes remain local, alongside the earlier dashboard and horse-filter work.
No push or deployment was performed. Live PostgreSQL behavior has not been
retested. Email setup remains pending.
