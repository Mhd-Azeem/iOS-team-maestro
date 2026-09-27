# Universal School Attendance Platform

A clean, white-label, multi-school attendance platform.

## Architecture
- Web/PWA: React + TypeScript + Vite
- Backend: Cloudflare Workers + D1
- Android: Kotlin WebView wrapper
- CI/CD: GitHub Actions

## Separate infrastructure
This repository uses its own resources:
- Worker: maestro-school-attendance-api
- D1 database: maestro-school-attendance-db

Do not reuse the Worker or D1 database from the old School Attendance application.

## First setup
1. Run: npx wrangler d1 create maestro-school-attendance-db
2. Put the returned database_id into backend/wrangler.toml.
3. Run:
   cd backend
   npm install
   npx wrangler d1 migrations apply maestro-school-attendance-db --remote
   npm run deploy
4. Put the Worker URL into web/.env as VITE_API_BASE_URL.
5. Run:
   cd web
   npm install
   npm run dev

The first browser visit shows a one-time school/admin setup screen when this new database is empty.
