# Team completion review, alignment, and loading — October 17, 2026

Farm selection now uses neutral workspace copy while fetching farms, avoiding the misleading setup heading for existing farms. The global route fallback uses a delayed skeleton instead of a loading card; the navigation status is also delayed to avoid flashes on quick changes. Recovery links remain available for slow navigation.

Team tasks/member panels align within matching cards, member identity and role badge share a row, task actions use grid alignment, and role controls wrap predictably on narrower panels.

Completed farm tasks and care completion snapshots appear in a visible Completed work section, with completion attribution/date and manager-only Dismiss. Dismiss sets dismissedAt and preserves all task/history data. Open farm assignments exclude completed tasks. Recurring care keeps the next occurrence assigned, explicitly labeled Next scheduled after a completion.

The Team revision endpoint requires an active selected-farm manager and returns only a hash of farm-scoped task/care/member changes. Visible Team pages poll every 15 seconds and check on focus/visibility; they reload only on a changed revision (or lost access), skipping active form editing and access confirmations. A browser test found soft router refresh stale, so changed-data reload was used and then verified with an external local completion.

Migration task_completion_review applied only two nullable dismissedAt columns to hosted FarmTask and CareCompletion. Supabase SQL confirmed both columns. Existing RLS/grants remain unchanged. Security advisors retain only the previously documented INFO for server-owned FarmTask without a public policy.

Validation: production build/type checks; expanded farm-task HTTP tests for staff/foreign/open-task dismissal denial, successful farm/care dismissal, completion-history preservation, revision endpoint anonymous/staff rejection and hash changes; existing care-history and Team permission/concurrency suites passed against disposable SQLite. Browser manager sign-in/navigation, dismiss completion, automatic completion refresh and layout were checked locally. No production fixtures or successful production mutations were used.
