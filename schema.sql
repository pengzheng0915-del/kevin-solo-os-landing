CREATE TABLE IF NOT EXISTS quiz_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL DEFAULT 'unknown',
  answers TEXT NOT NULL DEFAULT '{}',
  result_type TEXT DEFAULT '',
  result_score INTEGER DEFAULT 0,
  result_scores TEXT DEFAULT '{}',
  nickname TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_results_session ON quiz_results (session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_created ON quiz_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_version ON quiz_results (version);
