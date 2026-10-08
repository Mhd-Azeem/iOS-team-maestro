-- New schools must be approved before login. Existing schools require manual review.
ALTER TABLE schools ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(verification_status IN ('PENDING','APPROVED','REJECTED','SUSPENDED'));
ALTER TABLE schools ADD COLUMN verification_reviewed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_school_verification ON schools(verification_status);
CREATE TABLE IF NOT EXISTS platform_approval_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 school_id INTEGER NOT NULL REFERENCES schools(id),
 status TEXT NOT NULL,
 note TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS privacy_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 school_id INTEGER NOT NULL REFERENCES schools(id),
 requester_id INTEGER NOT NULL REFERENCES users(id),
 request_type TEXT NOT NULL CHECK(request_type IN ('ACCESS','CORRECTION','ERASURE')),
 details TEXT,
 status TEXT NOT NULL DEFAULT 'RECEIVED',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_school ON privacy_requests(school_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_time ON audit_logs(school_id,created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_changes_school_time ON attendance_changes(school_id,changed_at);
