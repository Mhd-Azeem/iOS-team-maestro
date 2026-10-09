# Maestro Platform Owner Console — Phase 5

## What is implemented
- Separate responsive owner portal at `https://YOUR-WEB-APP/#platform` (not a school bottom-navigation tab).
- School overview: total, pending, approved, suspended.
- Searchable and status-filtered school list, staff/student counts, pagination.
- Approve, reject or suspend with reason and audit history; rejecting/suspending revokes active school sessions.
- Owner-only Worker API under `/api/owner/*`, isolated from school session authentication.
- Short-lived (30-minute) random bearer tokens stored **only in browser memory**.
- Server-side PBKDF2 owner password verification, rate-limited login attempts and D1-hashed owner session tokens.
- No owner password or platform approval key is hard-coded into the frontend or APK.

## Deployment remains BLOCKED
**Do not run migrations or deploy the backend until the owner explicitly approves.** The new owner API will not work against the currently deployed Worker. School functionality is unaffected by this source-only change.

When approval is given:
1. Audit the new `backend/migrations/0005_platform_owner.sql` and back up D1 before applying.
2. Choose a strong, unique owner password (minimum 16 characters recommended). Generate a random 16-byte hex salt and PBKDF2-SHA256 hash using 210,000 iterations, output 32-byte hex. Example Node 22 command (run locally, never commit the password):
   ```bash
   node -e "const c=require('node:crypto'); const p=process.env.OWNER_PASSWORD; if(!p||p.length<16)throw Error('Set OWNER_PASSWORD (16+ chars)'); const s=c.randomBytes(16); console.log('PLATFORM_OWNER_PASSWORD_SALT='+s.toString('hex')); console.log('PLATFORM_OWNER_PASSWORD_HASH='+c.pbkdf2Sync(p,s,210000,32,'sha256').toString('hex'));"
   ```
3. Configure Worker secrets `PLATFORM_OWNER_PASSWORD_SALT` and `PLATFORM_OWNER_PASSWORD_HASH` with those values, **not** in `VITE_*` or the repository. Set `PLATFORM_ALLOWED_ORIGIN` to the exact web portal origin (e.g. `https://attendance.example.lk`, no trailing slash). The existing origin restriction may need to be aligned with the school frontend; do not accidentally block school users.
4. Protect owner endpoints with Cloudflare WAF rate limiting and ideally Cloudflare Access/MFA in front of the owner portal. The D1 login limiter is additional protection, not a substitute.
5. Deploy Worker and migration only after staging tests and explicit approval.
6. Verify owner sign-in, unauthorized access rejection, token expiry, school approval and suspension, audit log, and session revocation using a staging D1 database.
7. Check school users cannot call owner endpoints, and school API access remains school-scoped.

## API contract
- `POST /api/owner/login` body `{password}`, returns `{token,expiresInMinutes}`.
- `POST /api/owner/logout` requires owner bearer token.
- `GET /api/owner/overview`.
- `GET /api/owner/schools?status=ALL&search=&offset=0&limit=50`.
- `POST /api/owner/schools/:id/decision` body `{status:"APPROVED"|"REJECTED"|"SUSPENDED",note:"..."}`.
- `GET /api/owner/audit`.
All owner routes require exact allowed Origin and an active owner token, except login. They are not accessible using a school token.

## Limitations / future
- Billing/subscriptions, support tickets, and account impersonation are **not** implemented. Do not claim subscription management exists.
- School record counts are metadata only; this portal does not expose student names or attendance records.
- Password-only sign-in should be upgraded to MFA before opening to broad production access.
- Staging test coverage and a formal security review are required before production deployment.
