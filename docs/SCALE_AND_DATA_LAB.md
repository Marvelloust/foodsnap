# FoodSnap Scale, Operations & Data Lab

FoodSnap 1.0.0 now includes a production-hardening layer around the existing scanner, knowledge graph, recipes, community, messaging, planner, shopping and pantry systems.

## Production hardening added

- forward-only numbered SQL migrations under `database/migrations/`
- SQLite WAL mode, foreign keys, busy timeout and targeted indexes
- persistent background jobs with retries/backoff and administrator retry controls
- scheduled recipe/post publishing and reminders
- FTS5-backed food knowledge search with rebuild tooling
- cursor APIs for feed, messages, notifications and indexed search
- shared households for meal plans, shopping lists and pantry stock
- message requests and privacy controls
- saved searches
- recipe URL import through Recipe JSON-LD
- barcode lookup with cache (OpenFoodFacts fallback or custom provider)
- account data export and seven-day deletion grace period
- browser push subscription persistence + external push-gateway contract
- media asset registry + optional external image/video processor
- audit logs for important administrative/user actions
- database backup/restore and integrity scripts
- knowledge revision/localization tables for future editorial workflow
- administrator runtime/queue/search/backup/audit surfaces

## Data Lab

The Data Lab always uses a separate database by default:

`data/foodsnap-lab.sqlite`

It does not write to the normal `data/foodsnap.sqlite` unless you explicitly override `FOODSNAP_DB`.

### Seed profiles

```bash
npm run seed:small
npm run seed:realistic
npm run seed:large
npm run seed:stress
```

The generator is deterministic. Override the seed with:

```bash
FOODSNAP_SEED=12345 npm run seed:large
```

On PowerShell:

```powershell
$env:FOODSNAP_SEED="12345"
npm run seed:large
```

Profiles are intentionally uneven and generate real relationships between users, scans, creator recipes, posts, comments, likes, follows, conversations/messages, collections, meal plans, shopping lists, pantry stock, notifications and moderation reports.

| Profile | Users | Scans | Posts | Comments | Likes | Messages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 100 | 800 | 600 | 1,800 | 6,000 | 3,500 |
| realistic | 2,000 | 18,000 | 12,000 | 40,000 | 120,000 | 100,000 |
| large | 10,000 | 80,000 | 50,000 | 180,000 | 500,000 | 400,000 |
| stress | 50,000 | 500,000 | 250,000 | 900,000 | 2,500,000 | 2,000,000 |

The `stress` profile can consume multiple gigabytes. Use it only when you intentionally want a long-running local stress test.

### Stable synthetic accounts

Every Data Lab account uses:

`Password123!`

Convenient stable users:

- `seed-user@foodsnap.test`
- `seed-creator@foodsnap.test`
- `seed-admin@foodsnap.test`

The seed script refuses to overwrite a database containing non-synthetic users unless `--force` is explicitly supplied.

## Large profile validation

The release build was validated with `seed:large`.

It generated approximately **1.99 million primary activity rows** plus relationship rows, with a SQLite database of about **346 MB** in the release environment.

The same database passed the FoodSnap benchmark suite with sub-millisecond-to-low-millisecond local p95 timings for feed, message, notification, recipe, analytics and FTS knowledge queries in the release environment. Hardware/filesystem performance will vary.

## Performance benchmark

After seeding:

```bash
npm run benchmark
```

The benchmark reports p50/p95 timings for:

- public feed query
- conversation messages
- notifications
- recipes
- personal scan analytics
- FTS searches for common food terms

A p95 above 500 ms is flagged as `SLOW`.

## Integrity checks

Normal database:

```bash
npm run db:integrity
```

Data Lab database on macOS/Linux:

```bash
FOODSNAP_DB=./data/foodsnap-lab.sqlite npm run db:integrity
```

PowerShell:

```powershell
$env:FOODSNAP_DB="$PWD/data/foodsnap-lab.sqlite"
npm run db:integrity
Remove-Item Env:FOODSNAP_DB
```

Checks include foreign-key violations, orphan shopping/message rows, missing knowledge imagery, incomplete recipes, duplicate usernames and stuck background/analysis jobs.

## Search maintenance

```bash
npm run search:rebuild
```

FoodSnap uses SQLite FTS5 for the core food/cuisine/ingredient/recipe knowledge index and keeps account/private search results scoped through normal SQL authorization.

## Background jobs

The application starts an in-process durable job worker for a single-server deployment. Jobs are persisted in SQLite and support retry/backoff.

Run one job manually:

```bash
npm run jobs:once
```

For a multi-instance production deployment, migrate the job interface to Redis/BullMQ or another shared queue while retaining the same job types/handlers.

## Backup / restore

Create a verified SQLite backup:

```bash
npm run db:backup
```

Restore deliberately:

```bash
npm run db:restore -- ./backups/foodsnap-YYYY....sqlite --force
```

The restore tool runs SQLite `integrity_check` before replacing a target database.

## Smoke test

```bash
npm run smoke
```

This starts FoodSnap against a temporary database and verifies public, auth, application, Atlas, Planner, Community and PWA routes.

## Migration strategy

FoodSnap keeps its compatibility helpers for older 1.0.0 databases, but all new scale/operations changes are also recorded as numbered migrations in `database/migrations/` and tracked in `schema_migrations`.

Do not edit an already-applied migration in production. Add a new numbered migration.

## When to move beyond SQLite

SQLite remains excellent for local development, school demonstrations, a single application server and surprisingly large datasets. Move to PostgreSQL when FoodSnap needs multiple application instances or sustained concurrent writes from messaging, community interactions, shared planning and background workers.

A production migration should normally pair PostgreSQL with:

- object storage for uploaded media
- Redis/BullMQ (or equivalent) for shared jobs
- CDN-backed responsive media variants
- external mail/push providers
- centralized logs/error monitoring
