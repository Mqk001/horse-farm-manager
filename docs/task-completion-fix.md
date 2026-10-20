# Employee task completion repair

Implemented locally; not pushed or deployed.

The old client used one pending flag for the entire page and waited for a server
Action's page rendering, followed by a full document reload. Its optimistic row
said “Waiting for confirmation”, which looked like manager approval. A stalled
request disabled every task indefinitely. These are confirmed code findings;
recent production runtime logs did not identify the user's particular failed save.

Completion now uses POST /api/tasks/complete. It returns JSON only after the
transaction commits. The task disappears after confirmation, and a background
router refresh reconciles counts and manager views without a document reload.
The brief pending text is “Saving completion…”, never approval. Manager review
and dismissal remain separate from completion and do not hold staff work open.

Pending state is per task, shared across duplicate appearances of that task, so
unrelated tasks remain usable. Failed requests restore the original controls and
entered details. A 15-second client timeout releases the pending UI and explains
that the outcome is uncertain: refresh to check whether it saved before retrying.
An abort does not claim to cancel or undo a server transaction.

The API and existing server Action fallback share transaction code. Active farm
membership is rechecked inside the transaction. Farm tasks preserve existing
manager/assignee restrictions and safely acknowledge retries without changing
the original completion date or author. Care retains existing farm-member access,
requires the expected due date, and rejects stale or replayed occurrences without
creating another history record or advancing recurrence twice. Existing legacy
completion snapshots and optional completion details are preserved atomically.

Care rows identify the specific due-date occurrence so hiding a completed one
does not mask the next recurring date. All related page paths and Team revision
are invalidated on save. Authentication, same-origin checks, body/field limits,
farm scoping and private/no-store responses apply to the API. There are no schema,
credential or hosting changes.

Verification uses a disposable local SQLite database and test users only:
- Production build and TypeScript checks.
- tests/task-completion-browser.mjs: staff save/reload persistence; no full-page
  navigation or approval message; another task stays usable while one is held;
  rejected writes; saved-but-lost response and 15-second timeout; idempotent farm
  retry; stale/duplicate recurring care; validation, authentication, origin and
  foreign-farm/other-assignee boundaries.
- tests/optimistic-tasks.mjs: duplicate task appearances, completion, unassignment,
  manager dismissal and visible rollback.
- tests/care-workflow-browser.mjs: completion details, history/export, manager
  review and dismissal/undo, reminder preferences and phone layout.
- tests/care-history.mjs and tests/farm-tasks.mjs: server Action fallbacks,
  concurrent/replayed writes, permission checks and history preservation.
