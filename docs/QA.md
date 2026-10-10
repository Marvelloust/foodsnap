# FoodSnap QA coverage

## Automated integration suite

The current hardening release contains **26 passing integration/regression tests**. The suite covers identity/account isolation, scanner persistence, provider adapters, private media, sharing, knowledge/cuisines/comparison, mail recovery, analytics, engagement, corrections/trails, profiles/follows/blocks, collaborative collections, admin operations, PWA routes, Recipe Studio, Feed/Messages, Planner/Shopping/Pantry, households, saved searches, cursor pagination, exports/jobs/audit, scheduled-content privacy, per-user message deletion, share-link revocation, household lifecycle, knowledge provenance/Atlas/FTS, and frontend audit contracts.

Run:

```bash
npm test
```

Expected:

```text
43 tests
26 passed
0 failed
```

## Release checks

Run the complete local release gate:

```bash
npm run release:check
```

It performs JavaScript syntax validation, the 26-test integration suite, a deterministic `seed:small` build against a temporary database, integrity validation, HTTP route smoke tests, and a Chromium interaction smoke test when the execution environment permits local browser URLs. If enterprise browser policy blocks localhost in Chromium, the browser portion reports an explicit skip; set `FOODSNAP_BROWSER_REQUIRED=1` to make that condition fail CI.

## Browser/interaction checks

The Chromium smoke covers, when permitted:

- Cuisine Atlas at desktop and 390px with page-level overflow detection
- Edit Shopping List opening the real edit modal
- modal `role=dialog` / `aria-modal` enhancement
- Meal Planner primary controls
- Messages workspace rendering
- dark-mode overflow sanity

The integration suite also contains static frontend contracts so missing functions such as the former `openEditShoppingList` regression fail even when a headless browser is unavailable.

## Data Lab integrity

`seed:small`, `seed:realistic`, `seed:large` and `seed:stress` use deterministic relationships. `npm run db:integrity` checks foreign keys, polymorphic saved/collection links, orphan jobs/messages/shopping rows and media-registry consistency.


## Final maturity coverage

The current 43-test suite additionally covers group-chat lifecycle and roles, message reactions/replies, complete ZIP+media account exports, media moderation privacy, final messaging composer/search UI contracts, realtime synchronization, scheduled-content privacy, Data Lab integrity, household lifecycle and deep-linked Food Stories.
