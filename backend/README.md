# Apps Script backend reference

These files are prepared for review and manual installation in the existing Google Apps Script project. GitHub does not deploy them to Apps Script automatically.

## Files prepared

- `Config.gs` — idempotent setup, default administrator bootstrap, and email normalization.
- `Api.gs` — POST-only API entry point, Google ID-token claim checks, role gates, and route-level locking for mutations.
- `Admin.gs` — validation for admin operations, teacher account provisioning, protected class/subject deletion, and guardian contact storage without parent accounts.
- `Teacher.gs` — teacher-only assigned class/subject data and server-side validation of lesson submissions.
- `Store.gs` — Drive-backed JSON storage with corruption and duplicate-file checks plus a script-lock helper.

## Migration procedure

1. Keep the original Apps Script project unchanged. Work in the backup copy first.
2. Confirm the backup of the `AIEM_Data` folder is available.
3. Confirm there is exactly one Drive folder named `AIEM_Data` and no duplicate JSON collection files.
4. In the backup Apps Script project, replace the corresponding source files with the versions in this folder. The files in this folder are reference source; they are not installed or deployed automatically.
5. Ensure the project uses the same `CLIENT_ID` and `INITIAL_ADMIN_EMAIL` values as the existing deployment. Do not change these to guessed values.
6. Run `setup()` only against a test copy of the data first. It is designed to be idempotent and does not intentionally overwrite existing collections.
7. Test administrator login, teacher login, assigned class/subject visibility, lesson submission, and admin create/assign/toggle/delete operations against the test copy.
8. Only after those checks pass should the production project be updated and redeployed as a new Apps Script web-app version. Keep the prior deployment/version available for rollback.

## Locking and data safety

Every API mutation route wraps its complete read-modify-write operation in `withDataLock_()`. Do not add another lock inside those route handlers or inside the called mutation functions; Apps Script script locks are not re-entrant. If you add a new mutation route, lock the entire transaction at the route boundary.

A corrupt JSON file throws an error instead of returning `null`; this prevents a later write from silently replacing damaged data with an empty array. Duplicate Drive folders or same-named JSON files stop execution and require manual consolidation. `write_()` does not acquire a lock itself.

Class and subject deletion is blocked while referenced by students, teachers, or lesson logs. Teacher deletion is blocked when lesson history exists; otherwise the corresponding teacher account is disabled. The last active administrator and the current administrator cannot be disabled.

## Parent portal scope

Guardian contact fields may remain on student records. Parent user provisioning and parent-facing API routes are intentionally excluded from this phase. Existing parent-role records, if any, are not promoted or modified by this code; parent login is not enabled.

## Testing status

These source files are committed to the remediation branch for review. The live Apps Script project and live Drive data have not been changed. The latest backend commit has no reported GitHub Actions run or status check yet, so do not treat this as a passed backend test or a production-ready deployment.
