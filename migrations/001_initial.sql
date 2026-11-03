-- Portable PostgreSQL / SQLite migration. JSON is validated by the typed server.
-- Server-only access: clients never receive SQL credentials or table permissions.
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT,created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,expires_at BIGINT NOT NULL,access_token TEXT,refresh_token TEXT);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id),name TEXT NOT NULL,data TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS characters_name_ci ON characters(lower(name));
CREATE TABLE IF NOT EXISTS inventory(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,item_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0 AND quantity<=9999),PRIMARY KEY(character_id,item_id));
CREATE TABLE IF NOT EXISTS farming_plots(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,plot_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(character_id,plot_id));
CREATE TABLE IF NOT EXISTS furniture_placements(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(character_id,id));
CREATE TABLE IF NOT EXISTS quest_progress(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,chapter INTEGER NOT NULL CHECK(chapter BETWEEN 0 AND 6),accepted INTEGER NOT NULL,kills INTEGER NOT NULL,clue INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS guilds(id TEXT PRIMARY KEY,name TEXT NOT NULL,leader TEXT NOT NULL REFERENCES characters(id));
CREATE UNIQUE INDEX IF NOT EXISTS guild_name_ci ON guilds(lower(name));
CREATE TABLE IF NOT EXISTS guild_members(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS guild_members_guild ON guild_members(guild_id);
CREATE TABLE IF NOT EXISTS dungeon_completions(character_id TEXT NOT NULL REFERENCES characters(id),instance_id TEXT NOT NULL,rewarded_at BIGINT NOT NULL,PRIMARY KEY(character_id,instance_id));
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,reporter TEXT NOT NULL REFERENCES profiles(id),target TEXT NOT NULL,reason TEXT NOT NULL,created_at BIGINT NOT NULL);
