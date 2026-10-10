-- Release hardening: per-user message deletion, durable realtime, distributed rate limits,
-- exact export file mapping and household invite lifecycle.
CREATE TABLE IF NOT EXISTS message_user_deletions(
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_user_deletions_user ON message_user_deletions(user_id,message_id);

CREATE TABLE IF NOT EXISTS realtime_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_realtime_events_user ON realtime_events(user_id,id);

CREATE TABLE IF NOT EXISTS rate_limit_buckets(
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limit_buckets(expires_at);

ALTER TABLE data_exports ADD COLUMN file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE households ADD COLUMN invite_enabled INTEGER NOT NULL DEFAULT 1;

-- Existing sender-side deletions were global. Preserve the sender's intent while restoring
-- message text when possible is impossible, so old rows remain marked removed for everyone.
-- New deletions use message_user_deletions and never mutate shared message content.

-- Backfill media registry for installations upgraded from releases before media_assets.
INSERT OR IGNORE INTO media_assets(owner_user_id,entity_type,entity_id,media_type,file_url,mime_type,bytes,status,created_at,updated_at)
SELECT ur.user_id,'recipe',rm.user_recipe_id,rm.media_type,rm.file_url,'',0,'ready',rm.created_at,rm.created_at
FROM recipe_media rm JOIN user_recipes ur ON ur.id=rm.user_recipe_id WHERE rm.file_url LIKE '/api/community-media/%';
INSERT OR IGNORE INTO media_assets(owner_user_id,entity_type,entity_id,media_type,file_url,mime_type,bytes,status,created_at,updated_at)
SELECT p.user_id,'post',pm.post_id,pm.media_type,pm.file_url,'',0,'ready',pm.created_at,pm.created_at
FROM post_media pm JOIN posts p ON p.id=pm.post_id WHERE pm.file_url LIKE '/api/community-media/%';
INSERT OR IGNORE INTO media_assets(owner_user_id,entity_type,entity_id,media_type,file_url,mime_type,bytes,status,created_at,updated_at)
SELECT cl.user_id,'journal',cl.id,'image',cl.photo_url,'',0,'ready',cl.created_at,cl.created_at
FROM cooking_logs cl WHERE cl.photo_url LIKE '/api/community-media/%';
INSERT OR IGNORE INTO media_assets(owner_user_id,entity_type,entity_id,media_type,file_url,mime_type,bytes,status,created_at,updated_at)
SELECT m.sender_id,'message',ma.message_id,ma.attachment_type,ma.file_url,ma.mime_type,ma.bytes,'ready',ma.created_at,ma.created_at
FROM message_attachments ma JOIN messages m ON m.id=ma.message_id WHERE ma.file_url LIKE '/api/community-media/%';
