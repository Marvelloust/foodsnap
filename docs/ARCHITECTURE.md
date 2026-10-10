# Architecture

FoodSnap is a modular monolith intended for a single application deployment with clear service boundaries.

```text
Browser
  ↓
Node.js HTTP application
  ├── Identity + sessions + recovery
  ├── Scan orchestration
  ├── Food knowledge
  ├── Search + Saved + Library
  ├── FoodSnap Intelligence
  └── Profile + preferences + notifications
       ↓
SQLite
       ↓
Provider adapters
  ├── Vision / OCR
  ├── Open-ended assistant
  └── Transactional mail
```

## Why a modular monolith

The product has a connected domain model and benefits from transactional relational updates. Splitting every feature into separate network services would increase operational complexity without improving the early product.

## Persistent analysis jobs

Creating a scan writes:

- the scan record
- one or more scan-media rows
- an `analysis_jobs` row
- the initial scan event

A worker loop claims queued jobs. The user's scan therefore exists independently of a front-end page or in-memory state.

## Result normalization

External provider output is normalized in `services/intelligence.js` before it enters the database. The browser never renders an arbitrary provider payload directly.

## Knowledge retrieval

Provider output is enriched against FoodSnap's own food, ingredient and recipe data. Matched knowledge remains separate from provider inference so the interface can explain provenance.

## Ask FoodSnap

Questions are scoped to a specific scan. Common factual intents (identification, ingredients, confidence, related foods and recipes) are answered deterministically from the stored scan context. Questions outside that set are sent to the assistant provider with a normalized scan context and recent thread history.

## Authentication

Sessions are persisted in SQLite. The browser receives only the random session token in an HttpOnly cookie. Each session also contains a CSRF token returned to the authenticated application and required for state-changing requests.

## Anonymous scanner

The public scanner uses a separate HttpOnly guest identifier. Public scans are owner-scoped to that guest cookie. When the visitor signs up or signs in, matching public scans are claimed into the authenticated account.

## Deployment scaling path

For a multi-instance deployment:

1. move SQLite to PostgreSQL
2. move uploads to object storage
3. move analysis jobs to a durable queue such as Redis-backed work queues or a managed queue
4. keep the provider contracts and normalized result model unchanged

## Definitive merge additions

The v1.0.0 consolidation extends the canonical architecture without introducing parallel systems.

### Protected media

Personal scan media is no longer exposed through a public static uploads directory. Scan views return authenticated media URLs (`/api/media/:id`). The server resolves the actual stored file only after checking the owning user or guest identity. Explicit public share links use token-scoped media routes.

Analysis workers and retention cleanup query raw media storage paths internally, so provider processing and file deletion do not depend on user-facing API URLs.

### Personal continuity

The unified schema adds:

- `recent_views` for continue-exploring flows
- `collections` and `collection_items` for user-defined archive organization
- `share_links` for explicit public scan/food/recipe sharing

These extend the existing Saved and Library-tag systems rather than replacing them.

### Unified provider strategy

The normalized FoodSnap HTTP contracts remain the preferred abstraction. A direct OpenAI adapter from the second branch is retained underneath the same service interface. This preserves provider independence while allowing a simpler single-key deployment where desired.
