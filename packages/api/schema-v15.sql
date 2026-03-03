-- schema-v15: 友だち追加経路分析
CREATE TABLE IF NOT EXISTS follow_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'qr',
  source_code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS follow_events (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  user_id TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  followed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES follow_sources(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_follow_sources_code ON follow_sources(source_code);
CREATE INDEX IF NOT EXISTS idx_follow_events_source ON follow_events(source_id);
CREATE INDEX IF NOT EXISTS idx_follow_events_user ON follow_events(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_events_date ON follow_events(followed_at);
