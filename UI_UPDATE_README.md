# FoodSnap v1.0.0 — UI Continuity Update

This archive contains only files changed or added for the September UI/continuity repair. Apply it over `FoodSnap-Final-v1.0.0-Audited`.

## Apply

1. Stop FoodSnap with `Ctrl + C`.
2. Extract this ZIP into the FoodSnap project root.
3. Allow Windows to overwrite matching files and create the new migration/script files.
4. Run `npm start`.

No dependency change is required. Migration `008_export_formats.sql` is applied automatically on startup and preserves existing data.

## Data Lab

The seeded demo now guarantees visible follow/follower activity and working conversations for the stable accounts.

The easiest Windows-friendly command is:

```powershell
npm run lab:small
```

That seeds `data\foodsnap-lab.sqlite` and starts FoodSnap against that same database automatically.

Stable accounts use password `Password123!`:

- `seed-user@foodsnap.test`
- `seed-creator@foodsnap.test`
- `seed-admin@foodsnap.test`

You can also use:

```powershell
npm run lab:realistic
npm run lab:large
```

## Main fixes

- compact Feed comment previews with full comments in a FoodSnap modal
- broader Community composer for general posts/questions, recipes, scans, collections and cuisines
- desktop Week planner no longer causes the incorrect horizontal layout
- Calendar is now a real month grid with month navigation
- sidebar scroll/active-link position persists between routes
- exports are compact and support JSON, CSV, PDF and Word
- message discovery/search/recommendations and `@username` handling
- stable seeded conversations and community relationships
- own Profile now shows followers/following and engagement counts/lists
- native browser confirm/prompt dialogs replaced with FoodSnap dialogs

## Verification

The updated project passes 31 integration/regression tests. A fresh `seed:small` produces 20,206 counted rows with zero integrity violations.
