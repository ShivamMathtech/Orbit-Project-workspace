# HTTP API

Base URL: `http://127.0.0.1:3000/api`.

Normal JSON responses use `{ "data": ... }`. Errors use `{ "error": "human-readable message" }`. Sign-in/setup return `{data: {user, csrf}}` and set an HttpOnly session cookie. Send the cookie on subsequent calls, plus `X-CSRF-Token: <csrf>` on authenticated mutations. JSON bodies must use `Content-Type: application/json`. The application does not enable cross-origin API access.

## Authentication and accounts

| Method | Route | Body / behavior |
| --- | --- | --- |
| GET | `/health` | Server version and status |
| GET | `/setup` | `{required: boolean}` |
| POST | `/setup` | First run only: `{name,email,password,seedDemo}`; creates administrator and session |
| POST | `/auth/login` | `{email,password}`; returns session CSRF token and user |
| GET | `/auth/me` | Current user and CSRF token |
| POST | `/auth/logout` | Revokes current session and clears cookie |
| PATCH | `/account` | `{name,email,color}`; edits own profile |
| POST | `/account/password` | `{current_password,new_password}`; revokes all sessions for this user |
| GET | `/users` | Workspace directory without password hashes |
| POST | `/users` | Admin: `{name,email,password,role,color?}` |
| PATCH | `/users/:id` | Admin: `{role?,active?}`; active is integer 0 or 1; revokes affected sessions |
| POST | `/users/:id/password` | Admin: `{password}`; resets password and revokes affected sessions |

Name: 2–80 characters. Email: valid email-shaped string, maximum 254 characters. Passwords: 10–128 characters for creation/change. Roles: `admin`, `member`. Colors: six-digit hex such as `#a78bfa`. Account state changes cannot remove the last active administrator.

## Projects

| Method | Route | Body / behavior |
| --- | --- | --- |
| GET | `/projects` | Accessible projects, members, task counts and completed counts |
| POST | `/projects` | `{title,description?,color?,cover?,status?}` |
| GET | `/projects/:id` | One accessible project |
| PATCH | `/projects/:id` | Owner/admin; partial editable project fields |
| DELETE | `/projects/:id` | Owner/admin; cascades project data and removes uploaded bytes |
| GET | `/projects/:id/members` | Members with public account fields |
| PUT | `/projects/:id/members` | Owner/admin; `{user_ids:[1,2]}`; full replacement, owner always retained |
| GET | `/projects/:id/export` | Downloads portable JSON; not wrapped in `data` |
| POST | `/projects/import` | `{formatVersion:1,project:{...},tasks:[...]}`; creates new project |

Project title: 1–100 characters. Description: up to 5,000. Status: `active`, `on_hold`, `completed`. Covers: `abstract`, `studio`, `store`, `gold`, `dashboard`. Import is limited to 1 MB and 1,000 tasks. All imported task assignees are cleared. Imports do not carry users, chat, files, comments, sessions, or activity history.

## Tasks and comments

| Method | Route | Body / behavior |
| --- | --- | --- |
| GET | `/projects/:id/tasks` | Project tasks, assignee name/color and comment counts |
| POST | `/projects/:id/tasks` | Task fields below |
| GET | `/tasks/:id` | One authorized task |
| PATCH | `/tasks/:id` | `{version, ...changedFields}`; version must match current record |
| DELETE | `/tasks/:id` | Deletes task and comments |
| GET | `/tasks/:id/comments` | Chronological task comments |
| POST | `/tasks/:id/comments` | `{body}`; 1–4,000 characters |

```json
{
  "title": "Prepare the design handoff",
  "description": "Include all states and responsive layouts.",
  "status": "todo",
  "priority": "high",
  "team": "Design",
  "assignee_id": null,
  "start_date": "2026-10-17",
  "due_date": "2026-10-21"
}
```

Title: 1–160 characters. Description: up to 10,000. Status: `backlog`, `todo`, `in_progress`, `done`. Priority: `low`, `medium`, `high`. Team: `Design`, `Development`, `Marketing`, `General`. Dates are real calendar dates in `YYYY-MM-DD` format or null. Due date cannot precede start date. The assignee must be a member of the task's project.

Every update requires the task's integer `version`. A mismatch returns **409** and does not apply the change. Refetch before retrying; do not overwrite another person's edit blindly.

## Files, chat and activity

| Method | Route | Body / behavior |
| --- | --- | --- |
| GET | `/projects/:id/files` | File metadata and uploader names |
| POST | `/projects/:id/files?name=<URL-encoded filename>` | **Raw binary body**, not multipart or JSON; 1 byte through 10 MB |
| GET | `/files/:id/download` | Authenticated attachment download with original filename |
| DELETE | `/files/:id` | Uploader, project owner, or administrator only |
| GET | `/projects/:id/messages` | Latest 200 messages in chronological order |
| POST | `/projects/:id/messages` | `{body}`; 1–4,000 characters |
| GET | `/activity` | Latest 50 accessible activity events with `is_read` |
| GET | `/activity?project=:id` | Scope activity to one authorized project |
| POST | `/activity/read` | `{ids:[1,2]}`; mark up to 100 authorized events as read |

Files are stored under UUID names outside the web root. The API serves bytes as `application/octet-stream` with attachment disposition, even when the original file is HTML/SVG. All filenames are display/download names, never filesystem destinations.

## Status codes

- `200`: success; `201`: resource created.
- `400`: invalid input or malformed JSON.
- `401`: missing, invalid or expired session; invalid credentials.
- `403`: role restriction, CSRF/origin failure, or unrecognized host.
- `404`: missing or inaccessible project/resource.
- `409`: duplicate identity, already-completed setup, or stale task edit.
- `413`: body/upload too large; `415`: wrong request content type.
- `429`: rate limit; `500`: unexpected server error without internal details.

The API is documented here as shipped. There is no Swagger server or generated OpenAPI endpoint.
