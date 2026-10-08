-- Per-school configuration; no changes to the existing school or attendance data.
CREATE TABLE IF NOT EXISTS school_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id,name)
);
CREATE INDEX IF NOT EXISTS school_subjects_school_idx ON school_subjects(school_id,active);
CREATE TABLE IF NOT EXISTS school_period_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL CHECK(period_number BETWEEN 1 AND 24),
  label TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  UNIQUE(school_id,period_number),
  CHECK(starts_at IS NULL OR starts_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  CHECK(ends_at IS NULL OR ends_at GLOB '[0-2][0-9]:[0-5][0-9]')
);
CREATE TABLE IF NOT EXISTS school_calendar_days (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  day_type TEXT NOT NULL CHECK(day_type IN ('SCHOOL_DAY','WEEKEND','HOLIDAY','SPECIAL_HOLIDAY','SPECIAL_SCHOOL_DAY')),
  label TEXT,
  created_by INTEGER REFERENCES users(id),
  PRIMARY KEY(school_id,day)
);
CREATE TABLE IF NOT EXISTS school_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS school_notifications_school_idx ON school_notifications(school_id,created_at);
