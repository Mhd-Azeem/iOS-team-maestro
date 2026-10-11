# Reports system upgrade

The Reports page supports inclusive date ranges, separate grade/class filters, attendance records, individual summaries, and class comparisons. Generated records appear below Generate Report in class/date groups. Export expands into PDF and editable Word choices. Changing a filter invalidates the preview and ignores earlier in-flight requests.

## Calculation and access rules
- Total = submitted student attendance records; present + absent = total. Attendance percentage = present / total × 100, rounded to one decimal. Missing submissions are excluded, not counted as absences.
- Individual summaries use student IDs, preserving identity through class transfers. Class comparisons use the class on the attendance session, not a student's current class.
- Every join is school scoped. Teachers can only query assigned classes. Administrators and section heads follow the existing school-wide role policy; the schema has no section-to-class assignments.
- Reports reject invalid calendar dates, unsafe filter IDs, unsupported report types, and more than 5,000 records. Empty previews show a message and disable export.
- PDF pages use browser Unicode shaping and font fallback, with wrapped rows and repeated headings. PDF text is rendered as page images; Word tables retain editable Unicode text. Font availability on the viewing device still affects Word layout.

## Student notes: backend work required
No student-notes table, notes API, visibility policy, or notes-specific permissions exist. The UI disables notes and the API rejects notes requests. Enabling notes requires a school/student-scoped table (author, date, content, visibility, timestamps), authenticated CRUD and export endpoints, an explicit teacher/admin/section-head visibility policy, audit and retention rules, tenant/access tests, and a reviewed migration. No notes migration or production data change is included.

## Android saving
The native bridge validates format, filename, payload and size. It opens ACTION_CREATE_DOCUMENT instead of DownloadManager for generated files. A temporary cache file and saved activity state preserve the pending report through recreation. Cancel, picker failure and successful/failed writes clean up the temporary file. Destination writing runs on a background thread. The JavaScript bridge preserves the native method receiver.

## Verification
Install both web and backend dependencies. Run:

    node --test tests/*.test.mjs backend/tests/*.test.mjs
    cd web
    npm test
    npm run build
    npx playwright install chromium
    npx playwright test
    cd ../backend
    npm run check
    npx wrangler deploy --dry-run

The reports workflow runs isolated local D1 migrations and Android debug/release compilation, lint and unit tests. Its debug APK is a test build, not an update signed with the permanent production key. Device document-picker behavior still needs physical-device or emulator verification.

## Rollout
Merge after review, then deploy the updated frontend and Worker with explicit approval. This attendance upgrade needs no new D1 migration. Existing production schema must already match migrations 0001–0005; review any missing migrations separately before approving remote changes. Building a signed release requires the repository's permanent signing secrets and a separately approved release. Do not run production deployment, remote migrations, reset workflows or data writes as part of verification.
