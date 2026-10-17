# Windows setup

## Run the included app

Install Node.js **24.x**, extract the ZIP fully, and double-click `START-WINDOWS.bat`. Use a writable folder such as `G:\projects\orbit-workspace`. You may keep spaces in the parent folder name; the launcher quotes its paths.

The browser should open `http://127.0.0.1:3000`. Create the first administrator from the setup form. Choose your own password. Keep the console open; close it or press Ctrl+C to stop the server.

No npm installation is needed for the prebuilt app. The backend and SQLite driver are built into Node.js. Your database and uploads are created in `data/` automatically. Reopening the launcher uses the same data.

## Change source and rebuild

Double-click `BUILD-WINDOWS.bat`. It installs the pinned development packages and rebuilds `dist/`. Restart the app afterward. Internet access to npm is needed for this step.

Or use PowerShell:

```powershell
cd 'G:\projects\orbit-workspace'
node --version
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Using `npm.cmd` avoids PowerShell execution-policy restrictions on `npm.ps1`; no policy change is necessary.

## Common problems

| Symptom | Action |
| --- | --- |
| Node.js is not recognized | Install Node.js 24.x, then reopen the terminal or launcher. Check `where.exe node`. |
| Runtime version error | Run `node --version`; select Node 24.x if multiple versions are installed. |
| Browser opens but the page fails to load | Keep the server window open and read the error in that window. Open `http://127.0.0.1:3000` manually. |
| Port 3000 is in use | Copy `.env.example` to `.env`, set `PORT=3001`, and restart. Use `http://127.0.0.1:3001`. |
| The terminal says unrecognized host | Use the localhost address, or set `PUBLIC_ORIGIN` to the exact LAN / HTTPS browser origin. |
| Frontend not built | Run `BUILD-WINDOWS.bat`. Do not open `dist/index.html` directly through `file://`; start the server. |
| npm times out | Check your network/proxy and access to registry.npmjs.org. The supplied app still runs without installing development packages. |
| SQLite warning | Use a Node 24.x release. A stability warning from `node:sqlite` alone is not a startup failure. |
| Sign-in does not work for a sample teammate | Sample accounts are paused and have undisclosed random passwords. Set a password and activate the account as admin. |
| Member sees no projects | Sign in as owner/admin, select the project, open Team → Manage team, and include that member. |
| Task missing on Map | Set a start or due date and navigate to that date range. Unscheduled tasks remain on the Board. |
| Task edit reports a conflict | Another session changed the task. Close the dialog, refresh, and reopen the current task. |
| Cookies disappear between addresses | `localhost` and `127.0.0.1` are different browser hosts. Use one consistently and sign in there. |
| Upload rejected | Use a nonempty file of at most 10 MB. Files are downloaded as attachments. |
| Old UI after source changes | Run the build script and refresh the browser. Source changes are not compiled automatically by the production launcher. |

## Recovery and backup

To reset a forgotten administrator password, stop Orbit first and open a terminal in the app folder:

```powershell
node scripts/reset-password.mjs
```

The script asks for an existing account's email and a new password, requires local access to the database, and invalidates that user's sessions. It never creates an administrator or changes roles. The password prompt is hidden. Do not run this while the app is running.

For a full backup, stop the server and run `npm.cmd run backup`. Preserve the resulting backup directory, including uploads. See the README for restoration instructions.
