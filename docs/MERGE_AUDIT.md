# FoodSnap Definitive Merge Audit

This document records the consolidation of the two supplied FoodSnap branches into the v1.0.0 definitive product. It exists to make feature preservation explicit rather than relying on visual similarity.

## Source branches

### Branch A — production/deep architecture branch

Strongest areas:

- relational SQLite domain model
- persisted analysis job/event pipeline
- anonymous public scanner and scan claiming
- CSRF-protected authenticated mutations
- persistent password-reset architecture with mail transport
- richer scan provenance and uncertainty model
- discovery graph
- Library tags
- contextual FoodSnap Intelligence
- broader authenticated settings/profile/data controls
- stronger account isolation and authorization
- deeper public/application route architecture

### Branch B — direct-provider/media/camera branch

Strongest areas:

- direct OpenAI Responses API adapter
- true browser camera capture using `getUserMedia`
- in-database/protected media philosophy
- simpler direct image-analysis provider mapping
- broader global starter food catalogue
- stronger use of food photography
- dedicated Foods/Search page patterns
- alternate dashboard and browsing ideas

## Canonical architecture decisions

| Product area | Final decision |
|---|---|
| Server architecture | Branch A modular monolith retained as the spine |
| Database | One relational SQLite database; Branch A model extended rather than running both stores |
| Authentication | Branch A persisted sessions + CSRF retained |
| Password handling | scrypt + random salt retained |
| Password recovery | Branch A time-limited token + configurable mail transport retained |
| Vision provider | Branch A normalized provider contract retained; Branch B direct OpenAI adapter added as a second provider path |
| Assistant | Branch A contextual assistant retained; Branch B direct OpenAI path added for open-ended reasoning |
| Scanner | Branch A staged persisted jobs + Branch B true camera capture merged |
| Media | Personal scan media changed to authenticated/protected delivery; explicit share routes authorize public access |
| Navigation | One compact canonical application shell; Foods, Search and Intelligence are first-class routes |
| Design | Branch A's denser product shell refined with Branch B's stronger photography/camera ideas |
| Food knowledge | Branch A relationship model retained and expanded with Branch B's broader catalogue and image sources |

## Feature preservation checklist

### Public product

- Branch A public landing → **preserved and improved**
- Branch A real anonymous scanner entry → **preserved**
- Branch A How It Works / Intelligence / Discover → **preserved**
- Product story/About → **added as canonical public route**
- Branch B food imagery approach → **merged into canonical public/product imagery**
- Marketing-only fake scanner → **not used; public scanner uses the real scan backend**

### Authentication and identity

- Branch A registration/sign-in/sign-out → **preserved**
- Branch A onboarding/preferences → **preserved**
- Branch A persisted server sessions → **preserved**
- Branch A CSRF → **preserved**
- Branch A forgot/reset password mail architecture → **preserved**
- Branch B signed-session simplicity → **not duplicated because the persisted session implementation gives stronger revocation/account control**

### Scanner and AI

- Branch A multi-stage persisted analysis pipeline → **preserved**
- Branch A analysis jobs/events → **preserved**
- Branch A OCR/provenance/uncertainty → **preserved**
- Branch A multi-item detections/bounding boxes → **preserved and motion-refined**
- Branch B direct OpenAI adapter → **merged**
- Branch B true camera capture → **merged**
- Upload/drag/drop/paste → **preserved**
- Multi-image support → **preserved**
- Retry/error states → **preserved**
- Contextual Ask FoodSnap → **preserved and surfaced as a dedicated Intelligence workspace**

### Food knowledge/discovery

- Branch A foods/ingredients/recipes/cuisines → **preserved**
- Branch A relationship graph → **preserved**
- Branch B broader food/ingredient/recipe catalogue → **merged into canonical schema**
- Branch B food photography URLs → **merged where they improve the existing catalogue**
- Dedicated Foods browse → **added using Branch B route pattern and Branch A data model**
- Cuisine pages → **added in upgrade pass**
- Food Comparison → **added in upgrade pass**
- Recently Viewed → **added in upgrade pass**

### Library/history/saved

- Branch A scan history → **preserved**
- Branch A favourites → **preserved**
- Branch A saved foods/recipes/ingredients → **preserved**
- Branch A Library tags → **preserved**
- Smart Collections → **added**
- User custom collections → **added with create, populate and browse flows**
- Recently Viewed continuation → **added**

### Search

- Branch A global search API/modal → **preserved**
- Branch B dedicated Search page pattern → **merged**
- Recent searches → **preserved**
- Cross-domain food/ingredient/recipe/private-scan results → **preserved and surfaced in canonical page**

### Recipes

- Branch A recipe data and details → **preserved**
- Cook Mode → **preserved**
- Branch B recipe content → **merged where broader than A**
- Recipe navigation from scan/food/ingredient relationships → **preserved**

### Profile/settings/privacy

- Branch A profile/preferences/theme/notification/privacy controls → **preserved**
- Light/dark/system preference → **preserved**
- Account-scoped data → **preserved**
- Scan retention/deletion architecture → **preserved**

### Sharing and media

- Branch B protected-media direction → **merged and strengthened**
- Personal scan media public static serving → **removed**
- Authenticated `/api/media/:id` → **added**
- Shareable food result → **added through explicit random share links**
- Shared scan media → **separately authorized by share token**

## Broken/incomplete behaviour repaired during merge

- Old/new frontend API incompatibility was eliminated by using one canonical frontend/server route surface.
- Analysis job processing was updated after protected media URLs were introduced so workers still read raw local media paths internally.
- Retention cleanup was updated to remove raw stored files rather than API URLs.
- Initial custom-collection schema migration was corrected so tables are created in clean databases.
- Custom collections were completed at the UI level: users can create them, add scans through Organize and reopen the resulting collection.
- User-facing product copy was checked for development/demo vocabulary.

## Product upgrade pass

Features added beyond either branch's complete original surface:

- Food Comparison
- cuisine detail pages
- Recently Viewed continuity
- Smart Collections
- user custom collections
- explicit shareable scan/food/recipe links
- protected personal scan-media delivery
- public shared-media authorization
- dedicated FoodSnap Intelligence route
- dedicated Search route
- merged provider precedence supporting either a normalized FoodSnap endpoint or direct OpenAI configuration

## One-product rule

The final repository does **not** contain selectable A/B versions, parallel databases, duplicate scanners, duplicate dashboards, duplicate search systems or separate navigation schemes. All routes and data converge on the v1.0.0 canonical server/database/application shell.
