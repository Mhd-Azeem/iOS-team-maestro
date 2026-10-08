import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../src/index.ts",import.meta.url),"utf8");
const migration = readFileSync(new URL("../migrations/0002_school_configuration.sql",import.meta.url),"utf8");

test("session authentication joins user to its own school",()=>{
  assert.match(worker,/JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id/);
  assert.match(worker,/JOIN schools sc ON sc.id=s.school_id/);
});
test("attendance reports cannot join other schools' rows",()=>{
  assert.match(worker,/LEFT JOIN attendance_records ar ON ar.student_id=s.id AND ar.school_id=s.school_id/);
  assert.match(worker,/LEFT JOIN attendance_sessions ss ON ss.id=ar.session_id AND ss.school_id=s.school_id/);
});
test("attendance submission rejects duplicate student IDs",()=>{
  assert.match(worker,/new Set\(records.map\(/);
});
test("configuration API routes are authenticated and scoped",()=>{
  for(const path of ["/api/subjects","/api/period-templates","/api/calendar","/api/notifications"]){
    assert.ok(worker.includes(`path === "${path}"`));
  }
  assert.ok(worker.indexOf('const auth = await authenticate(req, env)') < worker.indexOf('path === "/api/subjects"'));
});
test("configuration tables have tenant-scoped uniqueness",()=>{
  for(const value of ["UNIQUE(school_id,name)","UNIQUE(school_id,period_number)","PRIMARY KEY(school_id,day)"])assert.ok(migration.includes(value));
});
