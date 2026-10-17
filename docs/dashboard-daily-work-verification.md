# Dashboard daily work — October 16, 2026

Deployed to production on October 17, 2026.

- My tasks appears before dashboard activity and farm metrics. It shows the selected member's overdue care and care due within the next seven days, ordered by due date, with a link to all assigned care.
- STAFF sees My work and assignment-focused introductory copy. Managers retain the farm overview below the personal task list.
- Horse selection, Log ride, and Log grooming reuse ActivityDialog and existing farm-scoped APIs. Successful saves close the dialog, announce the result, and refresh dashboard data.
- Assigned, overdue, and upcoming care can be completed directly from the dashboard. Existing completeCareItem handles selected-farm access, expected due-date checks, concurrent completion protection, immutable history, and view revalidation.
- No schema migration, notification service, or production fixture is involved.

Validation:

- Production build and TypeScript checks passed; git diff --check passed.
- Expanded tests/care-history.mjs passed against disposable SQLite and local production HTTP: staff/manager dashboard rendering, assignment filtering, farm isolation, ride/groom persistence and dashboard rendering, plus existing care assignment/history/concurrency checks.
- Local browser: staff sign-in/farm selection; ride and grooming saved through dashboard dialogs; saved ride rendered in recent activity; assigned task completed from My tasks and disappeared after refresh. Targeted database check confirmed one ride with the browser marker and exactly one completion history record.
- Browser recorded no warnings/errors during activity checks. Mobile layout inspected.
- Existing generated next-env.d.ts change preserved.

Email/push reminders, photos, calendar, exports, structured completion notes, invite history, and farm defaults remain future scope.

## Production release — October 17, 2026

- Code commit ea9113a17b186876b6fddd9d399755c15c7ab5eb pushed to codex/reinwell-redesign.
- Vercel production deployment dpl_AUUANVH2UY3f4nyyDRqY5bDBtrCY is READY, with getreinwell.com assigned and no alias error.
- Live HTTP: landing/login 200; anonymous dashboard redirects to login; anonymous ride/groom POSTs return 401; Google sign-in remains enabled.
- Authenticated production dashboard rendering and mutations were not checked in this release because the verification browser has no signed-in production session. Their end-to-end evidence remains local against the production build; no production fixtures were created.
