# Verification

Release: 1.0.0 · Prepared 17 October 2026.

## Executed checks

- Production frontend build with the exact pinned package versions: passed.
- Clean `npm ci --ignore-scripts` dependency installation from the portable lockfile: passed.
- Node.js HTTP/SQLite integration tests: 25 passed.
- Built React bundle DOM workflow test against the real HTTP API: 1 passed.
- Clean extracted package startup without `node_modules`: passed.
- ZIP integrity, required source files, and exclusion of runtime data/secrets: passed.

The React interaction test signs in, creates a project and a scheduled task, moves the task to Done, adds a comment, sends a project message, opens Files and Team, saves the account profile, and signs out. It verifies database-backed results and confirms task description HTML is rendered as literal text.

API tests exercise:

- One-time administrator setup and disabled optional sample users.
- Salted password storage, HttpOnly/SameSite cookies, session expiry and logout.
- Incorrect credentials, origin/CSRF enforcement, host validation, malformed input.
- Administrator and project ownership permissions.
- Access checks for nested tasks, comments, chat, files, exports and membership.
- Task status, assignment, real dates, input limits and invalid values.
- Concurrent and stale task edits returning 409 without lost updates.
- Membership removal, task unassignment, and immediate access loss.
- Literal SQL/script-like text storage.
- Binary upload/download, download disposition, file deletion, and size limits.
- Persistence across a server restart.
- Portable JSON export/import, validation and atomicity.
- Profile updates, password changes/resets and session revocation.
- Last-admin protection, paused accounts, per-user activity read state.
- Project deletion cascade and uploaded-file cleanup.
- Serving only the production build without exposing source, database, or environment files.

## Environment and limits

Execution environment: Linux, Node.js 24.19.0. The application is packaged for Windows use, and its batch launchers quote paths and check Node availability, but Windows GUI startup was not executed in this environment.

No browser automation surface was available. The React test uses JSDOM, which checks DOM behavior but does **not** render CSS, verify drag gestures in a real browser, or prove visual fidelity at each breakpoint. The accessible status dropdown exercises the same backend task movement as drag/drop. Responsive CSS includes desktop, tablet and small-phone breakpoints. Browser screenshots and pixel-perfect comparison are not included.

Docker configuration and reverse-proxy examples are included but were not executed here. No load benchmark, external penetration test, or production deployment was performed. The backup and interactive recovery helpers require a stopped server; the backup helper was exercised against a clean stopped workspace, while the hidden interactive recovery prompt was syntax-checked.

## Repeat the checks

```bash
npm ci
npm run build
npm test
```

For Windows, `TEST-WINDOWS.bat` runs dependency installation, the build, and tests. Tests create isolated temporary databases and remove them after execution.

After installation, manually inspect Map, Projects, Board, Team, Files, Chat and My account on your target browser, and try the navigation at narrow window widths. Also validate your actual Docker/TLS configuration if you deploy it.
