# FoodSnap — Complete Food Intelligence Platform

**See food. Understand more. Follow the trail.**

FoodSnap is a full-stack food intelligence and discovery application built with Node.js and SQLite. This repository is the consolidated FoodSnap 1.0.0 platform: food intelligence, global knowledge, Recipe Studio, Community, Messaging, Meal Planning, Shopping, Pantry and personal food memory, with production-hardening and deterministic large-data testing built in.

The core loop is:

**scan → understand → inspect components → explore food/ingredients/cuisines → discover recipes → ask FoodSnap → save/organize → return through Library, History and Recently Viewed**


## v1.0.0 interface and stability pass

This package includes the final UI/stability fixes requested for the 1.0.0 release:

- sign-in/auth screens constrained to a single responsive viewport
- responsive auth artwork sizing
- refined small-text scale and 20px eyebrow spacing
- corrected button contrast in dark mode
- dedicated Cook Mode colors in light and dark themes
- Cook Mode can be closed and reopened without refreshing
- action handling prioritizes single-click controls over parent navigation
- searchable long select fields
- search/filter controls stay on one horizontal line
- authenticated public navigation shows **Open dashboard**
- Discovery Graph uses an accessible, non-overlapping relationship layout
- compatibility support for legacy graph identifiers such as `food-17` and `recipe-13`
- back-to-top control
- visible sidebar/content divider
- user Analytics page based only on real FoodSnap activity
- application/version metadata normalized to **1.0.0**

## Scale and operations update

The current build also includes durable background jobs, numbered migrations, SQLite WAL/index hardening, FTS5 knowledge search, cursor pagination, shared household planning, saved searches, reminders, recipe URL import, barcode lookup, account export/deletion controls, backup/restore, audit logging, optional media/push provider contracts and the FoodSnap Data Lab.

Useful commands:

```bash
npm run seed:small
npm run seed:realistic
npm run seed:large
npm run seed:stress
npm run benchmark
npm run db:integrity
npm run db:backup
npm run smoke
```

The Data Lab uses `data/foodsnap-lab.sqlite` by default so synthetic load data does not pollute the normal application database. See `docs/SCALE_AND_DATA_LAB.md`.

## Requirements

- Node.js **22.5+ recommended** (uses built-in `node:sqlite`)
- Node.js **20.19+ supported** after `npm install` installs the optional `better-sqlite3` adapter
- A modern browser
- For arbitrary image recognition: either a FoodSnap-compatible vision/OCR endpoint or an OpenAI API key
- Optional conversational provider for open-ended FoodSnap Intelligence questions
- Optional transactional mail webhook for password recovery

On Node.js 22.5+, FoodSnap has no required third-party runtime dependencies and uses Node's built-in HTTP, crypto and SQLite capabilities. On Node.js 20.19–22.4, run `npm install` once so the optional `better-sqlite3` compatibility adapter is available.

## Start

```bash
npm start
```

Open:

```text
http://localhost:3050
```

Windows users can also run `run-foodsnap.bat`.

FoodSnap automatically creates `data/foodsnap.sqlite` and seeds product knowledge only. Personal accounts and scan history are created through normal user actions.

Reset local runtime data:

```bash
npm run reset
```

Run the integration suite:

```bash
npm test
```

## Environment

Copy `.env.example` to `.env`. **Never ship `.env`, runtime databases, backups, exports or uploaded media inside a source release.**

### Provider option A — normalized FoodSnap vision/OCR endpoint

```text
FOODSNAP_VISION_ENDPOINT=https://provider.example/analyze
FOODSNAP_VISION_TOKEN=...
```

### Provider option B — direct OpenAI adapter

```text
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-5.6-luna
OPENAI_ASSISTANT_MODEL=gpt-5.6-luna
```

If both a normalized endpoint and an OpenAI key are supplied, the FoodSnap endpoint takes precedence. See `docs/AI_PROVIDERS.md` for the normalized result contract.

### Optional assistant endpoint

```text
FOODSNAP_ASSISTANT_ENDPOINT=https://provider.example/ask
FOODSNAP_ASSISTANT_TOKEN=...
```

FoodSnap first answers questions that can be grounded directly in persisted scan evidence and food knowledge. Open-ended questions can be delegated to the configured assistant provider.

### Password recovery mail

```text
FOODSNAP_MAIL_ENDPOINT=https://mail.example/send
FOODSNAP_MAIL_TOKEN=...
```

The transport receives JSON with `to`, `subject`, `text` and `html`.

### Optional first administrator

```text
FOODSNAP_ADMIN_EMAIL=admin@example.com
FOODSNAP_ADMIN_PASSWORD=use-a-strong-password
FOODSNAP_ADMIN_NAME=FoodSnap Admin
FOODSNAP_ADMIN_USERNAME=foodsnap-admin
```

The bootstrap occurs only when that email does not already exist.

## Product map

### Public

- `/` — product home with a scanner entry using the same scanning system as the application
- `/how-it-works`
- `/intelligence`
- `/discover`
- `/about`
- `/share/:token` — public share view for explicitly shared discoveries
- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/forgot-password`

### Authenticated application

- `/app` — FoodSnap overview
- `/app/scan` — upload, drag/drop, paste or camera capture
- `/app/explore` — food, ingredients, cuisines and editorial discovery
- `/app/foods` — food catalogue with cuisine/category filtering
- `/app/foods/:slug` — food detail + discovery graph
- `/app/cuisines/:slug` — cuisine exploration
- `/app/compare` — side-by-side food comparison
- `/app/ingredients`
- `/app/ingredients/:slug`
- `/app/recipes`
- `/app/recipes/:slug` — recipe detail + Cook Mode
- `/app/library` — personal visual archive + Smart Collections + custom collections
- `/app/history`
- `/app/saved`
- `/app/search`
- `/app/intelligence` — contextual FoodSnap Intelligence workspace
- `/app/scans/:id` — deep scan result with provenance, OCR, detections and follow-up questions
- `/app/profile`
- `/app/settings`

## Scanner and intelligence pipeline

FoodSnap treats analysis as a persisted job, not a front-end loading illusion:

```text
input
  ↓
media validation
  ↓
vision + OCR provider
  ↓
food detection
  ↓
component detection
  ↓
context classification
  ↓
FoodSnap knowledge retrieval
  ↓
result synthesis
  ↓
confidence + uncertainty
  ↓
FoodSnap result
```

The database stores scan media, analysis events, bounding detections, OCR text, linked ingredients, allergen evidence and food knowledge matches separately.

### Transparency model

Result information is presented with provenance:

- **Detected** — visually identified evidence
- **Extracted** — text read from the media
- **Inferred** — contextual inference
- **Matched** — information joined to FoodSnap's structured knowledge

Uncertainty is preserved instead of converting every observation into false certainty.

## International food knowledge

The v1.0.0 catalogue initializes with **49 cuisine paths, 95 foods, 51 ingredients and 27 recipes**. Food knowledge is connected through cuisine, ingredient and related-food relationships rather than existing as isolated records.

Country-level discovery includes Nigerian, Ghanaian, Senegalese, Ivorian, Ethiopian, Kenyan, Moroccan, Egyptian, South African, Tanzanian, Japanese, Korean, Chinese, Indian, Thai, Vietnamese, Indonesian, Filipino, Malaysian, Italian, French, Spanish, Greek, Portuguese, German, Turkish, Polish, Nordic, Lebanese, Jordanian, Persian, Iraqi, Gulf Arabian, Mexican, Brazilian, Peruvian, Argentine, United States and Canadian paths alongside broader regional knowledge.

Curated discovery pathways include West African Staples, Street Food Around the World, Rice Dishes, Foods of the Mediterranean, Japanese Comfort Food, Global Breakfasts, Plant-Based Classics, Spiced & Aromatic and Celebration Foods.

Real food photography is used throughout knowledge and recipe surfaces, while bundled local assets remain available as resilient fallbacks.

## Personal memory and organization

Users can:

- reopen scan history
- favourite scans
- save foods, recipes and ingredients
- create Library tags
- create custom collections
- add scans to collections from the Organize flow
- browse collection contents
- view automatically derived Smart Collections
- continue from Recently Viewed items
- create explicit share links for scans, foods and recipes

Personal scan media is served through authenticated media routes rather than a public uploads directory. Explicit share links provide separately authorized public media access.

## Design system

The v1.0.0 polish pass keeps the information-dense product shell while making the product less dashboard-like and more purpose-built for food exploration. Overview is organized around a primary scan workspace, recent food memory, continuation trails, cuisine journey, discovery, ingredients and saved recipes rather than a row of generic KPI cards.

Typography uses **Instrument Sans** for the interface, **Newsreader** selectively for editorial identity, and **IBM Plex Mono** for scan IDs and technical metadata. Heading sizes are intentionally controlled inside the application.

Dark mode has its own tonal hierarchy instead of being an inverted light theme: deep ink background, distinct primary/elevated surfaces, restrained borders and slightly controlled food-image luminance.

Core palette:

- Deep Ink `#10191A`
- Porcelain `#F3F5F1`
- Petrol `#123D3D`
- Burnt Tomato `#C94B37`
- Saffron `#D6A32B`
- Cobalt `#315B98`

Typography combines controlled sans-serif product text with a restrained editorial display face. Large food imagery is used selectively rather than turning every screen into a marketing composition.

Signature interaction families include scanning/detection lock-on, contextual bounding-region focus, food knowledge graph motion, image continuity, camera capture, Cook Mode, Library reorganization and reduced-motion alternatives.


## v1.0.0 polish highlights

- redesigned FoodSnap Overview without the conventional four-stat-card dashboard pattern
- refined typography scale, spacing, control sizing and information density
- rebalanced light and dark theme tokens with stronger dark-mode contrast
- expanded international catalogue and country-level cuisine exploration
- regional Explore navigation and curated discovery collections
- richer food, cuisine, ingredient and recipe relationship pages
- improved Food Library filtering for meals, menus/labels, multi-item scenes and favourites
- six-stage scanner language: Capture → Analyze → Read text → Detect → Connect → Discover
- Recently Viewed, Food Journey, Smart Collections, custom collections and Food Comparison preserved and integrated
- responsive layouts tuned across compact mobile, tablet and large desktop ranges

See `docs/POLISH_UPGRADE.md` for the acceptance checklist used during this pass.

## Security

The unified application includes:

- scrypt password hashing with random salts
- persisted expiring sessions
- HttpOnly / SameSite cookies
- CSRF protection for authenticated mutations
- server-side authorization and account isolation
- time-limited hashed password-reset tokens
- request throttling
- request/body limits
- file-size and image-signature validation
- randomized stored filenames
- protected personal scan media
- common HTTP security headers

See `docs/SECURITY.md`.

## Database

The application uses one relational SQLite database. Major domains include:

- identity: users, sessions, password recovery, preferences
- knowledge: cuisines, foods, ingredients, recipes and relationship tables
- scanning: scans, media, analysis jobs/events, detections, OCR, ingredients, allergens, food matches
- intelligence: assistant threads/messages
- personal memory: saved items, tags, custom collections, recent views, search history, notifications, activity
- sharing: explicit share links
- creator cooking: personal recipes, recipe media/versions, ratings and cooking journal
- community: food posts, post media, post likes/comments and creator activity
- messaging: conversations, members and FoodSnap-aware messages
- planning: meal plans and dated meal-plan entries
- shopping + pantry: shopping lists/items, generated groceries and pantry inventory

The generated schema is stored in `database/schema.sql`.

## Verification

The complete FoodSnap integration suite contains **26 passing tests** covering:

1. public knowledge / clean identity state
2. registration, onboarding, settings and account isolation
3. provider-backed scanning, OCR, detections and contextual Intelligence
4. merged cuisines, knowledge and Food Comparison
5. password recovery and transactional email
6. compatibility routes and Analytics
7. welcome/onboarding notifications and engagement
8. shared-scan community history
9. scan corrections, personal notes, visual discovery and Discovery Trails
10. public profiles, follows, blocks and moderation
11. collaborative collections and public sharing
12. Admin Studio and provider operations
13. PWA/product-depth routes
14. Recipe Studio, media, versions, ratings and Cooking Journal
15. Community Feed and Messages
16. Meal Planner → Shopping List → Pantry integration
17. expanded Cook/Plan/Community route surfaces
18. household planning/shopping/pantry isolation
19. saved searches, message requests and cursor pagination
20. account exports, jobs and administrative audit/scale endpoints
21. scheduled-content privacy and private creator-media authorization
22. per-user message deletion
23. share-link listing and revocation
24. household invite pause/rotation/transfer/leave lifecycle
25. knowledge provenance, Atlas hierarchy and FTS-backed personal search
26. frontend audit contracts for critical helpers and accessible dialogs

Run:

```bash
npm test
```

See `docs/PLATFORM_EXPANSION.md` for the connected Recipe/Community/Planning/Shopping architecture.

## Merge record

`docs/MERGE_AUDIT.md` documents what each original branch contributed, which implementation became canonical, what was migrated, what was repaired and what was added in the upgrade pass.

Additional documentation:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/AI_PROVIDERS.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/QA.md`

## Production evolution

The included build is a complete single-server application suitable for local use and a single Node deployment. For production, run the web process and `npm run worker` as separate processes so scheduled publishing, reminders, exports and background work remain independent of HTTP traffic. SQLite/WAL is suitable for a single-host deployment; for horizontal scale, migrate to PostgreSQL/object storage and a shared event/queue transport as described in `docs/DEPLOYMENT.md`.

## UX, email and community stabilization

The 1.0.0 release also includes the following product fixes and additions:

- live Food / Recipe / Explore filtering updates only the results region; typing no longer rebuilds the entire application shell
- searchable select menus are rendered in a viewport-level portal so they remain visible inside filter bars, drawers and modals
- mobile bottom navigation has stronger icon/text contrast and a complete slide-out navigation drawer for Analytics, History, Saved, Foods, Recipes, Ingredients, Intelligence, Profile and Settings
- persisted likes and comments on foods, recipes and ingredients; engagement is never seeded with invented counts
- Analytics includes real likes/comments contributed by the signed-in user
- welcome, onboarding-complete, password-reset, password-changed and scan-ready email events use the same transactional mail service as in-app notifications
- direct Resend and Brevo transactional email adapters are available in addition to the generic webhook transport
- direct Google Gemini vision/assistant support is available as an alternative provider after custom endpoints and OpenAI

### Real transactional email

Choose one mail method. The precedence is: `FOODSNAP_MAIL_ENDPOINT` → `RESEND_API_KEY` → `BREVO_API_KEY` → local console fallback.

Resend example:

```env
RESEND_API_KEY=re_...
FOODSNAP_FROM_EMAIL=FoodSnap <hello@your-verified-domain.com>
FOODSNAP_FROM_NAME=FoodSnap
```

Brevo example:

```env
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=hello@your-verified-domain.com
BREVO_SENDER_NAME=FoodSnap
```

Use a sender/domain verified with the provider. When a real transport is configured, `/api/health` exposes the selected mail transport and emails are tracked in `email_events`.

### Gemini alternative

```env
GEMINI_API_KEY=...
GEMINI_VISION_MODEL=gemini-3.1-flash-lite
GEMINI_ASSISTANT_MODEL=gemini-3.1-flash-lite
```

Provider precedence for analysis is: custom FoodSnap endpoint → OpenAI → Gemini. FoodSnap never fabricates an analysis if none of those is available.

## Community + navigation + analytics stabilization

This 1.0.0 build includes an upgrade-safe migration path for existing FoodSnap databases. Older sessions are assigned CSRF tokens automatically so signed-in users can use Likes, comments, saves and other mutation actions without resetting their account or database.

Additional UI refinements include:
- desktop sidebar with an independently scrollable navigation region and always-visible account block;
- larger vector icons and clearer labels in the mobile navigation;
- resilient community controls that remain usable even while community counts are refreshing;
- redesigned analytics built around food-memory rhythm, scan mix, cuisine and ingredient trails, saved content, community contribution and recent activity.
