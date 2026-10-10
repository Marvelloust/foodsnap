CREATE TABLE IF NOT EXISTS media_assets(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id INTEGER,
  media_type TEXT NOT NULL,
  file_url TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ready',
  poster_url TEXT NOT NULL DEFAULT '',
  variants_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON media_assets(entity_type,entity_id,id);
CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets(owner_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS backup_runs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'queued',
  file_path TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  integrity_status TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON post_comments(post_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON post_likes(post_id,user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id,read_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_entries_plan_date ON meal_plan_entries(meal_plan_id,plan_date,position);
CREATE INDEX IF NOT EXISTS idx_saved_user_type_created ON saved_items(user_id,item_type,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_following_created ON follows(following_id,created_at DESC);
