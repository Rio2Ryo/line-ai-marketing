CREATE TABLE IF NOT EXISTS auto_response_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('keyword', 'exact_match', 'regex')),
  trigger_pattern TEXT NOT NULL,
  response_type TEXT NOT NULL DEFAULT 'text' CHECK(response_type IN ('text', 'survey', 'richmenu')),
  response_content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_arr_active ON auto_response_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_arr_priority ON auto_response_rules(priority DESC);
