PRAGMA defer_foreign_keys = ON;

CREATE TABLE students_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  admission_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  grade_id INTEGER,
  class_id INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (grade_id) REFERENCES grades(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  UNIQUE(school_id, admission_number)
);

INSERT INTO students_new (
  id, school_id, admission_number, full_name, grade_id, class_id, status, created_at, updated_at
)
SELECT
  id, school_id, admission_number, full_name, grade_id, class_id, status, created_at, updated_at
FROM students;

DROP TABLE students;
ALTER TABLE students_new RENAME TO students;

CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id,class_id);

PRAGMA defer_foreign_keys = OFF;
