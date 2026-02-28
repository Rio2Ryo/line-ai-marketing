-- Phase 3: AI Chat Logs + Escalation Schema

-- AI chat logs for tracking AI responses
CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_id TEXT,
  user_message TEXT NOT NULL,
  ai_reply TEXT NOT NULL,
  confidence REAL DEFAULT 0,
  should_escalate INTEGER DEFAULT 0,
  knowledge_ids TEXT,
  model TEXT DEFAULT 'claude-3-5-haiku',
  response_time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_escalate ON ai_chat_logs(should_escalate);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_chat_logs(created_at);

-- Escalation queue
CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ai_chat_log_id TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','assigned','resolved','closed')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  note TEXT,
  assigned_to TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_chat_log_id) REFERENCES ai_chat_logs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_user ON escalations(user_id);
