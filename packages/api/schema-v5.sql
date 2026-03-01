CREATE TABLE IF NOT EXISTS scheduled_deliveries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  message_content TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('all', 'segment', 'tag')),
  target_config TEXT,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sd_status ON scheduled_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_sd_scheduled ON scheduled_deliveries(scheduled_at);
