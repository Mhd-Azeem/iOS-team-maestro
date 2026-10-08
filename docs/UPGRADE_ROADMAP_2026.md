# Maestro staged upgrade plan (October 2026)

Production Cloudflare Worker and D1 remain untouched until explicit owner approval.

## Frontend / Android changes
- Offline attendance drafts saved per class and date; all students must be marked explicitly; drafts are **not** submissions.
- Monthly attendance analytics, class comparisons and CSV export using existing attendance history.
- Android manual update check via native bridge, foreground update checks and build-number detection.
- English, Sinhala and Tamil navigation plus language preference. Full localization pending.
- Administrator password-recovery guidance only; self-service recovery is not live.

## Required backend integration before enabling remaining features
1. **Automatic synchronization:** authenticated, tenant-scoped idempotent submission endpoint, unique request IDs, retry acknowledgments, conflict detection, encrypted local storage, logout cleanup and safe expiry. Do not auto-retry ambiguous submissions without idempotency.
2. **Admin recovery:** verified email enrollment, short-lived hashed one-use tokens, rate limiting, session invalidation, audit log, secure email delivery. Never retrieve existing passwords.
3. **Multi-school owner dashboard:** platform-owner authentication and role checks on the server, school approval workflow, audit trail and strict tenant isolation. Existing platform approval endpoints require a secret header; never expose that secret in the web client or Android APK.
4. **Advanced reports:** date filtering, student-level reports and teacher-period statistics; verify aggregate accuracy.
5. **Localization:** translate remaining forms, messages, statuses, accessibility labels and reports.

## Acceptance criteria
- Drafts persist across app restarts; no silent Present defaults; no success message without server acknowledgment.
- Build-number updater can check manually and install a newer permanently signed APK.
- Monthly analytics match server history and CSV supports Unicode.
- Password recovery and platform dashboard are inaccessible until secure backend authentication is implemented and tested.
- No backend deployment or D1 migrations without approval.

Branch: claude/team-maestro-exam-ios-yc6u56.
