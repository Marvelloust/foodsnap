const path = require('path');
const crypto = require('crypto');
const {createDatabase}=require('./sqlite');
const K41 = require('./knowledge-v1');
const {runMigrations}=require('./migrations');

const dbPath = process.env.FOODSNAP_DB || path.join(__dirname, '..', 'data', 'foodsnap.sqlite');
const db = createDatabase(dbPath);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;');
const now = () => new Date().toISOString();
const slugify = (v='') => String(v).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored='') {
  try { const [salt, hash] = stored.split(':'); const got = crypto.scryptSync(password, salt, 64); return crypto.timingSafeEqual(got, Buffer.from(hash,'hex')); } catch { return false; }
}
function j(v, fallback=[]) { try { return JSON.parse(v); } catch { return fallback; } }

function initSchema(){ db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN('user','admin')),
 bio TEXT NOT NULL DEFAULT '', avatar_url TEXT NOT NULL DEFAULT '', onboarding_complete INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
 token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_reset_tokens(
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences(
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 theme TEXT NOT NULL DEFAULT 'system' CHECK(theme IN('system','light','dark')),
 dietary_json TEXT NOT NULL DEFAULT '[]', cuisines_json TEXT NOT NULL DEFAULT '[]', allergens_json TEXT NOT NULL DEFAULT '[]',
 ai_detail TEXT NOT NULL DEFAULT 'balanced' CHECK(ai_detail IN('concise','balanced','deep')),
 notify_scan INTEGER NOT NULL DEFAULT 1, notify_discovery INTEGER NOT NULL DEFAULT 1,
 data_retention TEXT NOT NULL DEFAULT 'keep' CHECK(data_retention IN('keep','30d','90d')),
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cuisines(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, region TEXT NOT NULL,
 description TEXT NOT NULL, accent TEXT NOT NULL DEFAULT '#123D3D', image_url TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS foods(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, cuisine_id INTEGER REFERENCES cuisines(id),
 category TEXT NOT NULL, description TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
 tags_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ingredients(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 description TEXT NOT NULL, common_uses TEXT NOT NULL, substitutions TEXT NOT NULL DEFAULT '', storage TEXT NOT NULL DEFAULT '',
 culture_context TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS recipes(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 description TEXT NOT NULL, cuisine_id INTEGER REFERENCES cuisines(id), prep_minutes INTEGER NOT NULL DEFAULT 0,
 cook_minutes INTEGER NOT NULL DEFAULT 0, servings INTEGER NOT NULL DEFAULT 2, image_url TEXT NOT NULL DEFAULT '',
 ingredients_json TEXT NOT NULL DEFAULT '[]', steps_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]',
 source_name TEXT NOT NULL DEFAULT 'FoodSnap Kitchen', source_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS food_ingredients(
 food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
 relationship TEXT NOT NULL DEFAULT 'common', PRIMARY KEY(food_id,ingredient_id)
);
CREATE TABLE IF NOT EXISTS recipe_ingredients(
 recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
 amount TEXT NOT NULL DEFAULT '', PRIMARY KEY(recipe_id,ingredient_id)
);
CREATE TABLE IF NOT EXISTS food_relationships(
 food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE, related_food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 relation_type TEXT NOT NULL DEFAULT 'similar', PRIMARY KEY(food_id,related_food_id,relation_type)
);
CREATE TABLE IF NOT EXISTS editorial_stories(
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, deck TEXT NOT NULL,
 category TEXT NOT NULL, image_url TEXT NOT NULL, body TEXT NOT NULL, published_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scans(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, guest_id TEXT,
 scan_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT 'Untitled scan', input_kind TEXT NOT NULL DEFAULT 'image',
 content_type TEXT NOT NULL DEFAULT 'unknown', status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','processing','complete','partial','error')),
 stage TEXT NOT NULL DEFAULT 'queued', confidence REAL NOT NULL DEFAULT 0, confidence_label TEXT NOT NULL DEFAULT '',
 summary TEXT NOT NULL DEFAULT '', cuisine TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', uncertainty_note TEXT NOT NULL DEFAULT '',
 provider_ref TEXT NOT NULL DEFAULT '', analysis_json TEXT NOT NULL DEFAULT '{}', tags_json TEXT NOT NULL DEFAULT '[]',
 is_favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_media(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 file_url TEXT NOT NULL, original_name TEXT NOT NULL DEFAULT '', mime_type TEXT NOT NULL, bytes INTEGER NOT NULL,
 width INTEGER, height INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 stage TEXT NOT NULL, label TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'complete', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, name TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0,
 item_type TEXT NOT NULL DEFAULT 'food', bbox_json TEXT NOT NULL DEFAULT '{}', notes TEXT NOT NULL DEFAULT '', source_type TEXT NOT NULL DEFAULT 'inferred'
);
CREATE TABLE IF NOT EXISTS scan_text(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 text TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0, bbox_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_ingredients(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
 confidence REAL NOT NULL DEFAULT 0, relationship TEXT NOT NULL DEFAULT 'possible', source_type TEXT NOT NULL DEFAULT 'inferred',
 PRIMARY KEY(scan_id,ingredient_id)
);
CREATE TABLE IF NOT EXISTS scan_allergens(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 name TEXT NOT NULL, basis TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0, source_type TEXT NOT NULL DEFAULT 'inferred'
);
CREATE TABLE IF NOT EXISTS scan_food_links(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 relation_type TEXT NOT NULL DEFAULT 'related', score REAL NOT NULL DEFAULT 0, PRIMARY KEY(scan_id,food_id,relation_type)
);
CREATE TABLE IF NOT EXISTS analysis_jobs(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','complete','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, last_error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_items(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient','story')),
 item_id INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,item_type,item_id)
);
CREATE TABLE IF NOT EXISTS library_tags(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL,
 color TEXT NOT NULL DEFAULT '#123D3D', UNIQUE(user_id,name)
);
CREATE TABLE IF NOT EXISTS scan_tags(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
 PRIMARY KEY(scan_id,tag_id)
);
CREATE TABLE IF NOT EXISTS assistant_threads(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE, title TEXT NOT NULL DEFAULT 'FoodSnap Intelligence', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assistant_messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN('user','assistant')), content TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'context', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', read_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS search_history(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 query TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type TEXT NOT NULL, label TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', meta_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recent_views(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('food','recipe','ingredient','scan','story')), item_id INTEGER NOT NULL,
 source_path TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 UNIQUE(user_id,item_type,item_id)
);
CREATE TABLE IF NOT EXISTS collections(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', accent TEXT NOT NULL DEFAULT '#123D3D', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(user_id,name)
);
CREATE TABLE IF NOT EXISTS collection_items(
 collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient')), item_id INTEGER NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(collection_id,item_type,item_id)
);
CREATE TABLE IF NOT EXISTS share_links(
 token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe')), item_id INTEGER NOT NULL,
 expires_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS item_likes(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient')), item_id INTEGER NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,item_type,item_id)
);
CREATE TABLE IF NOT EXISTS comments(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL CHECK(item_type IN('scan','food','recipe','ingredient')), item_id INTEGER NOT NULL,
 body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, email TEXT NOT NULL,
 event_type TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', transport TEXT NOT NULL DEFAULT '',
 detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_verification_tokens(
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_corrections(
 id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, original_title TEXT NOT NULL DEFAULT '',
 confirmed_food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, confirmed_name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_alternatives(
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE, food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 score REAL NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'knowledge', created_at TEXT NOT NULL, PRIMARY KEY(scan_id,food_id)
);
CREATE TABLE IF NOT EXISTS discovery_trails(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, path_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS follows(
 follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(follower_id,following_id), CHECK(follower_id<>following_id)
);
CREATE TABLE IF NOT EXISTS blocks(
 blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id)
);
CREATE TABLE IF NOT EXISTS moderation_reports(
 id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 target_type TEXT NOT NULL CHECK(target_type IN('scan','comment','profile','collection')), target_id INTEGER NOT NULL,
 reason TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','dismissed','actioned')),
 resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, resolved_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_collaborators(
 collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN('viewer','editor')), created_at TEXT NOT NULL,
 PRIMARY KEY(collection_id,user_id)
);
CREATE TABLE IF NOT EXISTS collection_share_links(
 token TEXT PRIMARY KEY, collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, revoked_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_saves(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,collection_id)
);
CREATE TABLE IF NOT EXISTS food_aliases(
 id INTEGER PRIMARY KEY AUTOINCREMENT, food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 alias TEXT NOT NULL COLLATE NOCASE, normalized TEXT NOT NULL COLLATE NOCASE, source TEXT NOT NULL DEFAULT 'curated',
 UNIQUE(food_id,normalized)
);
CREATE TABLE IF NOT EXISTS ai_usage(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
 feature TEXT NOT NULL, provider TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, latency_ms INTEGER NOT NULL DEFAULT 0,
 error_code TEXT NOT NULL DEFAULT '', estimated_units INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_recipes(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', cuisine_id INTEGER REFERENCES cuisines(id) ON DELETE SET NULL,
 category TEXT NOT NULL DEFAULT 'Main dish', prep_minutes INTEGER NOT NULL DEFAULT 0, cook_minutes INTEGER NOT NULL DEFAULT 0,
 servings INTEGER NOT NULL DEFAULT 2, difficulty TEXT NOT NULL DEFAULT 'Everyday', cover_url TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '',
 ingredients_json TEXT NOT NULL DEFAULT '[]', steps_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]',
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN('private','followers','public')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published')), parent_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
 parent_user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(user_id,slug)
);
CREATE TABLE IF NOT EXISTS recipe_media(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_recipe_id INTEGER NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
 media_type TEXT NOT NULL CHECK(media_type IN('image','video')), file_url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', step_index INTEGER,
 position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS posts(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_type TEXT NOT NULL DEFAULT 'food_story' CHECK(post_type IN('food_story','cooked_recipe','scan_share','collection_share')),
 caption TEXT NOT NULL DEFAULT '', food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
 user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL, scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
 collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL, cuisine_id INTEGER REFERENCES cuisines(id) ON DELETE SET NULL,
 visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN('followers','public')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_media(
 id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 media_type TEXT NOT NULL CHECK(media_type IN('image','video')), file_url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_likes(
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS post_comments(
 id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES post_comments(id) ON DELETE SET NULL,
 body TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations(
 id INTEGER PRIMARY KEY AUTOINCREMENT, created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL DEFAULT '', is_group INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_members(
 conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'member', last_read_at TEXT, joined_at TEXT NOT NULL, PRIMARY KEY(conversation_id,user_id)
);
CREATE TABLE IF NOT EXISTS messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL DEFAULT '',
 share_type TEXT CHECK(share_type IN('food','recipe','user_recipe','scan','collection','post') OR share_type IS NULL), share_id INTEGER,
 deleted_by_sender INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meal_plans(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL DEFAULT 'My meal plan', start_date TEXT NOT NULL, end_date TEXT NOT NULL, is_template INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meal_plan_entries(
 id INTEGER PRIMARY KEY AUTOINCREMENT, meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
 plan_date TEXT NOT NULL, meal_slot TEXT NOT NULL DEFAULT 'Dinner', recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
 user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL, food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
 title TEXT NOT NULL DEFAULT '', servings INTEGER NOT NULL DEFAULT 2, note TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shopping_lists(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,name)
);
CREATE TABLE IF NOT EXISTS shopping_list_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
 ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL, name TEXT NOT NULL, quantity REAL, unit TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Other', note TEXT NOT NULL DEFAULT '', checked INTEGER NOT NULL DEFAULT 0,
 source_type TEXT NOT NULL DEFAULT 'manual', source_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pantry_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL, name TEXT NOT NULL, quantity REAL, unit TEXT NOT NULL DEFAULT '',
 note TEXT NOT NULL DEFAULT '', expires_on TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cooking_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL, user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE SET NULL,
 cooked_on TEXT NOT NULL, rating INTEGER CHECK(rating BETWEEN 1 AND 5), would_make_again INTEGER, note TEXT NOT NULL DEFAULT '',
 photo_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recipe_ratings(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, recipe_type TEXT NOT NULL CHECK(recipe_type IN('knowledge','user')),
 recipe_id INTEGER NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), made_it INTEGER NOT NULL DEFAULT 0,
 review TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,recipe_type,recipe_id)
);
CREATE TABLE IF NOT EXISTS recipe_versions(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_recipe_id INTEGER NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
 version_no INTEGER NOT NULL, snapshot_json TEXT NOT NULL, change_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 UNIQUE(user_recipe_id,version_no)
);
CREATE TABLE IF NOT EXISTS user_recipe_saves(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, user_recipe_id INTEGER NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,user_recipe_id)
);
CREATE TABLE IF NOT EXISTS post_comment_likes(
 comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(comment_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_recipes_user ON user_recipes(user_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe ON recipe_versions(user_recipe_id,version_no DESC);
CREATE INDEX IF NOT EXISTS idx_user_recipe_saves_recipe ON user_recipe_saves(user_recipe_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comment_likes_comment ON post_comment_likes(comment_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id,created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id,created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id,conversation_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user ON meal_plans(user_id,start_date);
CREATE INDEX IF NOT EXISTS idx_meal_entries_plan_date ON meal_plan_entries(meal_plan_id,plan_date);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cooking_logs_user ON cooking_logs(user_id,cooked_on DESC);
CREATE INDEX IF NOT EXISTS idx_verification_user ON email_verification_tokens(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_corrections_scan ON scan_corrections(scan_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trails_user ON discovery_trails(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON moderation_reports(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_collab_user ON collection_collaborators(user_id,collection_id);
CREATE INDEX IF NOT EXISTS idx_alias_lookup ON food_aliases(normalized);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_recent_views_user ON recent_views(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_links_item ON share_links(item_type,item_id,revoked_at);
CREATE INDEX IF NOT EXISTS idx_item_likes_item ON item_likes(item_type,item_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(item_type,item_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_user ON email_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status,updated_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON analysis_jobs(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_saved_user_type ON saved_items(user_id,item_type,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,read_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine_id);
`); }

function tableColumns(table){
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(r=>r.name));
}
function ensureColumn(table,name,definition){
  const cols=tableColumns(table);
  if(!cols.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
function migrateSchema(){
  // Forward-compatible migrations for people upgrading an existing FoodSnap database.
  // CREATE TABLE IF NOT EXISTS does not add columns to tables created by older releases.
  ensureColumn('users','bio',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('users','avatar_url',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('users','onboarding_complete','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users','email_verified_at','TEXT');
  ensureColumn('users','profile_public','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('sessions','csrf_token',"TEXT NOT NULL DEFAULT ''");
  // Existing sessions from pre-CSRF builds need a usable token or all new mutations
  // (likes, comments, saves, settings) will be rejected until the user signs in again.
  for(const row of db.prepare("SELECT token FROM sessions WHERE csrf_token IS NULL OR csrf_token=''").all())
    db.prepare('UPDATE sessions SET csrf_token=? WHERE token=?').run(crypto.randomBytes(24).toString('hex'),row.token);
  ensureColumn('preferences','ai_detail',"TEXT NOT NULL DEFAULT 'balanced'");
  ensureColumn('preferences','notify_scan','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','notify_discovery','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','notify_likes','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','notify_comments','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','notify_replies','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','notify_follows','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','email_scan','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','email_social','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('preferences','data_retention',"TEXT NOT NULL DEFAULT 'keep'");
  ensureColumn('scans','guest_id','TEXT');
  ensureColumn('scans','confidence_label',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('scans','uncertainty_note',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('scans','provider_ref',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('scans','analysis_json',"TEXT NOT NULL DEFAULT '{}'");
  ensureColumn('scans','tags_json',"TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('scans','is_favorite','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('scans','user_note',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('scan_media','sha256',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('comments','parent_id','INTEGER');
  ensureColumn('comments','deleted_at','TEXT');
  ensureColumn('collections','visibility',"TEXT NOT NULL DEFAULT 'private'");
  ensureColumn('collections','cover_url',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('collection_items','position','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('preferences','message_privacy',"TEXT NOT NULL DEFAULT 'everyone'");
  ensureColumn('preferences','comment_privacy',"TEXT NOT NULL DEFAULT 'everyone'");
  ensureColumn('preferences','show_cooking_activity','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','notify_messages','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','notify_planning','INTEGER NOT NULL DEFAULT 1');
  ensureColumn('preferences','push_enabled','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('preferences','locale',"TEXT NOT NULL DEFAULT 'en'");
  ensureColumn('food_aliases','language',"TEXT NOT NULL DEFAULT 'en'");
  ensureColumn('food_aliases','country',"TEXT NOT NULL DEFAULT ''");
  ensureColumn('collections','is_smart','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('collections','rule_json',"TEXT NOT NULL DEFAULT '{}'");
  ensureColumn('meal_plans','household_id','INTEGER REFERENCES households(id) ON DELETE CASCADE');
  ensureColumn('shopping_lists','household_id','INTEGER REFERENCES households(id) ON DELETE CASCADE');
  ensureColumn('pantry_items','household_id','INTEGER REFERENCES households(id) ON DELETE CASCADE');
  ensureColumn('user_recipes','scheduled_at','TEXT');
  ensureColumn('user_recipes','published_at','TEXT');
  ensureColumn('posts','scheduled_at','TEXT');
  ensureColumn('posts','published_at','TEXT');
  ensureColumn('conversations','request_status',"TEXT NOT NULL DEFAULT 'accepted'");
  ensureColumn('conversations','initiated_by','INTEGER REFERENCES users(id) ON DELETE SET NULL');
  ensureColumn('conversations','accepted_at','TEXT');
}


const CUISINES = [
 ['west-african','West African','Africa','Layered heat, grains, stews, grilled foods and deeply seasoned sauces.','#B94331','/assets/food-jollof.svg'],
 ['east-african','East African','Africa','Griddled breads, legumes, slow-cooked stews, spice and fresh accompaniments.','#315675','/assets/food-bowl.svg'],
 ['north-african','North African','Africa','Aromatic spice blends, grains, preserved citrus and slow-cooked dishes.','#C78824','/assets/food-curry.svg'],
 ['south-asian','South Asian','Asia','Regional traditions shaped by spice, rice, breads, legumes, dairy and vegetables.','#8B3E2F','/assets/food-curry.svg'],
 ['east-asian','East Asian','Asia','Rice, noodles, fermented condiments, broths and precise seasonal preparations.','#214E4B','/assets/food-bowl.svg'],
 ['middle-eastern','Middle Eastern','Asia','Grains, legumes, herbs, grills, flatbreads and bright acidic condiments.','#8A6532','/assets/food-groundnut.svg'],
 ['mediterranean','Mediterranean','Europe / Africa / Asia','Vegetables, grains, olive oil, seafood, herbs and grilled preparations.','#2F5D9B','/assets/food-chicken.svg'],
 ['caribbean','Caribbean','Caribbean','Tropical produce, spice, rice, peas, seafood and slow-cooked or grilled meats.','#B94A38','/assets/food-fruit.svg'],
 ['latin-american','Latin American','Americas','Corn, beans, rice, chillies, herbs, grilled foods and region-specific sauces.','#B9822B','/assets/food-bowl.svg'],
 ['european','European','Europe','Broad regional traditions spanning breads, pasta, dairy, stews, roasts and pastry.','#4A5F70','/assets/food-chicken.svg']
];
const INGREDIENTS = [
 ['rice','Rice','A staple grain with thousands of varieties and textures.','Rice dishes, porridges, pilafs, bowls','Couscous, bulgur or cauliflower rice depending on the dish.','Store dry rice sealed in a cool, dry place.','Found across food cultures worldwide.','/assets/ingredient-rice.svg',['grain','staple']],
 ['tomato','Tomato','A fruit used as a savoury foundation, fresh garnish or concentrated sauce.','Sauces, stews, salads, rice dishes','Roasted red pepper can replace part of tomato in some sauces.','Refrigerate ripe cut tomatoes; whole tomatoes keep best at cool room temperature.','Central to countless cuisines after its global spread from the Americas.','/assets/ingredient-tomato.svg',['produce','sauce']],
 ['scotch-bonnet','Scotch bonnet','A fragrant hot chilli associated with fruity aroma and intense heat.','Pepper sauces, stews, marinades','Habanero is the closest common substitute.','Refrigerate fresh chillies dry and unwashed.','Used widely in West African and Caribbean cooking.','/assets/ingredient-pepper.svg',['chilli','spice']],
 ['plantain','Plantain','A starchy banana relative eaten at different stages of ripeness.','Fried, roasted, boiled, mashed','Firm banana is not equivalent; sweet potato can substitute texture in some dishes.','Keep at room temperature until desired ripeness.','Important across West/Central Africa, the Caribbean and Latin America.','/assets/ingredient-plantain.svg',['starch','produce']],
 ['chicken','Chicken','A versatile poultry protein used across cooking traditions.','Grilled, stewed, roasted, fried','Turkey, tofu or mushrooms can replace it depending on the recipe.','Keep refrigerated and cook safely before serving.','Used globally with strongly regional seasoning traditions.','/assets/ingredient-chicken.svg',['protein','poultry']],
 ['coconut-milk','Coconut milk','A rich liquid made by extracting grated coconut with water.','Curries, stews, soups, desserts','Cashew cream or dairy cream can replace richness where suitable.','Refrigerate opened coconut milk and use promptly.','Common in Southeast Asian, South Asian, East African and Caribbean cooking.','/assets/ingredient-coconut.svg',['coconut','rich']],
 ['oats','Oats','A cereal grain commonly rolled, steel-cut or milled.','Porridge, baking, granola','Quinoa flakes or millet porridge can substitute in some breakfasts.','Store airtight in a cool dry cupboard.','A global breakfast and baking staple.','/assets/ingredient-oats.svg',['grain','breakfast']],
 ['peanut','Peanut','A legume with rich flavour and high culinary versatility.','Stews, sauces, snacks, pastes','Sunflower seed butter can substitute in some recipes.','Store sealed; refrigerate natural peanut butter after opening if advised.','Groundnut-based sauces and stews are important in several African cuisines.','/assets/ingredient-peanut.svg',['legume','allergen']],
 ['mango','Mango','A fragrant tropical fruit ranging from tart and firm to soft and very sweet.','Fruit bowls, chutneys, smoothies, salads','Peach or pineapple can replace some sweetness and acidity.','Ripen at room temperature, then refrigerate ripe fruit.','Cultivated and enjoyed across tropical regions worldwide.','/assets/ingredient-mango.svg',['fruit','tropical']],
 ['spinach','Spinach','A tender leafy green that can be eaten raw or cooked.','Soups, stews, salads, curries','Ugu, kale or chard can substitute depending on texture desired.','Refrigerate dry leaves and use promptly.','Leafy greens are used broadly in soups, stews and side dishes.','/assets/ingredient-spinach.svg',['greens','produce']],
 ['chickpea','Chickpea','A nutty legume that holds shape well and also blends into smooth pastes.','Curries, stews, hummus, salads','White beans can substitute in many stews.','Store cooked chickpeas refrigerated; dry chickpeas keep sealed.','Important across South Asian, Middle Eastern, Mediterranean and global cooking.','/assets/ingredient-peanut.svg',['legume','protein']],
 ['onion','Onion','An aromatic allium used raw, browned, caramelised or blended.','Sauces, stocks, stews, salads','Shallot or leek can replace some aromatic function.','Store whole onions cool and dry; refrigerate cut onion.','One of the most widespread culinary aromatics.','/assets/ingredient-tomato.svg',['aromatic','produce']]
];
const FOODS = [
 ['jollof-rice','Jollof Rice','west-african','Rice dish','Tomato-pepper rice cooked in a seasoned base, with regional and household variations.','Common across West Africa; preparation, smoke, heat and accompaniments vary by place.','/assets/food-jollof.svg',['rice','tomato','pepper']],
 ['suya','Suya','west-african','Grilled food','Thin cuts of meat grilled with a peanut-forward spice blend and served with fresh accompaniments.','Strongly associated with Northern Nigerian street-food culture and enjoyed nationally.','/assets/food-chicken.svg',['grill','spice','nigerian']],
 ['egusi-soup','Egusi Soup','west-african','Soup / stew','A thick soup built around ground melon seed, greens and regional protein choices.','Prepared in different styles across Nigeria and neighbouring regions.','/assets/food-groundnut.svg',['soup','seed','nigerian']],
 ['groundnut-stew','Groundnut Stew','west-african','Stew','A savoury stew using peanut or groundnut paste with tomato, spice and vegetables or protein.','Groundnut stews appear in several West African traditions.','/assets/food-groundnut.svg',['peanut','stew']],
 ['pilau','East African Pilau','east-african','Rice dish','Spiced rice cooked with aromatics and often meat or vegetables.','A Swahili-coast favourite shaped by Indian Ocean trade and spice traditions.','/assets/food-bowl.svg',['rice','spice']],
 ['shakshuka','Shakshuka','north-african','Egg dish','Eggs cooked in a spiced tomato and pepper sauce.','Associated with North African and Middle Eastern food cultures with many variations.','/assets/food-curry.svg',['tomato','egg']],
 ['chana-masala','Chana Masala','south-asian','Legume dish','Chickpeas simmered with tomato, aromatics and spices.','A widely recognised South Asian chickpea preparation with regional variation.','/assets/food-curry.svg',['chickpea','spice']],
 ['biryani','Biryani','south-asian','Rice dish','Layered or cooked-together rice preparation with aromatics, spices and vegetables or meat.','Numerous regional traditions exist across South Asia.','/assets/food-bowl.svg',['rice','spice']],
 ['ramen','Ramen','east-asian','Noodle soup','Wheat noodles served in broth with toppings that vary by style.','Japanese ramen includes many regional broth, tare and noodle traditions.','/assets/food-bowl.svg',['noodles','broth']],
 ['bibimbap','Bibimbap','east-asian','Rice bowl','Rice topped with vegetables, sauce and often egg or meat, mixed before eating.','A Korean dish with many home and regional variations.','/assets/food-bowl.svg',['rice','vegetable']],
 ['hummus','Hummus','middle-eastern','Dip / spread','A smooth chickpea and tahini preparation with lemon and garlic.','Common across Levantine and broader Middle Eastern food cultures.','/assets/food-groundnut.svg',['chickpea','sesame']],
 ['falafel','Falafel','middle-eastern','Fried food','Seasoned ground chickpea or fava mixture formed and fried.','Regional versions vary in pulse, herbs and seasoning.','/assets/food-groundnut.svg',['chickpea','herbs']],
 ['paella','Paella','mediterranean','Rice dish','Spanish rice preparation associated particularly with Valencia and cooked in a wide shallow pan.','Many versions exist; Valencian traditions differ from seafood-focused versions.','/assets/food-bowl.svg',['rice','spanish']],
 ['jerk-chicken','Jerk Chicken','caribbean','Grilled food','Chicken seasoned with a hot, aromatic jerk profile and grilled or roasted.','Jerk is deeply associated with Jamaican culinary tradition.','/assets/food-chicken.svg',['chicken','grill','caribbean']],
 ['tacos','Tacos','latin-american','Handheld food','Filled tortillas with highly varied regional combinations.','Mexican taco traditions differ widely by region, tortilla and filling.','/assets/food-bowl.svg',['corn','mexican']],
 ['ratatouille','Ratatouille','european','Vegetable dish','A Provençal vegetable preparation centered on summer produce.','Associated with southern French cooking.','/assets/food-curry.svg',['vegetable','french']]
];
const RECIPES = [
 ['weeknight-jollof','Weeknight Jollof Rice','A deeply tomato-pepper rice with a smoky finish for a practical home kitchen.','west-african',20,45,4,'/assets/food-jollof.svg',[['Long-grain rice','2 cups'],['Tomatoes','5 medium'],['Red pepper','2'],['Scotch bonnet','1'],['Onion','2'],['Stock','2 cups']],['Blend tomatoes, peppers and one onion until smooth.','Cook the sauce until reduced and deeply coloured.','Stir in rice and stock; cover tightly.','Cook gently until the rice is tender, then rest before fluffing.'],['rice','tomato','pepper'],'FoodSnap Kitchen'],
 ['charred-chicken-plantain','Charred Chicken & Plantain','Pepper-marinated chicken with caramelised ripe plantain and bright tomato relish.','west-african',25,35,4,'/assets/food-chicken.svg',[['Chicken thighs','6'],['Ripe plantain','3'],['Scotch bonnet','1'],['Tomato','3'],['Lime','1']],['Marinate chicken with pepper, aromatics and lime.','Grill or roast until cooked through and charred at the edges.','Cook plantain until caramelised.','Serve with fresh tomato relish.'],['chicken','plantain','pepper'],'FoodSnap Kitchen'],
 ['coconut-chickpea-curry','Coconut Chickpea Curry','A fragrant pantry curry built around coconut milk, chickpeas and greens.','south-asian',15,30,4,'/assets/food-curry.svg',[['Chickpeas','2 cans'],['Coconut milk','400 ml'],['Spinach','3 cups'],['Tomato','3'],['Curry spice','2 tbsp']],['Cook aromatics and spices until fragrant.','Add tomato and reduce.','Stir in chickpeas and coconut milk; simmer.','Fold in spinach just before serving.'],['coconut-milk','chickpea','spinach','tomato'],'FoodSnap Kitchen'],
 ['mango-oat-bowl','Mango Oat Breakfast Bowl','Creamy oats with mango, toasted seeds and warm spice.','east-african',5,8,2,'/assets/food-fruit.svg',[['Rolled oats','1 cup'],['Milk or plant milk','2 cups'],['Mango','1'],['Seeds','2 tbsp']],['Simmer oats with milk until creamy.','Dice mango while oats cook.','Spoon into bowls and finish with mango and seeds.'],['oats','mango'],'FoodSnap Kitchen'],
 ['groundnut-greens-stew','Groundnut & Greens Stew','A rich peanut-based stew with tomato, leafy greens and warming spice.','west-african',20,35,4,'/assets/food-groundnut.svg',[['Peanut butter','1/2 cup'],['Tomato','4'],['Spinach','4 cups'],['Stock','3 cups'],['Pepper','to taste']],['Cook tomato and aromatics down to a thick base.','Whisk peanut butter with warm stock.','Combine and simmer gently.','Add greens and cook until tender.'],['peanut','spinach','tomato'],'FoodSnap Kitchen'],
 ['chana-masala-home','Chana Masala','A bright chickpea curry with tomato, ginger and warming spice.','south-asian',15,30,4,'/assets/food-curry.svg',[['Chickpeas','2 cans'],['Tomatoes','4'],['Onion','1'],['Ginger','2 tbsp'],['Spice blend','2 tbsp']],['Brown onion until golden.','Cook ginger and spices until fragrant.','Add tomato and reduce.','Add chickpeas and simmer until the sauce clings.'],['chickpea','tomato','onion'],'FoodSnap Kitchen']
];
const STORIES=[
 ['smoke-and-rice','Why smoke changes the way jollof tastes','Smoke is not only aroma. It changes how sweetness, acidity and spice arrive on the palate.','Food technique','/assets/food-jollof.svg','A short FoodSnap field note on heat, reduction, caramelisation and the flavour memories associated with party-style rice.'],
 ['plantain-ripeness','One fruit, four cooking personalities','Plantain moves from firm and starchy to deeply sweet as it ripens.','Ingredient field note','/assets/ingredient-plantain.svg','Green, yellow, spotted and nearly black plantain behave differently in the pan. Choosing ripeness is part of choosing the dish.'],
 ['global-rice','Rice is not one food','A grain can become jollof, pilau, biryani, paella or bibimbap depending on technique and context.','Food map','/assets/ingredient-rice.svg','FoodSnap follows ingredients across cuisines to show how technique and food culture transform the same starting point.']
];

function seedKnowledge(){
 if(db.prepare('SELECT COUNT(*) c FROM cuisines').get().c) return;
 const t=now(); db.exec('BEGIN');
 try{
  const ci=db.prepare('INSERT INTO cuisines(slug,name,region,description,accent,image_url) VALUES(?,?,?,?,?,?)');
  for(const x of CUISINES)ci.run(...x);
  const ii=db.prepare('INSERT INTO ingredients(slug,name,description,common_uses,substitutions,storage,culture_context,image_url,tags_json) VALUES(?,?,?,?,?,?,?,?,?)');
  for(const x of INGREDIENTS)ii.run(...x.slice(0,8),JSON.stringify(x[8]));
  const fi=db.prepare('INSERT INTO foods(slug,name,cuisine_id,category,description,context,image_url,tags_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  for(const x of FOODS){const c=db.prepare('SELECT id FROM cuisines WHERE slug=?').get(x[2]);fi.run(x[0],x[1],c?.id||null,x[3],x[4],x[5],x[6],JSON.stringify(x[7]),t)}
  const ri=db.prepare('INSERT INTO recipes(slug,title,description,cuisine_id,prep_minutes,cook_minutes,servings,image_url,ingredients_json,steps_json,tags_json,source_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for(const x of RECIPES){const c=db.prepare('SELECT id FROM cuisines WHERE slug=?').get(x[3]);ri.run(x[0],x[1],x[2],c?.id||null,x[4],x[5],x[6],x[7],JSON.stringify(x[8]),JSON.stringify(x[9]),JSON.stringify(x[10]),x[11],t)}
  const si=db.prepare('INSERT INTO editorial_stories(slug,title,deck,category,image_url,body,published_at) VALUES(?,?,?,?,?,?,?)');
  for(const x of STORIES)si.run(...x,t);
  const foodIng=db.prepare('INSERT OR IGNORE INTO food_ingredients(food_id,ingredient_id,relationship) VALUES(?,?,?)');
  const foodBySlug=s=>db.prepare('SELECT id FROM foods WHERE slug=?').get(s)?.id;
  const ingBySlug=s=>db.prepare('SELECT id FROM ingredients WHERE slug=?').get(s)?.id;
  const links={
    'jollof-rice':['rice','tomato','scotch-bonnet','onion'],'suya':['peanut','scotch-bonnet'],'egusi-soup':['spinach','onion'],'groundnut-stew':['peanut','tomato','spinach'],
    'pilau':['rice','onion'],'chana-masala':['chickpea','tomato','onion'],'biryani':['rice','onion'],'bibimbap':['rice','spinach'],'hummus':['chickpea'],
    'jerk-chicken':['chicken','scotch-bonnet'],'paella':['rice','tomato']
  };
  for(const [f,ings] of Object.entries(links)){const fid=foodBySlug(f);for(const s of ings){const iid=ingBySlug(s);if(fid&&iid)foodIng.run(fid,iid,'common')}}
  const recIng=db.prepare('INSERT OR IGNORE INTO recipe_ingredients(recipe_id,ingredient_id,amount) VALUES(?,?,?)');
  for(const r of RECIPES){const rid=db.prepare('SELECT id FROM recipes WHERE slug=?').get(r[0])?.id;for(const [name,amount] of r[8]){const slug=slugify(name).replace(/-thighs$|s$|es$/,'');const candidates=[slug,slugify(name), name.toLowerCase().includes('scotch')?'scotch-bonnet':'', name.toLowerCase().includes('plantain')?'plantain':'', name.toLowerCase().includes('chickpea')?'chickpea':'', name.toLowerCase().includes('coconut')?'coconut-milk':'', name.toLowerCase().includes('spinach')?'spinach':'', name.toLowerCase().includes('tomato')?'tomato':'', name.toLowerCase().includes('rice')?'rice':'', name.toLowerCase().includes('mango')?'mango':'', name.toLowerCase().includes('oat')?'oats':'', name.toLowerCase().includes('peanut')?'peanut':'', name.toLowerCase().includes('onion')?'onion':''];let iid;for(const c of candidates){if(c&&(iid=ingBySlug(c)))break}if(rid&&iid)recIng.run(rid,iid,amount)}}
  const fr=db.prepare('INSERT OR IGNORE INTO food_relationships(food_id,related_food_id,relation_type) VALUES(?,?,?)');
  [['jollof-rice','pilau'],['jollof-rice','biryani'],['pilau','biryani'],['chana-masala','hummus'],['suya','jerk-chicken'],['paella','jollof-rice'],['bibimbap','jollof-rice']].forEach(([a,b])=>{const x=foodBySlug(a),y=foodBySlug(b);if(x&&y){fr.run(x,y,'related');fr.run(y,x,'related')}});
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}
}


function enrichMergedKnowledge(){
 const t=now();
 const images={
  'jollof-rice':'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=84',
  'suya':'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1200&q=84',
  'shakshuka':'https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&w=1200&q=84',
  'hummus':'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=1200&q=84',
  'biryani':'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=1200&q=84',
  'ramen':'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=84',
  'jerk-chicken':'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=1200&q=84',
  'paella':'https://images.unsplash.com/photo-1534080564583-6be75777b70a?auto=format&fit=crop&w=1200&q=84',
  'ratatouille':'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?auto=format&fit=crop&w=1200&q=84'
 };
 const upd=db.prepare('UPDATE foods SET image_url=? WHERE slug=?'); for(const [slug,url] of Object.entries(images))upd.run(url,slug);
 const ingredientRows=[
  ['garlic','Garlic','An aromatic allium with sharp raw heat and deep sweetness after cooking.','Sauces, marinades, soups, braises','Asafoetida in tiny amounts or garlic chives in some dishes.','Store whole bulbs cool, dry and ventilated.','Used across food cultures worldwide.','/assets/ingredient-tomato.svg',['aromatic','allium']],
  ['ginger','Ginger','A warming rhizome with citrusy heat and floral aroma.','Curries, marinades, broths, drinks','Galangal offers a different but related aromatic profile.','Refrigerate fresh ginger dry or freeze peeled pieces.','Important across African, Asian and Caribbean cooking.','/assets/ingredient-pepper.svg',['aromatic','rhizome']],
  ['lentil','Lentil','A quick-cooking pulse available in varieties that range from creamy to firm.','Stews, dals, soups, salads','Split peas or beans depending on texture needed.','Store dry lentils airtight.','A staple across South Asian, Middle Eastern, African and European cuisines.','/assets/ingredient-peanut.svg',['legume','protein']],
  ['tahini','Tahini','A paste made from ground sesame seeds with a rich, slightly bitter nuttiness.','Hummus, dressings, sauces, desserts','Unsweetened seed or nut butter where appropriate.','Stir well and store according to the jar guidance.','Strongly associated with Levantine and Eastern Mediterranean cooking.','/assets/ingredient-peanut.svg',['sesame','paste']],
  ['eggplant','Eggplant','A soft-textured nightshade that absorbs flavour readily when cooked.','Stews, roasting, grilling, dips','Courgette or mushroom depending on dish.','Refrigerate and use while firm.','Used widely across Mediterranean, Middle Eastern, African and Asian cuisines.','/assets/ingredient-spinach.svg',['produce','vegetable']],
  ['palm-oil','Red palm oil','A vivid orange-red cooking oil with a distinctive flavour and colour.','Soups, stews, sauces','Neutral oil changes the flavour; paprika can add colour only.','Store sealed away from heat and direct light.','Important in several West and Central African food traditions.','/assets/ingredient-coconut.svg',['oil','west-african']],
  ['cilantro','Cilantro','A bright herb also known as coriander leaf.','Salsas, curries, garnishes, salads','Parsley or culantro depending on the dish.','Refrigerate with stems lightly hydrated.','Used across Latin American, South Asian, Middle Eastern and Southeast Asian cuisines.','/assets/ingredient-spinach.svg',['herb','fresh']],
  ['beef','Beef','Red meat used in grilled, braised, roasted, minced and stewed preparations.','Grills, stews, skewers, roasts','Lamb, mushrooms or plant protein depending on the preparation.','Keep refrigerated and follow safe handling guidance.','Prepared in highly varied ways worldwide.','/assets/ingredient-chicken.svg',['protein','meat']]
 ];
 const insI=db.prepare('INSERT OR IGNORE INTO ingredients(slug,name,description,common_uses,substitutions,storage,culture_context,image_url,tags_json) VALUES(?,?,?,?,?,?,?,?,?)');
 for(const x of ingredientRows)insI.run(...x.slice(0,8),JSON.stringify(x[8]));
 const foodRows=[
  ['moi-moi','Moi Moi','west-african','Steamed bean dish','A savoury steamed bean pudding made from peeled beans, peppers and aromatics.','A Nigerian dish served on its own or alongside rice and other foods.','https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=1200&q=84',['beans','steamed','nigerian']],
  ['waakye','Waakye','west-african','Rice and beans','Ghanaian rice and beans often served with layered sauces, proteins and accompaniments.','A highly customizable Ghanaian street and home food.','https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=84',['rice','beans','ghanaian']],
  ['injera-platter','Injera Platter','east-african','Shared platter','Tangy fermented flatbread used as both base and utensil for stews, lentils and vegetables.','Associated especially with Ethiopian and Eritrean dining traditions.','https://images.unsplash.com/photo-1567364816519-cbc9b4d04b12?auto=format&fit=crop&w=1200&q=84',['injera','lentil','ethiopian']],
  ['pad-thai','Pad Thai','east-asian','Noodle dish','Stir-fried rice noodles balanced with sweet, sour, salty and savoury flavours.','A globally recognised Thai noodle dish with many variations.','https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=1200&q=84',['noodles','peanut','thai']],
  ['tacos-al-pastor','Tacos al Pastor','latin-american','Taco','Tortillas filled with seasoned spit-roasted pork, often finished with pineapple, onion and cilantro.','A Mexican preparation shaped by spit-roasting traditions.','https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1200&q=84',['taco','mexican','grill']],
  ['arepa','Arepa','latin-american','Corn bread','Griddled corn cakes that can be split or topped with savoury fillings.','Strongly associated with Venezuelan and Colombian food cultures.','https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=1200&q=84',['corn','colombian','venezuelan']],
  ['fried-plantain','Fried Plantain','west-african','Side','Ripe plantain slices fried until caramelised outside and soft inside.','Common in many West African, Caribbean and Latin American meals.','https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=1200&q=84',['plantain','fried','side']]
 ];
 const insF=db.prepare('INSERT OR IGNORE INTO foods(slug,name,cuisine_id,category,description,context,image_url,tags_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
 for(const x of foodRows){const c=db.prepare('SELECT id FROM cuisines WHERE slug=?').get(x[2]);insF.run(x[0],x[1],c?.id||null,x[3],x[4],x[5],x[6],JSON.stringify(x[7]),t)}
 const recipeRows=[
  ['quick-shakshuka','Tomato Pepper Shakshuka','Eggs set into a warmly spiced tomato-pepper sauce.','north-african',10,25,4,images.shakshuka,[['Tomato','5'],['Onion','1'],['Garlic','3 cloves'],['Eggs','6']],['Soften onion and garlic.','Add tomato and spices; simmer until thick.','Make wells and add eggs.','Cover until whites set.'],['tomato','egg'],'FoodSnap Kitchen'],
  ['classic-hummus','Classic Hummus','Silky chickpea and sesame spread for dipping, spreading and building plates.','middle-eastern',10,0,6,images.hummus,[['Chickpeas','2 cups cooked'],['Tahini','1/3 cup'],['Garlic','1 clove']],['Blend tahini and lemon first.','Add chickpeas, garlic and salt.','Stream in cold water while blending until smooth.'],['chickpea','tahini'],'FoodSnap Kitchen'],
  ['home-biryani','Chicken Biryani','Aromatic layered rice and spiced chicken designed for a home kitchen.','south-asian',30,55,6,images.biryani,[['Rice','3 cups'],['Chicken','900 g'],['Onion','3'],['Ginger','1 piece'],['Garlic','6 cloves']],['Marinate chicken with aromatics and spices.','Parboil rice until just underdone.','Cook chicken until nearly tender.','Layer rice over chicken with herbs.','Cover tightly and steam on low heat.'],['rice','chicken','spice'],'FoodSnap Kitchen'],
  ['weeknight-pad-thai','Weeknight Pad Thai','Rice noodles tossed with a punchy sweet-sour sauce, herbs and peanuts.','east-asian',15,15,4,'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=1200&q=84',[['Peanut','1/2 cup'],['Garlic','3 cloves'],['Cilantro','1 bunch']],['Soak noodles until flexible.','Mix sauce ingredients.','Stir-fry aromatics and protein or vegetables.','Add noodles and sauce; toss over high heat.','Finish with peanuts and herbs.'],['noodles','peanut','thai'],'FoodSnap Kitchen'],
  ['ginger-garlic-ramen','Ginger Garlic Ramen','A fast aromatic noodle bowl built around ginger, garlic and savoury broth.','east-asian',10,20,2,images.ramen,[['Ginger','1 piece'],['Garlic','3 cloves'],['Onion','1']],['Sauté ginger, garlic and onion.','Add broth and simmer.','Cook noodles in the broth.','Finish with preferred vegetables, egg or protein.'],['noodle','broth'],'FoodSnap Kitchen'],
  ['caramelized-plantain','Caramelized Fried Plantain','Ripe plantain cooked until the edges are dark and the centres stay soft.','west-african',5,12,4,'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=1200&q=84',[['Plantain','3 ripe']],['Peel and slice plantain diagonally.','Heat oil to medium-high.','Fry in batches until deeply golden.','Drain and season lightly.'],['plantain','side'],'FoodSnap Kitchen']
 ];
 const insR=db.prepare('INSERT OR IGNORE INTO recipes(slug,title,description,cuisine_id,prep_minutes,cook_minutes,servings,image_url,ingredients_json,steps_json,tags_json,source_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const x of recipeRows){const c=db.prepare('SELECT id FROM cuisines WHERE slug=?').get(x[3]);insR.run(x[0],x[1],x[2],c?.id||null,x[4],x[5],x[6],x[7],JSON.stringify(x[8]),JSON.stringify(x[9]),JSON.stringify(x[10]),x[11],t)}
 const foodBy=s=>db.prepare('SELECT id FROM foods WHERE slug=?').get(s)?.id, ingBy=s=>db.prepare('SELECT id FROM ingredients WHERE slug=?').get(s)?.id;
 const fi=db.prepare('INSERT OR IGNORE INTO food_ingredients(food_id,ingredient_id,relationship) VALUES(?,?,?)');
 const links={'suya':['beef','peanut','onion'],'shakshuka':['tomato','onion','garlic'],'hummus':['chickpea','tahini','garlic'],'biryani':['rice','chicken','ginger','garlic','onion'],'ramen':['ginger','garlic','onion'],'pad-thai':['peanut','garlic','cilantro'],'tacos-al-pastor':['onion','cilantro'],'fried-plantain':['plantain'],'injera-platter':['lentil']};
 for(const [f,ings] of Object.entries(links)){const fid=foodBy(f);for(const n of ings){const iid=ingBy(n);if(fid&&iid)fi.run(fid,iid,'common')}}
 const fr=db.prepare('INSERT OR IGNORE INTO food_relationships(food_id,related_food_id,relation_type) VALUES(?,?,?)');
 for(const [a,b] of [['tacos','tacos-al-pastor'],['suya','tacos-al-pastor'],['fried-plantain','jerk-chicken'],['waakye','jollof-rice'],['pad-thai','ramen'],['injera-platter','groundnut-stew']]){const x=foodBy(a),y=foodBy(b);if(x&&y){fr.run(x,y,'related');fr.run(y,x,'related')}}
}


function enrichPolishedKnowledge(){
 const t=now();
 const insC=db.prepare('INSERT OR IGNORE INTO cuisines(slug,name,region,description,accent,image_url) VALUES(?,?,?,?,?,?)');
 for(const x of K41.cuisines) insC.run(...x);
 const insI=db.prepare('INSERT OR IGNORE INTO ingredients(slug,name,description,common_uses,substitutions,storage,culture_context,image_url,tags_json) VALUES(?,?,?,?,?,?,?,?,?)');
 for(const x of K41.ingredients) insI.run(...x.slice(0,8),JSON.stringify(x[8]));
 const cuisineId=slug=>db.prepare('SELECT id FROM cuisines WHERE slug=?').get(slug)?.id;
 const ingredientId=slug=>db.prepare('SELECT id FROM ingredients WHERE slug=?').get(slug)?.id;
 const foodId=slug=>db.prepare('SELECT id FROM foods WHERE slug=?').get(slug)?.id;
 const insF=db.prepare('INSERT OR IGNORE INTO foods(slug,name,cuisine_id,category,description,context,image_url,tags_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
 for(const x of K41.foods) insF.run(x[0],x[1],cuisineId(x[2])||null,x[3],x[4],x[5],x[6],JSON.stringify(x[7]),t);
 const fi=db.prepare('INSERT OR IGNORE INTO food_ingredients(food_id,ingredient_id,relationship) VALUES(?,?,?)');
 for(const x of K41.foods){const fid=foodId(x[0]);for(const slug of x[8]||[]){const iid=ingredientId(slug);if(fid&&iid)fi.run(fid,iid,'common')}}
 const insR=db.prepare('INSERT OR IGNORE INTO recipes(slug,title,description,cuisine_id,prep_minutes,cook_minutes,servings,image_url,ingredients_json,steps_json,tags_json,source_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const x of K41.recipes) insR.run(x[0],x[1],x[2],cuisineId(x[3])||null,x[4],x[5],x[6],x[7],JSON.stringify(x[8]),JSON.stringify(x[9]),JSON.stringify(x[10]),x[11],t);
 const recIng=db.prepare('INSERT OR IGNORE INTO recipe_ingredients(recipe_id,ingredient_id,amount) VALUES(?,?,?)');
 const alias={eggs:'egg',egg:'egg',beans:'beans',bean:'beans',chickpeas:'chickpea','coconut milk':'coconut-milk','soy sauce':'soy-sauce','palm oil':'palm-oil','olive oil':'olive-oil',tomatoes:'tomato',lemons:'lemon',limes:'lime',onions:'onion',plantains:'plantain'};
 for(const r of K41.recipes){const rid=db.prepare('SELECT id FROM recipes WHERE slug=?').get(r[0])?.id;if(!rid)continue;for(const [name,amount] of r[8]){let key=String(name).toLowerCase().trim();let slug=alias[key]||slugify(key).replace(/-cloves$|s$/,'');let iid=ingredientId(slug)||ingredientId(slugify(key));if(!iid){const terms=[['tomato','tomato'],['rice','rice'],['chicken','chicken'],['onion','onion'],['garlic','garlic'],['ginger','ginger'],['lentil','lentil'],['plantain','plantain'],['peanut','peanut'],['coconut','coconut-milk'],['fish','fish'],['beef','beef'],['lime','lime'],['lemon','lemon'],['egg','egg'],['flour','flour'],['bread','bread'],['cheese','cheese'],['yogurt','yogurt'],['cabbage','cabbage'],['pork','pork'],['corn','corn'],['beans','beans']];for(const [term,ref] of terms)if(key.includes(term)){iid=ingredientId(ref);break}}if(iid)recIng.run(rid,iid,amount)}}
 // Reconcile older broad records into the richer country-level paths where attribution is clear.
 const cuisineMoves={
  suya:'nigerian','egusi-soup':'nigerian','moi-moi':'nigerian',waakye:'ghanaian','injera-platter':'ethiopian','pad-thai':'thai','tacos-al-pastor':'mexican',
  'chana-masala':'indian',ramen:'japanese',bibimbap:'korean',paella:'spanish',ratatouille:'french','jerk-chicken':'caribbean'
 };
 const move=db.prepare('UPDATE foods SET cuisine_id=? WHERE slug=?');for(const [slug,cslug] of Object.entries(cuisineMoves)){const cid=cuisineId(cslug);if(cid)move.run(cid,slug)}
 // Build useful related-food edges from shared ingredients and cuisine without creating a dense all-to-all graph.
 const foods=db.prepare('SELECT id,cuisine_id FROM foods ORDER BY id').all();
 const rel=db.prepare('INSERT OR IGNORE INTO food_relationships(food_id,related_food_id,relation_type) VALUES(?,?,?)');
 for(const f of foods){const related=db.prepare(`SELECT f2.id,COUNT(*) shared FROM food_ingredients a JOIN food_ingredients b ON b.ingredient_id=a.ingredient_id JOIN foods f2 ON f2.id=b.food_id WHERE a.food_id=? AND f2.id<>? GROUP BY f2.id ORDER BY shared DESC,f2.id LIMIT 4`).all(f.id,f.id);for(const r of related)rel.run(f.id,r.id,'ingredient-neighbour');if(f.cuisine_id){for(const r of db.prepare('SELECT id FROM foods WHERE cuisine_id=? AND id<>? ORDER BY id LIMIT 3').all(f.cuisine_id,f.id))rel.run(f.id,r.id,'same-cuisine')}}
 // Upgrade older illustrated core ingredients to real photography while keeping local fallbacks available.
 const photoUpdates={rice:K41.photos.rice,tomato:K41.photos.produce,plantain:K41.photos.grill,chicken:K41.photos.chicken,'coconut-milk':K41.photos.curry,oats:K41.photos.breakfast,peanut:K41.photos.produce,mango:K41.photos.produce,spinach:K41.photos.salad,chickpea:K41.photos.hummus,onion:K41.photos.produce,garlic:K41.photos.produce,ginger:K41.photos.produce,lentil:K41.photos.stew,tahini:K41.photos.hummus,eggplant:K41.photos.produce,cilantro:K41.photos.salad,beef:K41.photos.grill};
 const ui=db.prepare('UPDATE ingredients SET image_url=? WHERE slug=?');for(const [slug,img] of Object.entries(photoUpdates))ui.run(img,slug);
}

function seedAliases(){
 const rows={
  'moi-moi':['Moin Moin','Moi-moi','Steamed bean pudding'],
  'jollof-rice':['Jollof','Party Jollof'],
  'suya':['Beef Suya','Nigerian Suya'],
  'fried-plantain':['Dodo','Fried ripe plantain'],
  'groundnut-stew':['Peanut stew','Groundnut soup'],
  'injera-platter':['Injera with wot','Ethiopian injera platter'],
  'hummus':['Homos','Hummus bi tahini'],
  'shakshuka':['Shakshouka'],
  'pad-thai':['Phat Thai'],
  'tacos-al-pastor':['Tacos al pastor','Al pastor tacos'],
  'ramen':['Japanese ramen'],
  'bibimbap':['Korean mixed rice']
 };
 const ins=db.prepare('INSERT OR IGNORE INTO food_aliases(food_id,alias,normalized,source) VALUES(?,?,?,?)');
 for(const [slug,aliases] of Object.entries(rows)){const f=db.prepare('SELECT id FROM foods WHERE slug=?').get(slug);if(!f)continue;for(const alias of aliases)ins.run(f.id,alias,slugify(alias),'curated')}
}

function seedKnowledgeSources(){
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='knowledge_sources'").get())return;
  const t=now(),ins=db.prepare('INSERT INTO knowledge_sources(entity_type,entity_id,source_name,source_url,notes,verified_at,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM knowledge_sources WHERE entity_type=? AND entity_id=? AND source_name=?)');
  const add=(type,id,name,url,notes,verified=null)=>ins.run(type,id,name,url||'',notes||'',verified,t,type,id,name);
  for(const x of db.prepare('SELECT id,name FROM cuisines').all())add('cuisine',x.id,'FoodSnap curated cuisine taxonomy','',`Editorial classification for ${x.name}; review cultural descriptions before material changes.`,t);
  for(const x of db.prepare('SELECT id,name FROM foods').all())add('food',x.id,'FoodSnap curated food knowledge','',`Curated FoodSnap identity and discovery record for ${x.name}.`,t);
  for(const x of db.prepare('SELECT id,name FROM ingredients').all())add('ingredient',x.id,'FoodSnap curated ingredient knowledge','',`Curated uses, storage and cuisine relationships for ${x.name}.`,t);
  for(const x of db.prepare('SELECT id,title,source_name,source_url FROM recipes').all())add('recipe',x.id,x.source_name||'FoodSnap Kitchen',x.source_url||'',x.source_url?'Imported or attributed recipe source.':'FoodSnap editorial recipe maintained as first-party cooking content.',t);
}
function bootstrapAdmin(){const email=process.env.FOODSNAP_ADMIN_EMAIL,password=process.env.FOODSNAP_ADMIN_PASSWORD;if(!email||!password)return;if(password.length<12)throw new Error('FOODSNAP_ADMIN_PASSWORD must be at least 12 characters.');if(db.prepare('SELECT 1 FROM users WHERE email=?').get(email))return;const t=now(),name=process.env.FOODSNAP_ADMIN_NAME||'FoodSnap Admin',username=process.env.FOODSNAP_ADMIN_USERNAME||'foodsnap-admin';const id=Number(db.prepare(`INSERT INTO users(name,username,email,password_hash,role,onboarding_complete,created_at,updated_at) VALUES(?,?,?,?,'admin',1,?,?)`).run(name,username,email,hashPassword(password),t,t).lastInsertRowid);db.prepare('INSERT INTO preferences(user_id,theme,updated_at) VALUES(?,?,?)').run(id,'system',t);}
initSchema(); migrateSchema(); runMigrations(db); seedKnowledge(); enrichMergedKnowledge(); enrichPolishedKnowledge(); seedAliases(); seedKnowledgeSources(); bootstrapAdmin();
module.exports={db,dbPath,now,hashPassword,verifyPassword,slugify,j,initSchema,migrateSchema,seedKnowledge};
