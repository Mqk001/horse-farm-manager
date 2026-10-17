# Optimistic task updates

## Actions reviewed

The app has task completion, assignment/unassignment, rescheduling, task/care creation, activity creation, horse editing/deletion, invitation sending, farm switching, and membership changes. Previously these awaited their server action/API before showing persisted changes. The first optimistic rollout targets frequent reversible task-state changes; it does not claim every form in the app is optimistic.

Implemented:
- Complete scheduled care in Care and all Dashboard task locations.
- Complete farm tasks in Dashboard and Team.
- Unassign care/farm tasks from Team member workloads.
- Dismiss completed farm/care work in Team.

Other adds/edits, new assignments and rescheduling keep their existing validation/save flows. Invitations, sign-in, farm switching and membership changes await authoritative results. Permanent horse deletion retains its confirmation flow. These paths were reviewed but not made optimistic in this change.

## Behavior

`src/components/OptimisticTaskRow.tsx` provides page-local state and task keys. Clicking a supported action immediately replaces its row with Completed, Unassigned or Dismissed plus “Saving… Waiting for confirmation.” All duplicate presentations of a care item on the dashboard share the same key and update together. Task mutation forms are disabled during an optimistic change; synchronous ref guards reject repeated submissions before React has rendered the disabled state.

Original children remain mounted but visually hidden during the pending state, preserving inputs and the form's error handler. If the action fails, original content/controls return, and an accessible alert explains: “Could not confirm this change. Previous view restored. Refresh before trying again.” This wording accounts for connection failures where the server may have committed despite a lost response; it does not claim the database was rolled back. No automatic mutation retry was added.

On success, the existing server action invalidation and full reload reconcile task status, recurring dates, workload counts and completion history. The full reload preserves filters in the current URL. Counts reflect confirmed data after reconciliation; pending rows explicitly identify unconfirmed changes.

Team background refresh checks for pending task forms/rows both before its request and before applying its result, avoiding a refresh that discards pending UI. Server-side permissions, farm scoping, conflict detection and duplicate-completion guards are unchanged.

## Verification

- Production build and TypeScript pass.
- `tests/optimistic-tasks.mjs`: headless Chrome against a disposable local SQLite database and production-mode server. Holds action requests before delivery, verifies immediate UI state while database remains unchanged, then releases or rejects requests. Checks duplicate Dashboard views, completion persistence, unassignment and dismissal persistence, visible rollback, restored controls and no browser errors. Fixture farms/users are removed after the run. No production data is used.
- Existing `tests/farm-tasks.mjs` and `tests/care-history.mjs` pass against the disposable server: permissions/isolation, concurrency/replay guards, recurring/one-off histories, snapshots, legacy records, removal cleanup and completion review behavior.
- React review: hooks are unconditional, state is page-local, no new dependency is installed, task keys include task kind, list/article semantics retained, pending state announced with role=status and aria-busy, errors announced with role=alert.

Browser test setup uses Playwright (installed normally or selected via PLAYWRIGHT_MODULE_PATH), optional TEST_CHROME_PATH, TEST_DATABASE_URL=file:/private/tmp/<disposable>.db and TEST_BASE_URL for a local production-mode server. Run with `node tests/optimistic-tasks.mjs` once the matching schema/client and build are prepared.

Changes are local; no push or deployment was performed. Existing dependency-resilience changes and previous audit files were preserved.
