import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../src/index.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../migrations/0003_security_governance.sql",import.meta.url),"utf8");
test("new schools require approval",()=>{assert.match(migration,/verification_status.*DEFAULT 'PENDING'/);assert.match(worker,/verification_status='APPROVED'/);});
test("approval endpoint requires server secret",()=>{assert.match(worker,/PLATFORM_APPROVAL_KEY/);assert.match(worker,/x-platform-approval-key/);});
test("attendance corrections are logged atomically",()=>{assert.match(worker,/INSERT INTO attendance_changes/);assert.match(worker,/await env.DB.batch\(statements\)/);assert.match(worker,/A correction reason/);});
test("privacy requests are school scoped",()=>{assert.match(worker,/INSERT INTO privacy_requests\(school_id,requester_id/);assert.match(worker,/FROM privacy_requests WHERE school_id=\?/);});
