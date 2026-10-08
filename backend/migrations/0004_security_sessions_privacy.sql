ALTER TABLE sessions ADD COLUMN last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_sessions_user_school ON sessions(school_id,user_id);
ALTER TABLE privacy_requests ADD COLUMN resolved_at TEXT;
ALTER TABLE privacy_requests ADD COLUMN resolution_note TEXT;
