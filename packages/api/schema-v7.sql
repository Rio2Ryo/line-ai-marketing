CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  scenario_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'running', 'completed', 'cancelled')),
  total_recipients INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  winner_variation_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ab_test_variations (
  id TEXT PRIMARY KEY,
  ab_test_id TEXT NOT NULL,
  name TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  message_content TEXT NOT NULL,
  distribution_rate INTEGER NOT NULL DEFAULT 50,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_abt_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_abtv_test ON ab_test_variations(ab_test_id);
