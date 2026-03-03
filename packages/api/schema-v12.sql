-- schema-v12: Delivery Retry (配信リトライ)

ALTER TABLE delivery_logs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE delivery_logs ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;
ALTER TABLE delivery_logs ADD COLUMN next_retry_at TEXT;

CREATE INDEX IF NOT EXISTS idx_delivery_logs_next_retry ON delivery_logs(status, next_retry_at);
