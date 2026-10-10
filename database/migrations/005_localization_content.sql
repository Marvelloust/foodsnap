CREATE TABLE IF NOT EXISTS localized_strings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,
  string_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(namespace,string_key,locale)
);
CREATE INDEX IF NOT EXISTS idx_localized_strings_locale ON localized_strings(locale,namespace,string_key);

CREATE TABLE IF NOT EXISTS knowledge_revisions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  editor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  source_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_revisions_entity ON knowledge_revisions(entity_type,entity_id,status,created_at DESC);
