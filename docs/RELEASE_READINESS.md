# Maestro release readiness (development only)

Repository: Mhd-Azeem/iOS-team-maestro
Development branch: claude/team-maestro-exam-ios-yc6u56

## Do not deploy yet

No production Worker deploy or remote D1 migration is authorized as part of this work.

## Backend validation (local only)

```sh
cd backend
npm install
npm run check
node --test tests/*.test.mjs
npx wrangler d1 migrations apply maestro-school-attendance-db --local --persist-to .wrangler/local-verification
npx wrangler d1 execute maestro-school-attendance-db --local --persist-to .wrangler/local-verification --command "PRAGMA foreign_key_check;"
```

## Frontend validation

```sh
cd web
npm install
npm run build
```

## Release blockers

- Execute and inspect GitHub Actions checks, and resolve any failures.
- Add database-backed integration tests for two distinct schools, including cross-tenant reads, writes, role changes, and sessions.
- Test concurrent school registration and rollback behavior under D1 failures.
- Verify attendance submission is atomic and retains a full edit history.
- Complete frontend pages for subjects, periods, calendar, notifications, and administrative account management.
- Confirm whether an iOS target exists; the current README describes web/PWA and Android, not a verified native iOS build.
- Confirm Android packaging/signing and Play Store requirements if publishing Android.
- Perform accessibility, security, performance and backup/restore verification.
- Obtain explicit production deployment authorization separately.
