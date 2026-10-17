# Team task delegation — October 17, 2026

Managers and owners now have a Team tasks panel at the top of Team. They can schedule new care with an assignee, assign/reassign existing scheduled care, review each active member's full scheduled workload, and unassign care. Staff receives assignments through the existing My tasks dashboard. Care schedule retains its scheduling/assignment controls.

The shared ScheduleCareDialog preserves the existing care fields and server actions. Care mutations revalidate Team as well as care/dashboard/horse views. Scheduling reloads the saved page to avoid stale member workloads observed during browser verification. No schema changes or new permissions are introduced.

Validation: production build/type checks and git diff --check passed. Expanded care-history HTTP suite passed against disposable local SQLite: Team creation and assignment/reassignment/unassignment, staff denial, foreign-farm rejection, manager/staff rendering, dashboard assignment visibility, and existing completion/history/concurrency coverage. Local browser verified Team scheduling to staff and reassignment to manager, refreshed workload lists, and no recorded console warnings/errors. Production data and invitations were not changed for tests.

Production: code commit 69285e1f39e3c587ffa8a0f4ddb10c1834002737 deployed as dpl_FqDPtVRKkYdArr36N9E42FqoXLBj, READY with getreinwell.com assigned and no alias error. Live login returned 200; anonymous Team redirected to login. Runtime error scan returned no matching logs. Authenticated production mutation checks were not run because no production session was available; successful delegation flows were verified locally.
