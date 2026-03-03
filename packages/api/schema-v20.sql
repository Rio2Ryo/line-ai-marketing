-- Schema v20: API request logs for usage monitoring
CREATE TABLE IF NOT EXISTS api_request_logs (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at ON api_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_path ON api_request_logs(path);
