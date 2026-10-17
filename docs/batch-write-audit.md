# Batch write audit

Scope: application source, Prisma seed and SQL migrations, Supabase migrations, and operational scripts. Test fixture setup is not a production write path. No production data was changed and the destructive seed was not executed.

## Findings

No input-sized loop of individual INSERT/UPDATE calls was found in application code. The app currently handles individual horses, care completions, activities, assignments, and invitations; it exposes no large import or bulk-edit flow requiring chunked writes.

| Site | Behavior | Disposition |
| --- | --- | --- |
| src/lib/team-management.ts, changeFarmMember | Pending invitations invalidated with updateMany; incomplete tasks and care assignments cleared with updateMany. All access changes in one transaction, farm write lock acquired before authorization checks. | Already set-based: one update per affected table, independent of row count. Preserve transaction and farm scoping. |
| prisma/migrations/20261014000000_care_history_assignments/migration.sql | Legacy history backfill uses INSERT INTO … SELECT within migration transaction. | Already bulk insertion. Do not rewrite an applied migration. |
| src/app/api/auth/forgot-password/route.ts | Fixed two-element loop invokes account and IP rate-limit checks/updates, stopping when a limit is reached. | Bounded security logic, not a bulk workload. Batching would change early-exit behavior; retain. |
| src/lib/login-rate-limit.ts | Each call reads one counter and writes one counter in a transaction. | Single-key operation; no row loop. Concurrency correctness of counters is a separate concern, not established by this batching audit. |
| src/app/care/actions.ts, completeCareItem | Conditional legacy completion insert followed by current completion insert; maximum two records. Guarded schedule update and history writes share a transaction. | Bounded compatibility path, not a large write loop. Retain schedule conflict check and historical snapshots. |
| prisma/seed.ts | Two user creates, two horse creates, one trainer, one settings record, plus set-based deletes. No variable-size loop. | Fixed demo setup, outside request path. No claim of meaningful application speedup from batching two rows; left unchanged and not executed. |
| src/app/api/auth/signup/route.ts | User create followed by verification token create; token depends on generated user ID. | Single signup, not row-by-row bulk creation. |
| src/lib/password-reset.ts and verify-email route | Token consumption, guarded user update, and token cleanup in transactions. | Ordered, dependent operations; preserve single-use and session-version checks. |
| src/app/api/invitations/accept/route.ts | Farm lock, guarded invitation consumption, conditional membership upsert in a transaction. | Ordered authorization/state transition, not a bulk-write loop. |
| Other routes/actions | One logical ride, grooming log, horse, task, assignment, or farm per request; farm creation uses nested membership creation. | No collection of independent rows to batch. |

Other loops/maps in application source render UI, group in-memory results, validate payloads, or invalidate cached pages; they do not perform database writes. Operational process-policy scripts do not write database rows. Supabase migration procedural blocks configure privileges/policies rather than loop over application rows.

## Outcome and verification limits

No runtime code was changed. No chunking helper or database-specific raw SQL was introduced without a caller that needs it. Existing set-based cleanup predicates avoid an oversized list of client-side IDs.

This is a source audit, not a benchmark: there is no before/after implementation to compare, so no timing or round-trip improvement is claimed. Existing transaction boundaries were inspected but this audit does not certify every concurrency behavior or large-table lock duration. Future bulk import/edit features should use bounded multi-row batches with measured statement sizes and transaction durations.
