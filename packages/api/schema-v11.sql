-- schema-v11: Conversion Tracking (コンバージョントラッキング)

CREATE TABLE IF NOT EXISTS conversion_goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL DEFAULT 'url_visit', -- url_visit, purchase, form_submit, custom
  goal_config TEXT, -- JSON: { url_pattern, form_id, custom_event, ... }
  scenario_id TEXT, -- optional: link to a scenario
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scenario_id TEXT, -- which scenario led to this conversion
  delivery_log_id TEXT, -- which delivery led to this conversion
  value REAL DEFAULT 0, -- monetary value if applicable
  metadata TEXT, -- JSON: extra data
  converted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (goal_id) REFERENCES conversion_goals(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_conversions_goal_id ON conversions(goal_id);
CREATE INDEX IF NOT EXISTS idx_conversions_user_id ON conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversions_converted_at ON conversions(converted_at);
CREATE INDEX IF NOT EXISTS idx_conversions_scenario_id ON conversions(scenario_id);
