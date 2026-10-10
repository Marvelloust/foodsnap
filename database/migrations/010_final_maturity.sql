-- Final product maturity pass: professional messaging/groups, richer social state,
-- planner/shopping lifecycle, account/session controls and moderation metadata.

ALTER TABLE users ADD COLUMN last_seen_at TEXT;
ALTER TABLE users ADD COLUMN two_factor_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sessions ADD COLUMN user_agent TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN ip_address TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN device_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;

ALTER TABLE conversations ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE conversation_members ADD COLUMN muted_until TEXT;
ALTER TABLE conversation_members ADD COLUMN archived_at TEXT;
ALTER TABLE conversation_members ADD COLUMN last_read_message_id INTEGER;
ALTER TABLE conversation_members ADD COLUMN last_delivered_at TEXT;

ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS message_reactions(
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id,emoji)
);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id,created_at);

CREATE TABLE IF NOT EXISTS message_stars(
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_stars_user ON message_stars(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS post_saves(
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_saves_user ON post_saves(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS post_reshares(
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reshares_post ON post_reshares(post_id,created_at DESC);

ALTER TABLE meal_plan_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE meal_plan_entries ADD COLUMN recurrence_rule TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS shopping_activity(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopping_activity_list ON shopping_activity(shopping_list_id,created_at DESC);

ALTER TABLE media_assets ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE media_assets ADD COLUMN moderation_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS backup_policies(
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 1,
  frequency_hours INTEGER NOT NULL DEFAULT 24,
  keep_count INTEGER NOT NULL DEFAULT 7,
  last_run_at TEXT,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO backup_policies(id,enabled,frequency_hours,keep_count,updated_at)
VALUES(1,1,24,7,datetime('now'));

-- Expand moderation targets without leaving older CHECK constraints behind.
CREATE TABLE IF NOT EXISTS moderation_reports_v2(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN('scan','comment','profile','collection','post','user_recipe','message','conversation')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','dismissed','actioned')),
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO moderation_reports_v2(id,reporter_id,target_type,target_id,reason,detail,status,resolved_by,resolved_at,created_at)
SELECT id,reporter_id,target_type,target_id,reason,detail,status,resolved_by,resolved_at,created_at FROM moderation_reports;
DROP TABLE moderation_reports;
ALTER TABLE moderation_reports_v2 RENAME TO moderation_reports;
CREATE INDEX IF NOT EXISTS idx_reports_status ON moderation_reports(status,created_at DESC);
