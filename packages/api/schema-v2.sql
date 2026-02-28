CREATE TABLE IF NOT EXISTS delivery_logs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT,
  scenario_step_id TEXT,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  scheduled_at TEXT,
  sent_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dl_status ON delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_dl_sched ON delivery_logs(scheduled_at);

CREATE TABLE IF NOT EXISTS user_attributes (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
