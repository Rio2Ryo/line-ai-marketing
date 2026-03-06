-- schema-v23: KV cache table + performance indexes

-- D1-based cache table (replaces KV when permission not available)
CREATE TABLE IF NOT EXISTS kv_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kv_cache_expires ON kv_cache(expires_at);

-- ─── Performance indexes for heavy query patterns ───

-- delivery_logs: date-range queries in stats/reports/analytics
CREATE INDEX IF NOT EXISTS idx_dl_created_at ON delivery_logs(created_at);
-- delivery_logs: COUNT DISTINCT user_id in reports
CREATE INDEX IF NOT EXISTS idx_dl_user_id ON delivery_logs(user_id);
-- delivery_logs: GROUP BY scenario_id in analytics/reports
CREATE INDEX IF NOT EXISTS idx_dl_scenario_id ON delivery_logs(scenario_id);
-- delivery_logs: compound for status + date range
CREATE INDEX IF NOT EXISTS idx_dl_status_created ON delivery_logs(status, created_at);

-- messages: compound for direction + date filtering (stats/analytics/widgets)
CREATE INDEX IF NOT EXISTS idx_messages_direction_sent ON messages(direction, sent_at);

-- users: status filter (very common in COUNT queries)
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
-- users: created_at for new friends queries
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- notifications: unread count query optimization
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- rate_limit_logs: stats queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_created ON rate_limit_logs(created_at);
-- rate_limit_logs: event type filter
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_type ON rate_limit_logs(event_type);

-- ai_chat_logs: date range queries in analytics
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_date ON ai_chat_logs(created_at);

-- conversions: date range queries
CREATE INDEX IF NOT EXISTS idx_conversions_date ON conversions(converted_at);
