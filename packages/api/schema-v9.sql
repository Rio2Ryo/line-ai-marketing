-- schema-v9: AI classification results
CREATE TABLE IF NOT EXISTS ai_classifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  suggested_tags TEXT NOT NULL,
  reasoning TEXT,
  segment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','dismissed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
