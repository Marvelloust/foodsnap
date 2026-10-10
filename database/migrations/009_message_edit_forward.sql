ALTER TABLE messages ADD COLUMN edited_at TEXT;
ALTER TABLE messages ADD COLUMN forwarded_from_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
