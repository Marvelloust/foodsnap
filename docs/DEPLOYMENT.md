# Deployment

## Single-server deployment

The included architecture is suitable for one Node.js application instance with persistent local disk.

Recommended production setup:

1. Node.js 22 LTS or newer
2. HTTPS reverse proxy (Nginx, Caddy or managed ingress)
3. `NODE_ENV=production`
4. persistent `data/` and `uploads/` volumes
5. configured vision/OCR provider
6. configured transactional mail provider
7. long random secrets and strong administrator credentials
8. regular SQLite backup snapshots
9. process supervision (systemd, PM2 or a managed platform)

## Horizontal scaling

Before running multiple application instances:

- migrate SQLite to PostgreSQL
- store media in object storage
- move analysis jobs to a shared durable queue
- move rate-limit state to shared infrastructure

The normalized AI provider contracts can remain unchanged.

## Reverse-proxy example

Forward HTTPS traffic to `127.0.0.1:3050` and preserve standard forwarding headers. Keep the Node process private to the host/network.

## Environment

FoodSnap automatically loads a `.env` file from the project root if present. Existing process environment variables take precedence.
