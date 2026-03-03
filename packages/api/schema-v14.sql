-- schema-v14: 配信キュー管理 (バッチ分割 + スロットリング + 進捗管理)
CREATE TABLE IF NOT EXISTS delivery_queues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  target_type TEXT NOT NULL DEFAULT 'all',
  target_config TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 50,
  throttle_ms INTEGER NOT NULL DEFAULT 200,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS delivery_queue_items (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  error_message TEXT,
  FOREIGN KEY (queue_id) REFERENCES delivery_queues(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_queues_status ON delivery_queues(status);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_items_queue ON delivery_queue_items(queue_id, status);
