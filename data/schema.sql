-- Database Schema for Project Delta (Entropia Universe)
-- Version: 1.0
-- Created: November 12, 2025
-- Compatible with: SQLite 3.x AND PostgreSQL 14+

-- ==================== GAME DATA TABLES ====================

-- Table 1: Mobs (Creatures)
CREATE TABLE IF NOT EXISTS mobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  planet TEXT NOT NULL,
  hp INTEGER,
  maturity TEXT,
  min_damage INTEGER,
  max_damage INTEGER,
  loot_table TEXT,  -- JSON array of possible loot items
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mobs_planet ON mobs(planet);
CREATE INDEX IF NOT EXISTS idx_mobs_name ON mobs(name);

-- Table 2: Items (Materials, Weapons, Armor, Tools)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  tt_value REAL,
  stackable INTEGER DEFAULT 0,  -- Boolean: 0=false, 1=true
  max_stack INTEGER,
  weight REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

-- Table 3: Markups (Time-series pricing data)
CREATE TABLE IF NOT EXISTS markups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  planet TEXT,
  day REAL,
  week REAL,
  month REAL,
  year REAL,
  sample_size INTEGER,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id)
);
CREATE INDEX IF NOT EXISTS idx_markups_item ON markups(item_id, recorded_at DESC);

-- Table 4: Blueprints (Crafting recipes)
CREATE TABLE IF NOT EXISTS blueprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  markup REAL,
  crafting_cost REAL,
  output_value REAL,
  materials_required TEXT,  -- JSON array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blueprints_name ON blueprints(name);
CREATE INDEX IF NOT EXISTS idx_blueprints_markup ON blueprints(markup DESC);

-- Table 5: Mob Spawns (Location data)
CREATE TABLE IF NOT EXISTS mob_spawns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mob_name TEXT NOT NULL,
  planet TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  density TEXT,  -- high, medium, low
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_spawns_mob ON mob_spawns(mob_name);
CREATE INDEX IF NOT EXISTS idx_spawns_planet ON mob_spawns(planet);
CREATE INDEX IF NOT EXISTS idx_spawns_location ON mob_spawns(latitude, longitude);

-- ==================== USER TRACKING DATA ====================

-- Table 6: Hunting Sessions (Session metadata)
CREATE TABLE IF NOT EXISTS hunting_sessions (
  id TEXT PRIMARY KEY,  -- UUID
  user_id TEXT NOT NULL,
  mob_name TEXT NOT NULL,
  planet TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  total_kills INTEGER DEFAULT 0,
  total_loot_value REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  evpk REAL,  -- Expected Value Per Kill
  is_public INTEGER DEFAULT 1,  -- Boolean
  stats TEXT,  -- JSON: full session stats
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON hunting_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_mob ON hunting_sessions(mob_name, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_planet ON hunting_sessions(planet, start_time DESC);

-- Table 7: Loot Events (Individual loot drops)
CREATE TABLE IF NOT EXISTS loot_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  item_id INTEGER,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  tt_value REAL,
  markup REAL,
  market_value REAL,
  timestamp TIMESTAMP NOT NULL,
  FOREIGN KEY (session_id) REFERENCES hunting_sessions(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);
CREATE INDEX IF NOT EXISTS idx_loot_session ON loot_events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_loot_item ON loot_events(item_id, timestamp DESC);

-- Table 8: Globals (Jackpot events)
CREATE TABLE IF NOT EXISTS globals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL,
  mob_name TEXT NOT NULL,
  value REAL NOT NULL,
  planet TEXT,
  timestamp TIMESTAMP NOT NULL,
  session_id TEXT,  -- Link to session if own global
  user_id TEXT,
  FOREIGN KEY (session_id) REFERENCES hunting_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_globals_timestamp ON globals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_globals_mob ON globals(mob_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_globals_player ON globals(player);

-- ==================== SOCIAL PLATFORM DATA ====================

-- Table 9: Profiles (Public user profiles)
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,  -- UUID from auth system
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  favorite_mob TEXT,
  favorite_planet TEXT,
  is_public INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Table 10: User Stats (Aggregated statistics)
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY,
  total_kills INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_profit REAL DEFAULT 0,
  avg_evpk REAL DEFAULT 0,
  total_globals INTEGER DEFAULT 0,
  highest_global REAL DEFAULT 0,
  last_session_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);

-- Table 11: Subscriptions (Payment tiers)
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,  -- free, premium, pro
  stripe_subscription_id TEXT,
  status TEXT,  -- active, canceled, expired
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Table 12: Achievements (Milestone badges)
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  achievement_type TEXT NOT NULL,  -- first_global, 1000_kills, etc.
  achievement_name TEXT NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,  -- JSON with achievement details
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id, earned_at DESC);

-- Table 13: Follows (Social graph)
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES profiles(user_id),
  FOREIGN KEY (following_id) REFERENCES profiles(user_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- Table 14: Leaderboards (Cached rankings)
CREATE TABLE IF NOT EXISTS leaderboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,  -- most_profitable, most_kills, etc.
  user_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  period TEXT NOT NULL,  -- daily, weekly, monthly, all_time
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboards_category ON leaderboards(category, period, rank);

-- Table 15: Session Comments (Community discussion)
CREATE TABLE IF NOT EXISTS session_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES hunting_sessions(id),
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);
CREATE INDEX IF NOT EXISTS idx_comments_session ON session_comments(session_id, created_at DESC);

-- ==================== END OF SCHEMA ====================
