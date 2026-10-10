-- FoodSnap 1.0.0 generated SQLite schema
-- Generated from the final database initializer and migrations.
PRAGMA foreign_keys=ON;

CREATE TABLE account_deletion_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'scheduled',execute_at TEXT NOT NULL,created_at TEXT NOT NULL,cancelled_at TEXT);

CREATE TABLE activity_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type TEXT NOT NULL, label TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', meta_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);

CREATE TABLE ai_usage(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
 feature TEXT NOT NULL, provider TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, latency_ms INTEGER NOT NULL DEFAULT 0,
 error_code TEXT NOT NULL DEFAULT '', estimated_units INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);

CREATE TABLE analysis_jobs(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','complete','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, last_error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE assistant_messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN('user','assistant')), content TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'context', created_at TEXT NOT NULL
);

CREATE TABLE assistant_threads(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE, title TEXT NOT NULL DEFAULT 'FoodSnap Intelligence', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL DEFAULT '',metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);

CREATE TABLE backup_policies(
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 1,
  frequency_hours INTEGER NOT NULL DEFAULT 24,
  keep_count INTEGER NOT NULL DEFAULT 7,
  last_run_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE backup_runs(
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

CREATE TABLE barcode_cache(barcode TEXT PRIMARY KEY,data_json TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'OpenFoodFacts',expires_at TEXT NOT NULL,fetched_at TEXT NOT NULL);

CREATE TABLE blocks(
 blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id)
);

CREATE TABLE collection_collaborators(
 collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN('viewer','editor')), created_at TEXT NOT NULL,
 PRIMARY KEY(collection_id,user_id)
);

CREATE TABLE collection_items(
 collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient')), item_id INTEGER NOT NULL, created_at TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(collection_id,item_type,item_id)
);

CREATE TABLE collection_saves(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,collection_id)
);

CREATE TABLE collection_share_links(
 token TEXT PRIMARY KEY, collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, revoked_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE collections(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', accent TEXT NOT NULL DEFAULT '#123D3D', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', cover_url TEXT NOT NULL DEFAULT '', is_smart INTEGER NOT NULL DEFAULT 0, rule_json TEXT NOT NULL DEFAULT '{}',
 UNIQUE(user_id,name)
);

CREATE TABLE comment_mentions(comment_type TEXT NOT NULL,comment_id INTEGER NOT NULL,mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(comment_type,comment_id,mentioned_user_id));

CREATE TABLE comments(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient')), item_id INTEGER NOT NULL,
 body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, parent_id INTEGER, deleted_at TEXT);

CREATE TABLE conversation_members(
 conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'member', last_read_at TEXT, joined_at TEXT NOT NULL, muted_until TEXT, archived_at TEXT, last_read_message_id INTEGER, last_delivered_at TEXT, PRIMARY KEY(conversation_id,user_id)
);

CREATE TABLE conversations(
 id INTEGER PRIMARY KEY AUTOINCREMENT, created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL DEFAULT '', is_group INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, request_status TEXT NOT NULL DEFAULT 'accepted', initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, accepted_at TEXT, description TEXT NOT NULL DEFAULT '', avatar_url TEXT NOT NULL DEFAULT '', owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL);

CREATE TABLE cooking_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL, user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL,
 cooked_on TEXT NOT NULL, rating INTEGER CHECK(rating BETWEEN 1 AND 5), would_make_again INTEGER, note TEXT NOT NULL DEFAULT '',
 photo_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);

CREATE TABLE cuisines(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, region TEXT NOT NULL,
 description TEXT NOT NULL, accent TEXT NOT NULL DEFAULT '#123D3D', image_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE data_exports(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'queued',file_url TEXT NOT NULL DEFAULT '',expires_at TEXT,error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL, file_name TEXT NOT NULL DEFAULT '', export_format TEXT NOT NULL DEFAULT 'json');

CREATE TABLE discovery_trails(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, path_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE editorial_stories(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, deck TEXT NOT NULL,
 category TEXT NOT NULL, image_url TEXT NOT NULL, body TEXT NOT NULL, published_at TEXT NOT NULL
);

CREATE TABLE email_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, email TEXT NOT NULL,
 event_type TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', transport TEXT NOT NULL DEFAULT '',
 detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);

CREATE TABLE email_verification_tokens(
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE follows(
 follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(follower_id,following_id), CHECK(follower_id<>following_id)
);

CREATE TABLE food_aliases(
 id INTEGER PRIMARY KEY AUTOINCREMENT, food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 alias TEXT NOT NULL COLLATE NOCASE, normalized TEXT NOT NULL COLLATE NOCASE, source TEXT NOT NULL DEFAULT 'curated', language TEXT NOT NULL DEFAULT 'en', country TEXT NOT NULL DEFAULT '',
 UNIQUE(food_id,normalized)
);

CREATE TABLE food_ingredients(
 food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
 relationship TEXT NOT NULL DEFAULT 'common', PRIMARY KEY(food_id,ingredient_id)
);

CREATE TABLE food_relationships(
 food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE, related_food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 relation_type TEXT NOT NULL DEFAULT 'similar', PRIMARY KEY(food_id,related_food_id,relation_type)
);

CREATE TABLE foods(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, cuisine_id INTEGER REFERENCES cuisines(id),
 category TEXT NOT NULL, description TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
 tags_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
);

CREATE TABLE household_invites(id INTEGER PRIMARY KEY AUTOINCREMENT,household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,email TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,role TEXT NOT NULL DEFAULT 'member',expires_at TEXT NOT NULL,accepted_at TEXT,created_at TEXT NOT NULL);

CREATE TABLE household_members(household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'member',joined_at TEXT NOT NULL,PRIMARY KEY(household_id,user_id));

CREATE TABLE households(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,invite_code TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,updated_at TEXT NOT NULL, invite_enabled INTEGER NOT NULL DEFAULT 1);

CREATE TABLE ingredients(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 description TEXT NOT NULL, common_uses TEXT NOT NULL, substitutions TEXT NOT NULL DEFAULT '', storage TEXT NOT NULL DEFAULT '',
 culture_context TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE item_likes(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient')), item_id INTEGER NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,item_type,item_id)
);

CREATE TABLE knowledge_revisions(
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

CREATE TABLE knowledge_sources(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT NOT NULL,entity_id INTEGER NOT NULL,source_name TEXT NOT NULL,source_url TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',verified_at TEXT,created_at TEXT NOT NULL);

CREATE TABLE library_tags(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL,
 color TEXT NOT NULL DEFAULT '#123D3D', UNIQUE(user_id,name)
);

CREATE TABLE localized_strings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,
  string_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(namespace,string_key,locale)
);

CREATE TABLE meal_plan_entries(
 id INTEGER PRIMARY KEY AUTOINCREMENT, meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
 plan_date TEXT NOT NULL, meal_slot TEXT NOT NULL DEFAULT 'Dinner', recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
 user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL, food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
 title TEXT NOT NULL DEFAULT '', servings INTEGER NOT NULL DEFAULT 2, note TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, status TEXT NOT NULL DEFAULT 'planned', recurrence_rule TEXT NOT NULL DEFAULT '');

CREATE TABLE meal_plans(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL DEFAULT 'My meal plan', start_date TEXT NOT NULL, end_date TEXT NOT NULL, is_template INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, household_id INTEGER REFERENCES households(id) ON DELETE CASCADE);

CREATE TABLE media_assets(
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
, moderation_status TEXT NOT NULL DEFAULT 'approved', moderation_note TEXT NOT NULL DEFAULT '');

CREATE TABLE message_attachments(id INTEGER PRIMARY KEY AUTOINCREMENT,message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,attachment_type TEXT NOT NULL,file_url TEXT NOT NULL DEFAULT '',mime_type TEXT NOT NULL DEFAULT '',bytes INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);

CREATE TABLE message_reactions(
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id,emoji)
);

CREATE TABLE message_stars(
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id)
);

CREATE TABLE message_user_deletions(
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id)
);

CREATE TABLE messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL DEFAULT '',
 share_type TEXT CHECK(share_type IN('food','recipe','user_recipe','scan','collection','post') OR share_type IS NULL), share_id INTEGER,
 deleted_by_sender INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
, edited_at TEXT, forwarded_from_id INTEGER REFERENCES messages(id) ON DELETE SET NULL, reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL);

CREATE TABLE "moderation_reports"(
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

CREATE TABLE notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', read_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE pantry_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL, name TEXT NOT NULL, quantity REAL, unit TEXT NOT NULL DEFAULT '',
 note TEXT NOT NULL DEFAULT '', expires_on TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, household_id INTEGER REFERENCES households(id) ON DELETE CASCADE);

CREATE TABLE password_reset_tokens(
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE post_comment_likes(
 comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(comment_id,user_id)
);

CREATE TABLE post_comments(
 id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES post_comments(id) ON DELETE SET NULL,
 body TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE post_likes(
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(post_id,user_id)
);

CREATE TABLE post_media(
 id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 media_type TEXT NOT NULL CHECK(media_type IN('image','video')), file_url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);

CREATE TABLE post_reshares(
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id,user_id)
);

CREATE TABLE post_saves(
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id,user_id)
);

CREATE TABLE posts(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_type TEXT NOT NULL DEFAULT 'food_story' CHECK(post_type IN('food_story','cooked_recipe','scan_share','collection_share')),
 caption TEXT NOT NULL DEFAULT '', food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
 user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL, scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
 collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL, cuisine_id INTEGER REFERENCES cuisines(id) ON DELETE SET NULL,
 visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN('followers','public')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, scheduled_at TEXT, published_at TEXT);

CREATE TABLE preferences(
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 theme TEXT NOT NULL DEFAULT 'system' CHECK(theme IN('system','light','dark')),
 dietary_json TEXT NOT NULL DEFAULT '[]', cuisines_json TEXT NOT NULL DEFAULT '[]', allergens_json TEXT NOT NULL DEFAULT '[]',
 ai_detail TEXT NOT NULL DEFAULT 'balanced' CHECK(ai_detail IN('concise','balanced','deep')),
 notify_scan INTEGER NOT NULL DEFAULT 1, notify_discovery INTEGER NOT NULL DEFAULT 1,
 data_retention TEXT NOT NULL DEFAULT 'keep' CHECK(data_retention IN('keep','30d','90d')),
 updated_at TEXT NOT NULL
, notify_likes INTEGER NOT NULL DEFAULT 1, notify_comments INTEGER NOT NULL DEFAULT 1, notify_replies INTEGER NOT NULL DEFAULT 1, notify_follows INTEGER NOT NULL DEFAULT 1, email_scan INTEGER NOT NULL DEFAULT 1, email_social INTEGER NOT NULL DEFAULT 0, message_privacy TEXT NOT NULL DEFAULT 'everyone', comment_privacy TEXT NOT NULL DEFAULT 'everyone', show_cooking_activity INTEGER NOT NULL DEFAULT 1, notify_messages INTEGER NOT NULL DEFAULT 1, notify_planning INTEGER NOT NULL DEFAULT 1, push_enabled INTEGER NOT NULL DEFAULT 0, locale TEXT NOT NULL DEFAULT 'en');

CREATE TABLE push_subscriptions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,endpoint TEXT NOT NULL UNIQUE,p256dh TEXT NOT NULL DEFAULT '',auth TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE rate_limit_buckets(
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE realtime_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE recent_views(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('food','recipe','ingredient','scan','story')), item_id INTEGER NOT NULL,
 source_path TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 UNIQUE(user_id,item_type,item_id)
);

CREATE TABLE recipe_imports(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,url TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',source_domain TEXT NOT NULL DEFAULT '',result_json TEXT NOT NULL DEFAULT '{}',error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE recipe_ingredients(
 recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
 amount TEXT NOT NULL DEFAULT '', PRIMARY KEY(recipe_id,ingredient_id)
);

CREATE TABLE recipe_media(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_recipe_id INTEGER NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
 media_type TEXT NOT NULL CHECK(media_type IN('image','video')), file_url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', step_index INTEGER,
 position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);

CREATE TABLE recipe_ratings(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, recipe_type TEXT NOT NULL CHECK(recipe_type IN('knowledge','user')),
 recipe_id INTEGER NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), made_it INTEGER NOT NULL DEFAULT 0,
 review TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,recipe_type,recipe_id)
);

CREATE TABLE recipe_versions(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_recipe_id INTEGER NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
 version_no INTEGER NOT NULL, snapshot_json TEXT NOT NULL, change_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 UNIQUE(user_recipe_id,version_no)
);

CREATE TABLE recipes(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 description TEXT NOT NULL, cuisine_id INTEGER REFERENCES cuisines(id), prep_minutes INTEGER NOT NULL DEFAULT 0,
 cook_minutes INTEGER NOT NULL DEFAULT 0, servings INTEGER NOT NULL DEFAULT 2, image_url TEXT NOT NULL DEFAULT '',
 ingredients_json TEXT NOT NULL DEFAULT '[]', steps_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]',
 source_name TEXT NOT NULL DEFAULT 'FoodSnap Kitchen', source_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);

CREATE TABLE reminders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,household_id INTEGER,reminder_type TEXT NOT NULL,entity_type TEXT NOT NULL DEFAULT '',entity_id INTEGER,message TEXT NOT NULL DEFAULT '',run_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'scheduled',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE saved_items(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient','story')),
 item_id INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,item_type,item_id)
);

CREATE TABLE saved_searches(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,query TEXT NOT NULL,filters_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,name));

CREATE TABLE scan_allergens(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 name TEXT NOT NULL, basis TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0, source_type TEXT NOT NULL DEFAULT 'inferred'
);

CREATE TABLE scan_alternatives(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 score REAL NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'knowledge', created_at TEXT NOT NULL, PRIMARY KEY(scan_id,food_id)
);

CREATE TABLE scan_corrections(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, original_title TEXT NOT NULL DEFAULT '',
 confirmed_food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, confirmed_name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);

CREATE TABLE scan_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 stage TEXT NOT NULL, label TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'complete', created_at TEXT NOT NULL
);

CREATE TABLE scan_food_links(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 relation_type TEXT NOT NULL DEFAULT 'related', score REAL NOT NULL DEFAULT 0, PRIMARY KEY(scan_id,food_id,relation_type)
);

CREATE TABLE scan_ingredients(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
 confidence REAL NOT NULL DEFAULT 0, relationship TEXT NOT NULL DEFAULT 'possible', source_type TEXT NOT NULL DEFAULT 'inferred',
 PRIMARY KEY(scan_id,ingredient_id)
);

CREATE TABLE scan_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, name TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0,
 item_type TEXT NOT NULL DEFAULT 'food', bbox_json TEXT NOT NULL DEFAULT '{}', notes TEXT NOT NULL DEFAULT '', source_type TEXT NOT NULL DEFAULT 'inferred'
);

CREATE TABLE scan_media(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 file_url TEXT NOT NULL, original_name TEXT NOT NULL DEFAULT '', mime_type TEXT NOT NULL, bytes INTEGER NOT NULL,
 width INTEGER, height INTEGER, created_at TEXT NOT NULL
, sha256 TEXT NOT NULL DEFAULT '');

CREATE TABLE scan_tags(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
 PRIMARY KEY(scan_id,tag_id)
);

CREATE TABLE scan_text(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 text TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0, bbox_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);

CREATE TABLE scans(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, guest_id TEXT,
 scan_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT 'Untitled scan', input_kind TEXT NOT NULL DEFAULT 'image',
 content_type TEXT NOT NULL DEFAULT 'unknown', status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','processing','complete','partial','error')),
 stage TEXT NOT NULL DEFAULT 'queued', confidence REAL NOT NULL DEFAULT 0, confidence_label TEXT NOT NULL DEFAULT '',
 summary TEXT NOT NULL DEFAULT '', cuisine TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', uncertainty_note TEXT NOT NULL DEFAULT '',
 provider_ref TEXT NOT NULL DEFAULT '', analysis_json TEXT NOT NULL DEFAULT '{}', tags_json TEXT NOT NULL DEFAULT '[]',
 is_favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, user_note TEXT NOT NULL DEFAULT '');

CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL);

CREATE TABLE search_history(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 query TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE sessions(
 token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
, user_agent TEXT NOT NULL DEFAULT '', ip_address TEXT NOT NULL DEFAULT '', device_name TEXT NOT NULL DEFAULT '', last_seen_at TEXT);

CREATE TABLE share_links(
 token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe')), item_id INTEGER NOT NULL,
 expires_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE shopping_activity(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE shopping_list_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
 ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL, name TEXT NOT NULL, quantity REAL, unit TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Other', note TEXT NOT NULL DEFAULT '', checked INTEGER NOT NULL DEFAULT 0,
 source_type TEXT NOT NULL DEFAULT 'manual', source_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE shopping_lists(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, household_id INTEGER REFERENCES households(id) ON DELETE CASCADE, UNIQUE(user_id,name)
);

CREATE TABLE system_jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 5,run_at TEXT NOT NULL,locked_at TEXT,locked_by TEXT NOT NULL DEFAULT '',last_error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE system_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE user_recipe_saves(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, user_recipe_id INTEGER NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,user_recipe_id)
);

CREATE TABLE user_recipes(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', cuisine_id INTEGER REFERENCES cuisines(id) ON DELETE SET NULL,
 category TEXT NOT NULL DEFAULT 'Main dish', prep_minutes INTEGER NOT NULL DEFAULT 0, cook_minutes INTEGER NOT NULL DEFAULT 0,
 servings INTEGER NOT NULL DEFAULT 2, difficulty TEXT NOT NULL DEFAULT 'Everyday', cover_url TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '',
 ingredients_json TEXT NOT NULL DEFAULT '[]', steps_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]',
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN('private','followers','public')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published')), parent_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
 parent_user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, scheduled_at TEXT, published_at TEXT,
 UNIQUE(user_id,slug)
);

CREATE TABLE users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN('user','admin')),
 bio TEXT NOT NULL DEFAULT '', avatar_url TEXT NOT NULL DEFAULT '', onboarding_complete INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
, email_verified_at TEXT, profile_public INTEGER NOT NULL DEFAULT 0, last_seen_at TEXT, two_factor_secret TEXT NOT NULL DEFAULT '', two_factor_enabled INTEGER NOT NULL DEFAULT 0);

CREATE INDEX idx_activity_user ON activity_events(user_id,created_at DESC);

CREATE INDEX idx_ai_usage_user_day ON ai_usage(user_id,created_at);

CREATE INDEX idx_alias_lookup ON food_aliases(normalized);

CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id,created_at DESC);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type,entity_id,created_at DESC);

CREATE INDEX idx_collection_collab_user ON collection_collaborators(user_id,collection_id);

CREATE INDEX idx_collections_user ON collections(user_id,updated_at DESC);

CREATE INDEX idx_comments_item ON comments(item_type,item_id,created_at DESC);

CREATE INDEX idx_conversation_members_user ON conversation_members(user_id,conversation_id);

CREATE INDEX idx_cooking_logs_user ON cooking_logs(user_id,cooked_on DESC);

CREATE INDEX idx_corrections_scan ON scan_corrections(scan_id,created_at DESC);

CREATE INDEX idx_email_events_user ON email_events(user_id,created_at DESC);

CREATE INDEX idx_follows_following ON follows(following_id,created_at DESC);

CREATE INDEX idx_follows_following_created ON follows(following_id,created_at DESC);

CREATE INDEX idx_foods_category ON foods(category);

CREATE INDEX idx_household_members_user ON household_members(user_id,household_id);

CREATE INDEX idx_item_likes_item ON item_likes(item_type,item_id,created_at DESC);

CREATE INDEX idx_jobs_status ON analysis_jobs(status,next_attempt_at);

CREATE INDEX idx_knowledge_revisions_entity ON knowledge_revisions(entity_type,entity_id,status,created_at DESC);

CREATE INDEX idx_knowledge_sources_entity ON knowledge_sources(entity_type,entity_id);

CREATE INDEX idx_localized_strings_locale ON localized_strings(locale,namespace,string_key);

CREATE INDEX idx_meal_entries_plan_date ON meal_plan_entries(meal_plan_id,plan_date);

CREATE INDEX idx_meal_plans_user ON meal_plans(user_id,start_date);

CREATE INDEX idx_media_assets_entity ON media_assets(entity_type,entity_id,id);

CREATE INDEX idx_media_assets_owner ON media_assets(owner_user_id,created_at DESC);

CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);

CREATE INDEX idx_message_reactions_message ON message_reactions(message_id,created_at);

CREATE INDEX idx_message_stars_user ON message_stars(user_id,created_at DESC);

CREATE INDEX idx_message_user_deletions_user ON message_user_deletions(user_id,message_id);

CREATE INDEX idx_messages_conversation ON messages(conversation_id,created_at);

CREATE INDEX idx_messages_conversation_created ON messages(conversation_id,created_at DESC);

CREATE INDEX idx_notifications_user ON notifications(user_id,read_at,created_at DESC);

CREATE INDEX idx_notifications_user_read_created ON notifications(user_id,read_at,created_at DESC);

CREATE INDEX idx_pantry_user ON pantry_items(user_id,updated_at DESC);

CREATE INDEX idx_post_comment_likes_comment ON post_comment_likes(comment_id,created_at DESC);

CREATE INDEX idx_post_comments_post ON post_comments(post_id,created_at);

CREATE INDEX idx_post_comments_post_created ON post_comments(post_id,created_at DESC);

CREATE INDEX idx_post_likes_post_user ON post_likes(post_id,user_id);

CREATE INDEX idx_post_reshares_post ON post_reshares(post_id,created_at DESC);

CREATE INDEX idx_post_saves_user ON post_saves(user_id,created_at DESC);

CREATE INDEX idx_posts_author_created ON posts(user_id,created_at DESC);

CREATE INDEX idx_posts_created ON posts(created_at DESC);

CREATE INDEX idx_posts_user ON posts(user_id,created_at DESC);

CREATE INDEX idx_rate_limits_expiry ON rate_limit_buckets(expires_at);

CREATE INDEX idx_realtime_events_user ON realtime_events(user_id,id);

CREATE INDEX idx_recent_views_user ON recent_views(user_id,created_at DESC);

CREATE INDEX idx_recipe_versions_recipe ON recipe_versions(user_recipe_id,version_no DESC);

CREATE INDEX idx_recipes_cuisine ON recipes(cuisine_id);

CREATE INDEX idx_reminders_due ON reminders(status,run_at);

CREATE INDEX idx_reports_status ON moderation_reports(status,created_at DESC);

CREATE INDEX idx_saved_user_type ON saved_items(user_id,item_type,created_at DESC);

CREATE INDEX idx_saved_user_type_created ON saved_items(user_id,item_type,created_at DESC);

CREATE INDEX idx_scans_status ON scans(status,updated_at);

CREATE INDEX idx_scans_user_created ON scans(user_id,created_at DESC);

CREATE INDEX idx_share_links_item ON share_links(item_type,item_id,revoked_at);

CREATE INDEX idx_shopping_activity_list ON shopping_activity(shopping_list_id,created_at DESC);

CREATE INDEX idx_shopping_lists_user ON shopping_lists(user_id,updated_at DESC);

CREATE INDEX idx_system_jobs_due ON system_jobs(status,run_at,id);

CREATE INDEX idx_trails_user ON discovery_trails(user_id,updated_at DESC);

CREATE INDEX idx_user_recipe_saves_recipe ON user_recipe_saves(user_recipe_id,created_at DESC);

CREATE INDEX idx_user_recipes_user ON user_recipes(user_id,status,updated_at DESC);

CREATE INDEX idx_verification_user ON email_verification_tokens(user_id,expires_at);
