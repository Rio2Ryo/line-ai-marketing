-- schema-v8: Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_auto_reply', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('escalation_notify', 'true');
