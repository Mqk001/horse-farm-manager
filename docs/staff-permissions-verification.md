# Farm staff permissions (October 16, 2026)

Permissions use the active FarmMember role, not the account-level User role.
Staff can read their farm, record rides/grooming, and complete scheduled care.
Only MANAGER/SUPER_ADMIN can create/update/delete horses or create/reschedule
care. Existing manager-only team invitations and member lists remain protected.
The UI hides manager controls; API routes and server actions enforce the same
rules independently. Farm membership and cross-farm checks still apply.

Validation:
- Production-only source snapshot and the working checkout both built successfully.
- tests/staff-permissions.mjs exercised real HTTP routes and care server actions
  against a disposable SQLite database: denied staff writes left data unchanged;
  staff reads, ride/groom logging, care completion worked; switching the same
  account to its manager farm restored horse CRUD and care scheduling/rescheduling.
- Browser login with a disposable fixture confirmed staff controls were hidden,
  activity buttons remained, and manager controls returned after switching farms.
- No hosted database migration or test account provisioning was required.

Test requires a built app running against a disposable SQLite database and a
matching AUTH_SECRET beginning with reinwell-disposable-. Pass TEST_DATABASE_URL
(file:/private/tmp/...) and optionally TEST_BASE_URL. It seeds only that database.
