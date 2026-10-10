-- Preserve visibility of content created before scheduled publishing was introduced.
UPDATE posts
SET published_at = created_at
WHERE published_at IS NULL
  AND scheduled_at IS NULL;

UPDATE user_recipes
SET published_at = created_at
WHERE status = 'published'
  AND published_at IS NULL
  AND scheduled_at IS NULL;
