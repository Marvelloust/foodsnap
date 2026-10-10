# Security notes

## Identity

Passwords are derived using Node.js `crypto.scrypt` with a per-user random salt. Plain passwords are never stored.

Sessions use random 32-byte tokens and are stored server-side with expiry. Session cookies are HttpOnly and SameSite=Lax. Production mode adds Secure.

## CSRF

Each authenticated session has a separate CSRF token. POST/PATCH/DELETE endpoints that mutate authenticated state require it through `X-CSRF-Token`.

## Uploads

FoodSnap:

- accepts JPG, PNG, WEBP and GIF
- verifies image signatures, not only browser-declared MIME
- limits each image to 8MB
- limits the authenticated scan to 24MB and public scan to 18MB
- generates random server filenames
- does not use the original filename as a storage path

For internet production, add image re-encoding and malware-content scanning in the upload pipeline before object storage.

## Password reset

Reset tokens are random, time-limited and stored only as SHA-256 hashes. Recovery responses are identical whether an account exists or not.

## Authorization

All personal scan, Saved, profile, settings and assistant routes are user-scoped on the server. The frontend is not the security boundary.

## Rate limiting

In-memory IP buckets protect common API calls, with tighter limits on sign-up, sign-in, recovery and scan creation. For multi-instance deployment, move rate-limit state to shared infrastructure.

## Protected scan media

The definitive merge removes direct public serving of personal scan uploads. Media access is checked against the authenticated scan owner or the anonymous guest identity that created the scan. A separately generated random share token is required for public shared-result media.

This prevents a predictable uploads path from becoming an authorization bypass.
