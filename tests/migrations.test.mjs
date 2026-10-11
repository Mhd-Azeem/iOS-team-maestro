import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
test('all migrations apply in isolated SQLite without foreign-key violations',()=>{const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../backend/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../backend/migrations/'+file,import.meta.url),'utf8'));assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name IN ('schools','users','students','attendance_sessions','attendance_records')").get().n,5)});
