# Phase 3 deployment blockers and operator procedure

- Apply migrations only to a **disposable local D1 database** for verification; production changes require separate authorization.
- Configure PLATFORM_APPROVAL_KEY using the Worker secret store. Never expose it in browser JavaScript. The operator approval API is intended for an independent authenticated internal dashboard, not a public client-side screen.
- Require Cloudflare Access, network restrictions, request throttling, and named human operator identities before enabling approval actions in production. The shared approval key is a temporary development mechanism, not sufficient institutional authorization.
- Set PLATFORM_ALLOWED_ORIGIN to the exact production web origin. CORS currently remains permissive; this is defense-in-depth only and does not substitute for authentication.
- Sessions expire after 30 days maximum and 12 hours of inactivity. Users can list/revoke their sessions.
- Privacy request reviews are recorded. Completing an erasure request does not automatically delete student records; retention rules, verification, legal holds and administrator approval are required first.
- Backups are still a documented operational process, **not** an automated encrypted scheduled system. Do not store database exports in GitHub artifacts or public repositories.
- Complete real two-school API integration tests, rate limiting, atomic school onboarding, incident drills, and legally reviewed privacy terms before using real pupil data.
