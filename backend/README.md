# Apps Script backend reference

These files are intended to be copied into the existing Google Apps Script project only after review and backup. They are not deployed automatically by GitHub Pages.

## Storage migration

`Store.gs` provides stricter Drive-backed JSON storage. Before replacing the live file:

1. Make a copy of the entire `AIEM_Data` Drive folder.
2. Confirm there is exactly one folder named `AIEM_Data` and one JSON file per collection.
3. Replace the existing storage helpers.
4. Update API routing so every operation that performs a read-modify-write is wrapped by `withDataLock_(function () { return ...; })`. This includes admin create/assign/toggle/delete actions, teacher log submission, setup, and any future collection mutations. Do not wrap nested calls twice; the script lock is not re-entrant.
5. Test with a copy of the data before using the live folder.

## Important

- A corrupt JSON file now throws an error instead of returning `null`. This is intentional: it prevents accidental overwriting of damaged data with an empty array.
- Duplicate Drive folders or same-named JSON files now stop execution and require manual consolidation.
- `write_()` itself does not acquire a lock. Lock the entire read-modify-write transaction at the API route boundary, not only the final write.
- The parent portal is a later phase. Keep guardian contact fields on student records if needed, but do not create parent login accounts or expose parent-data routes in this phase.
- This source is a reviewed reference in GitHub; it is not yet installed in or deployed from the live Apps Script project.
