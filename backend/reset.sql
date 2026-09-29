-- Reset the Maestro School Attendance database to a fresh first-run state.
-- Keeps the schema and migration history intact.

DELETE FROM attendance_changes;
DELETE FROM attendance_records;
DELETE FROM attendance_sessions;
DELETE FROM teacher_period_attendance;
DELETE FROM teacher_class_assignments;
DELETE FROM sessions;
DELETE FROM audit_logs;
DELETE FROM students;
DELETE FROM users;
DELETE FROM school_settings;
DELETE FROM classes;
DELETE FROM grades;
DELETE FROM schools;

DELETE FROM sqlite_sequence
WHERE name IN (
  'attendance_changes',
  'attendance_records',
  'attendance_sessions',
  'teacher_period_attendance',
  'teacher_class_assignments',
  'sessions',
  'audit_logs',
  'students',
  'users',
  'classes',
  'grades',
  'schools'
);
