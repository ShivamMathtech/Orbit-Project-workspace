# Architecture

Orbit is a single-workspace application. A single Node.js process serves the React production build and a JSON HTTP API from one origin. The browser keeps only the selected project ID in localStorage; application records and sessions are persisted by SQLite.

## Data model

- `users`: identity, salted password hash, role, active state, avatar color.
- `sessions`: SHA-256 session-token hashes, user ID, CSRF token, seven-day expiry.
- `projects`: title, description, cover style, status, owner.
- `project_members`: unique user/project pairs.
- `tasks`: project, title, description, status, priority, reporting team, assignee, dates, version.
- `comments`: task conversation and author.
- `messages`: project conversation and author.
- `files`: project-scoped upload metadata; bytes live outside the static directory.
- `activity` and `activity_reads`: project updates and each user's read state.

Foreign keys enforce relationships and cascade project deletion. Task assignees must be project members. Removing a member unassigns their tasks and increments their task versions. The owner remains a member. User accounts are paused instead of deleted to preserve authorship.

## Permissions

| Operation | Administrator | Project owner | Assigned member | Other signed-in member |
| --- | --- | --- | --- | --- |
| See workspace directory | Yes | Yes | Yes | Yes |
| Provision/reset/pause accounts | Yes | No | No | No |
| Create own project | Yes | Yes | Yes | Yes |
| View project and contents | All projects | Own project | Assigned projects | No |
| Edit/delete project | Yes | Yes | No | No |
| Manage project membership | Yes | Yes | No | No |
| Create/edit/move/delete tasks | Yes | Yes | Yes | No |
| Read/post task comments and chat | Yes | Yes | Yes | No |
| Upload/download project files | Yes | Yes | Yes | No |
| Delete uploaded file | Yes | Yes | Own uploads only | No |
| Export project | Yes | Yes | Yes | No |

An administrator may access all projects without being assigned, but task assignment still requires project membership. The user directory intentionally shows all workspace names, email addresses, role and active state. There is no cross-organization tenancy feature.

## Request and session handling

- Passwords use asynchronous scrypt with per-password random salts and timing-safe comparison.
- Random 256-bit session tokens are transmitted in HttpOnly, SameSite=Lax cookies; their hashes are stored in SQLite.
- Authenticated mutations require a session-specific `X-CSRF-Token`. Browser cross-site/origin checks also protect mutation endpoints.
- Inactive users and expired sessions are rejected on each request. Password changes, resets, and account role/state updates revoke affected sessions.
- Sign-in/setup attempts are limited by IP in memory. Password change/reset attempts are also limited. Counters reset on process restart; this is not a distributed rate limiter.
- Validation bounds text lengths, IDs, enums, dates, file sizes and import sizes. SQL uses parameterized statements.
- Every project-scoped route checks project access on the server. Missing and unauthorized project resources return 404.
- CSP, frame protection, MIME sniffing prevention, and forced-attachment downloads are supplied.

## Concurrent edits and persistence

Each task has an integer version. PATCH requires the version read by the editor and updates only if it still matches. The database write is guarded by that version and wrapped in a transaction with its activity event. A stale write returns 409 instead of overwriting a newer edit.

SQLite uses WAL, foreign keys and a 5-second busy timeout. Schema version 1 is applied transactionally only to a new database. Future schema updates should add versioned migrations; never drop existing tables to migrate.

The HTTP API and database queries target a small-team, single-process installation. SQLite operations are synchronous; asynchronous password derivation does not block the event loop in the same way. Uploads are read into memory with a 10 MB per-file bound, and downloaded as attachments. Large-scale storage, quotas, virus scanning and a distributed file store are outside this release.

## Refresh behavior

Workspace data reloads after successful mutations and every 30 seconds while the page is visible. Project chat polls every 5 seconds and loads at most the latest 200 messages. Polling is not WebSocket messaging. Chat search searches those loaded messages only.

The timeline is based on calendar dates, with inclusive start/end spans. It supports week, two-week, and month windows. It does not invent hourly task durations or dependency relationships. Progress and team statistics are calculated from the current project tasks.
