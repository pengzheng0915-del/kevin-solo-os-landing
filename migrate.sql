ALTER TABLE quiz_results ADD COLUMN version TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE quiz_results ADD COLUMN result_scores TEXT DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_quiz_results_version ON quiz_results (version);
