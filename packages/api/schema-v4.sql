-- Survey forms
CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Survey questions
CREATE TABLE IF NOT EXISTS survey_questions (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  question_type TEXT NOT NULL CHECK(question_type IN ('text', 'single_choice', 'multiple_choice', 'rating')),
  question_text TEXT NOT NULL,
  options_json TEXT,
  is_required INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sq_survey ON survey_questions(survey_id);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  submitted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sr_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_sr_user ON survey_responses(user_id);
