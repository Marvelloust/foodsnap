# FoodSnap 1.0.0 — UX, Mail and Community Pass

This pass preserves the v1.0.0 application architecture and fixes the reported usability issues.

## Search and filters
- Food, Recipe and Explore typing uses debounced API requests and partial DOM updates.
- The application shell, scroll position outside the result area and active input are not recreated per keystroke.
- Searchable select menus use a body-level fixed portal to avoid clipping from horizontal filter bars.

## Mobile navigation
- The five highest-frequency actions stay in the bottom bar: Home, Explore, Scan, Library and Search.
- The top-left menu opens the complete application navigation, including Analytics and account/settings routes.

## Email + in-app notifications
Email events currently include:
- account created / welcome
- onboarding complete
- password reset requested
- password changed
- scan ready (subject to the user's scan notification preference)

Transports:
1. custom FoodSnap mail webhook
2. Resend
3. Brevo
4. console fallback for local development when no external transport is configured

## Likes and comments
Likes/comments are stored in `item_likes` and `comments` and are available on food, recipe and ingredient detail pages. The product does not seed engagement counts. Analytics reports the signed-in user's own contributed likes/comments.
