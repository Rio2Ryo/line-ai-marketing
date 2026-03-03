-- schema-v16: リアルタイムチャット (既読管理)
CREATE TABLE IF NOT EXISTS chat_read_status (
  user_id TEXT PRIMARY KEY,
  last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_read_user ON chat_read_status(user_id);
