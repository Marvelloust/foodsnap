# FoodSnap Product Depth Upgrade

This overlay expands the verified FoodSnap 1.0.0 build without replacing its existing product architecture.

## Intelligence and personal memory

- Scan result correction with user-confirmed food matches or custom names.
- Alternative matches and knowledge-backed visual discovery.
- Private scan notes and existing Library tags/collections.
- Duplicate-image detection using SHA-256 before a second AI request is created.
- Retryable persisted analysis jobs and daily per-user AI usage limits.
- Provider usage, latency and failure logging for operations monitoring.

## Discovery

- Discovery Trails automatically connect recently viewed foods, ingredients, recipes and scans.
- Cuisine Atlas groups the existing international knowledge catalogue by region.
- Food aliases improve search and matching across alternative names.
- Existing Food Comparison, related-food graph, recipes and Ingredient Intelligence remain canonical.

## Community

- Public food-focused profiles can be enabled per account.
- Follow/unfollow and block/unblock controls.
- One-level comment replies with deep-linked notifications.
- Community reporting and administrator moderation.
- Email verification flow and granular social notification preferences.

## Collections

- Private/public collection visibility.
- Cover images.
- Viewer/editor collaborators.
- Collection ordering, public share links and saving other users' public collections.

## Operations and administration

- Admin Knowledge Studio summary and content-quality checks.
- Food alias management.
- Moderation queue.
- Analysis-job, AI-provider and email-delivery operational status.
- Manual retry for failed analysis jobs.

## PWA/mobile

- Installable web-app manifest and service worker for the application shell.
- Existing camera, upload, paste and multi-image scan workflows remain unchanged.

## Compatibility

The database initializes all new tables with `CREATE TABLE IF NOT EXISTS` and adds new columns through forward-compatible migration checks. Existing FoodSnap 1.0.0 user databases can therefore be upgraded without resetting personal data.
