-- schema-v17: ダッシュボードウィジェット
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  widget_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  size TEXT NOT NULL DEFAULT 'small',
  is_visible INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_owner ON dashboard_widgets(owner_id);
