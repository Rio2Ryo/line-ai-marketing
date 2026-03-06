-- Schema v25: Multi-tenant support - LINE account management
CREATE TABLE IF NOT EXISTS line_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel_id TEXT,
  channel_secret TEXT,
  channel_access_token TEXT,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_account_access (
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, account_id),
  FOREIGN KEY (account_id) REFERENCES line_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_account_access_account ON user_account_access(account_id);
CREATE INDEX IF NOT EXISTS idx_line_accounts_active ON line_accounts(is_active);

-- Insert default account from existing environment config
INSERT OR IGNORE INTO line_accounts (id, name, is_default, is_active)
VALUES ('default', 'Default Account', 1, 1);
