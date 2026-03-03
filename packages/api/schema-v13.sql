-- schema-v13: ユーザー行動スコアリング (エンゲージメントスコア)
CREATE TABLE IF NOT EXISTS engagement_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  total_score REAL NOT NULL DEFAULT 0,
  rank TEXT NOT NULL DEFAULT 'D',
  message_score REAL NOT NULL DEFAULT 0,
  engagement_score REAL NOT NULL DEFAULT 0,
  conversion_score REAL NOT NULL DEFAULT 0,
  retention_score REAL NOT NULL DEFAULT 0,
  calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_engagement_scores_user ON engagement_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_scores_rank ON engagement_scores(rank);
CREATE INDEX IF NOT EXISTS idx_engagement_scores_total ON engagement_scores(total_score DESC);
