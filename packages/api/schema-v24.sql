-- Schema v24: Webhook Events table for realtime processing dashboard
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,           -- message, follow, unfollow, postback, etc.
  source_type TEXT DEFAULT 'user',    -- user, group, room
  source_user_id TEXT,                -- LINE user ID
  internal_user_id TEXT,              -- Our DB user ID (resolved after processing)
  message_type TEXT,                  -- text, image, video, etc. (for message events)
  summary TEXT,                       -- Human-readable summary
  stage TEXT NOT NULL DEFAULT 'received', -- received, parsed, processing, responded, completed, error
  processing_ms INTEGER,             -- Total processing time in ms
  raw_json TEXT,                      -- Full raw event JSON
  response_json TEXT,                 -- Response sent back
  error_message TEXT,                 -- Error details if failed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_stage ON webhook_events(stage);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source_user_id);
