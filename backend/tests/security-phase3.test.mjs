import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../src/index.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../migrations/0004_security_sessions_privacy.sql",import.meta.url),"utf8");
test("session access requires same school and idle activity",()=>{
 assert.match(worker,/u\.school_id=s\.school_id/);
 assert.match(worker,/s\.last_seen_at>datetime\('now','-12 hours'\)/);
 assert.match(worker,/DELETE FROM sessions WHERE id=\? AND user_id=\? AND school_id=\?/);
});
test("privacy review requires admin and school scope",()=>{
 assert.match(worker,/School administrator required/);
 assert.match(worker,/WHERE id=\? AND school_id=\? AND status IN/);
 assert.match(migration,/resolution_note/);
});
