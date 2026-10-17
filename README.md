# Orbit — Project workspace

A complete, self-hosted project management application inspired by the supplied dark dashboard reference: a project gallery, scheduled task map, four-column Kanban board, team cards, and activity sidebar. The interface adapts to desktop, tablet, and mobile layouts.

This is a working application with a React frontend, a Node.js HTTP backend, and persistent SQLite storage. All application data comes from the backend. Optional example projects are real editable database records. No external API keys or subscription services are required.

## Start on Windows

1. Install **Node.js 24.x** from [nodejs.org](https://nodejs.org).
2. Extract the whole ZIP into a writable folder, for example `G:\projects\orbit-workspace`.
3. Double-click **START-WINDOWS.bat**.
4. Open **http://127.0.0.1:3000** if the browser does not open automatically.
5. Create your administrator account. Use an email address and a password of at least 10 characters. Sample projects are optional.

The compiled frontend is included in `dist/`. Starting the supplied version does **not** require `npm install`. The backend has no third-party package dependencies. Keep the terminal open while using the app. Stopping and restarting preserves the data.

On macOS/Linux:

```bash
node scripts/start.mjs --open
```

There are no default passwords. Example teammates are paused accounts with random, undisclosed passwords. To make an example account usable, set its password and activate it from Team, or create your own accounts.

## What works

| Area | Implemented behavior |
| --- | --- |
| First launch and accounts | One-time workspace setup, sign-in/out, administrator/member roles, editable profile, password change, session revocation |
| Projects | Create, edit, complete/pause, delete with confirmation, search, themed cover designs, progress calculated from tasks |
| Timeline / Map | Date-based task scheduling, week / two-week / month ranges, previous/next/today navigation, priority colors, task editing |
| Kanban | User story, To do, In progress, Done; drag-and-drop movement and accessible status menus; priority and assignee filters |
| Tasks | Descriptions, priorities, functional team categories, assignees, start/due dates, comments, deletion, optimistic concurrency protection |
| Team | Create accounts, set passwords, pause/activate, grant project membership; paused accounts cannot sign in |
| Files | Binary uploads, list/search, authenticated downloads, permitted deletion; 10 MB maximum per file |
| Chat | Project conversations stored in SQLite; automatic refresh every 5 seconds; latest 200 messages; search loaded messages |
| Activity | Real project changes, per-user read state, project navigation; latest 50 events fetched / 12 displayed |
| Import/export | Portable JSON project export/import including tasks; imported tasks start unassigned |
| Operations | Windows launch/build/test scripts, Linux/macOS launch script, SQLite schema migration, backup helper, Docker configuration |

Team categories (Design / Development / Marketing / General) are task labels for reporting, not additional access roles. The workspace has one organization; projects provide the access boundary inside it.

## A five-minute walkthrough

1. Leave the sample-data box checked during setup. The Map page opens the SOS Computer redesign project.
2. Open **Projects** to switch projects or create one.
3. Open **Team → Add member** as administrator. Enter a name, email, initial password, and role. Then choose **Manage team** to grant project access.
4. Choose **Board → Create task**. Add details, select an assignee, and set dates to show it on the Map.
5. Drag the card to another column or use the card's status dropdown. Click its title to edit and comment.
6. Upload a document in **Files**. Send an update in **Chat**.
7. Open another browser profile and sign in as your teammate to verify shared access. Refreshing the workspace happens every 30 seconds; chat refreshes every 5 seconds while the tab is visible.

Project owners and administrators manage project details and memberships. Members can collaborate on tasks, comments, chat, and files inside assigned projects. Administrators can access every project. Any signed-in member can create a project they own.

## Development

Tested runtime: Node.js **24.19.0** on Linux. Use the **24.x** release line. The runtime uses Node's built-in `node:sqlite` module. Some Node 24 releases may show a SQLite stability warning; that does not prevent this application from starting.

Pinned frontend dependencies are in `package.json` and `package-lock.json`. They are needed to rebuild the frontend or run the DOM integration test, not to start the bundled app.

```bash
npm ci
npm run build
npm start
```

After changing frontend files, rebuild before starting the bundled application. For live frontend development, use two terminals:

```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

Visit **http://127.0.0.1:5173** for Vite development. The Vite proxy targets the default backend port 3000. If you change that port, update `vite.config.js`. The development proxy normalizes origin headers for local development; do not expose the Vite server to an untrusted network.

```bash
npm run build
npm test
```

The tests use isolated temporary databases and ephemeral ports. They do not modify your workspace database. `tests/ui.test.mjs` executes the built React bundle with JSDOM against the real HTTP API. It verifies interactions, not pixel rendering. See [verification notes](docs/VERIFICATION.md).

## Configuration

Copy `.env.example` to `.env` only when overriding the defaults. `DATA_DIR` may be an absolute path or a path relative to the project folder.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `data` | Database and upload directory |
| `PUBLIC_ORIGIN` | blank | Exact browser origin for a LAN hostname or reverse proxy |
| `SECURE_COOKIES` | `false` | Set to `true` behind HTTPS |

A single server instance writes to a local SQLite database. The design is intended for personal and small-team deployments. It is not a multi-tenant SaaS or a horizontally scaled service.

## Data and backups

- `data/orbit.sqlite`: accounts, sessions, projects, memberships, tasks, comments, chat, files metadata, activity.
- `data/uploads/`: uploaded file bytes, named using server-generated UUIDs.
- SQLite WAL files may appear while the server runs. Do not delete them independently.
- No database, session token, `.env`, personal upload, or installed `node_modules` directory is shipped in this source ZIP.

Stop Orbit before making a backup, then run:

```bash
npm run backup
```

The helper copies the data directory to `backups/<timestamp>/data`. Store backups privately. To restore, stop Orbit, preserve the current data folder elsewhere, then copy the backup's `data` directory into the configured `DATA_DIR` location. Restart the server. JSON project exports contain project settings and tasks only: they are **not** full backups of users, files, comments, or chat.

## Docker and hosting

```bash
docker compose up --build -d
```

Open **http://localhost:3000** and complete setup. The named volume `orbit-data` persists database and uploads. The container serves the included build. Rebuild locally with `npm run build` before building the Docker image after frontend changes.

The Compose port binds to loopback by default. For a LAN or HTTPS deployment, see [deployment notes](docs/DEPLOYMENT.md). Docker configuration is supplied; Docker execution was not available in the authoring environment.

## Source map

```text
src/                  React UI, pages, reusable dialogs, styles, API client
server/app.mjs        HTTP routing, access checks, API and static serving
server/security.mjs   Password hashing, sessions, CSRF, sign-in rate limiting
server/validation.mjs Request validation and error responses
server/db.mjs         SQLite connection, migrations and transactions
server/schema.sql     Version 1 schema
server/seed.mjs       Optional sample workspace
scripts/              Startup and stopped-server backup
public/               Favicon source
dist/                Included production frontend (regenerated by build)
tests/                HTTP integration and built React DOM workflow tests
docs/                 Setup, architecture, API, deployment, verification
```

## Practical boundaries

This release intentionally uses local account provisioning, polling chat, date-based timelines, and one SQLite server. Email invitations, email delivery, forgotten-password email flows, SSO, video calls, billing, task dependencies, an hour-based scheduler, and external cloud integrations are not included. Administrators can reset member passwords in Team. A local recovery script is included for a forgotten administrator password; stop the server before using it.

The UI follows the supplied reference's visual direction and functional layout; it is not a pixel-for-pixel copy. Project covers are original CSS artwork, and no third-party photographs or copied project screenshots are embedded.

## More detail

- [Windows setup and troubleshooting](docs/WINDOWS-SETUP.md)
- [API reference](docs/API.md)
- [Architecture and permissions](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Verification results](docs/VERIFICATION.md)
- [Third-party notices](THIRD-PARTY-NOTICES.md)

Runtime API reference: [Node.js 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).
