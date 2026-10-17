import test from "node:test";
import { request as httpRequest } from "node:http";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";

test("first-run setup stores a salted password and a protected session", async (t) => {
  const f = await fixture(t);
  const { data, res } = await f.req("/api/auth/me");
  assert.equal(data.user.name, "Shivam Singh");
  assert.equal(data.user.role, "admin");
  assert.ok(data.csrf);
  assert.equal(data.user.password_hash, undefined);
  const stored = f.db
    .prepare("SELECT password_hash FROM users")
    .get().password_hash;
  assert.match(stored, /^[a-f\d]{32}:[a-f\d]{128}$/);
  assert.equal((await f.req("/api/setup")).data.required, false);
  const c = f.client(),
    login = await f.req("/api/auth/login", {
      method: "POST",
      body: { email: "OWNER@example.test", password: "A-strong-pass-2026" },
      as: c,
    });
  assert.match(login.res.headers.get("set-cookie"), /HttpOnly/);
  assert.match(login.res.headers.get("set-cookie"), /SameSite=Lax/);
});
test("bootstrap cannot overwrite an existing workspace", async (t) => {
  const f = await fixture(t);
  await f.req("/api/setup", {
    method: "POST",
    body: {
      name: "Attacker",
      email: "other@example.test",
      password: "something-else",
    },
    as: null,
    status: 409,
  });
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM users").get().n, 1);
});
test("sign-in preserves whitespace in passwords and logout revokes the session", async (t) => {
  const f = await fixture(t, { password: "  intentional-space  " });
  const c = f.client();
  await f.req("/api/auth/login", {
    method: "POST",
    body: { email: "owner@example.test", password: "  intentional-space  " },
    as: c,
  });
  await f.req("/api/auth/logout", { method: "POST", as: c });
  await f.req("/api/auth/me", { as: c, status: 401 });
});
test("incorrect credentials and anonymous resource access are rejected", async (t) => {
  const f = await fixture(t);
  await f.req("/api/auth/login", {
    method: "POST",
    body: { email: "owner@example.test", password: "incorrect" },
    as: null,
    status: 401,
  });
  await f.req("/api/projects", { as: null, status: 401 });
  await f.req("/api/users", { as: null, status: 401 });
});
test("mutation requests require CSRF and reject foreign origins", async (t) => {
  const f = await fixture(t);
  await f.req("/api/projects", {
    method: "POST",
    body: { title: "bad" },
    headers: { "X-CSRF-Token": "" },
    status: 403,
  });
  await f.req("/api/projects", {
    method: "POST",
    body: { title: "bad" },
    headers: { Origin: "https://evil.example" },
    status: 403,
  });
  await f.req("/api/auth/login", {
    method: "POST",
    body: { email: "owner@example.test", password: "A-strong-pass-2026" },
    as: null,
    headers: { Origin: "https://evil.example" },
    status: 403,
  });
});
test("project CRUD validates fields and checks owner permissions", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    { user, as } = await f.makeUser();
  await f.req(`/api/projects/${p.id}`, { as, status: 404 });
  await f.req(`/api/projects/${p.id}/members`, {
    method: "PUT",
    body: { user_ids: [user.id] },
  });
  await f.req(`/api/projects/${p.id}`, { as });
  await f.req(`/api/projects/${p.id}`, {
    method: "PATCH",
    body: { title: "Denied" },
    as,
    status: 403,
  });
  await f.req(`/api/projects/${p.id}`, {
    method: "PATCH",
    body: { title: "Updated project", status: "completed" },
  });
  assert.equal(
    (await f.req(`/api/projects/${p.id}`)).data.title,
    "Updated project",
  );
  await f.req("/api/projects", {
    method: "POST",
    body: { title: "" },
    status: 400,
  });
  const owned = await f.makeProject("Member owned", as);
  await f.req(`/api/projects/${owned.id}`, { method: "DELETE", as });
});
test("tasks can be created, assigned, moved, commented on and deleted", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    { user, as } = await f.makeUser();
  await f.req(`/api/projects/${p.id}/members`, {
    method: "PUT",
    body: { user_ids: [user.id] },
  });
  const task = await f.makeTask(
    p.id,
    {
      assignee_id: user.id,
      priority: "high",
      start_date: "2026-10-17",
      due_date: "2026-10-21",
    },
    as,
  );
  assert.equal(task.assignee_name, "Member");
  const updated = (
    await f.req(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { status: "done", version: task.version },
      as,
    })
  ).data;
  assert.equal(updated.version, 2);
  assert.equal(updated.status, "done");
  await f.req(`/api/tasks/${task.id}/comments`, {
    method: "POST",
    body: { body: "Reviewed and approved" },
    as,
    status: 201,
  });
  assert.equal(
    (await f.req(`/api/tasks/${task.id}/comments`)).data[0].body,
    "Reviewed and approved",
  );
  assert.equal((await f.req(`/api/projects/${p.id}`)).data.done_count, 1);
  await f.req(`/api/tasks/${task.id}`, { method: "DELETE", as });
  await f.req(`/api/tasks/${task.id}`, { status: 404 });
});
test("task validation rejects bad dates, priorities and non-member assignees", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    { user } = await f.makeUser();
  for (const extra of [
    { start_date: "2026-02-31" },
    { start_date: "2026-10-20", due_date: "2026-10-19" },
    { status: "unknown" },
    { priority: "critical" },
    { assignee_id: user.id },
  ])
    await f.req(`/api/projects/${p.id}/tasks`, {
      method: "POST",
      body: { title: "Invalid", ...extra },
      status: 400,
    });
  assert.equal((await f.req(`/api/projects/${p.id}/tasks`)).data.length, 0);
});
test("stale and concurrent task edits cannot overwrite newer changes", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    task = await f.makeTask(p.id);
  await f.req(`/api/tasks/${task.id}`, {
    method: "PATCH",
    body: { version: 1, title: "First change" },
  });
  await f.req(`/api/tasks/${task.id}`, {
    method: "PATCH",
    body: { version: 1, title: "Stale change" },
    status: 409,
  });
  const opts = (title) => ({
    method: "PATCH",
    headers: {
      Cookie: f.admin.cookie,
      "X-CSRF-Token": f.admin.csrf,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, version: 2 }),
  });
  const results = await Promise.all([
    fetch(f.base + `/api/tasks/${task.id}`, opts("A")),
    fetch(f.base + `/api/tasks/${task.id}`, opts("B")),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  await Promise.all(results.map((r) => r.text()));
});
test("project membership applies to every nested resource", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    task = await f.makeTask(p.id),
    { as } = await f.makeUser();
  for (const path of [
    `/api/projects/${p.id}/tasks`,
    `/api/projects/${p.id}/messages`,
    `/api/projects/${p.id}/files`,
    `/api/projects/${p.id}/export`,
    `/api/projects/${p.id}/members`,
    `/api/tasks/${task.id}`,
    `/api/tasks/${task.id}/comments`,
  ])
    await f.req(path, { as, status: 404 });
  await f.req(`/api/projects/${p.id}/tasks`, {
    method: "POST",
    body: { title: "Forbidden" },
    as,
    status: 404,
  });
  assert.equal((await f.req("/api/projects", { as })).data.length, 0);
});
test("removing membership unassigns tasks and immediately revokes access", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    { user, as } = await f.makeUser();
  await f.req(`/api/projects/${p.id}/members`, {
    method: "PUT",
    body: { user_ids: [user.id] },
  });
  const task = await f.makeTask(p.id, { assignee_id: user.id });
  await f.req(`/api/projects/${p.id}/members`, {
    method: "PUT",
    body: { user_ids: [] },
  });
  const saved = (await f.req(`/api/tasks/${task.id}`)).data;
  assert.equal(saved.assignee_id, null);
  assert.equal(saved.version, 2);
  await f.req(`/api/projects/${p.id}`, { as, status: 404 });
  assert.equal((await f.req(`/api/projects/${p.id}/members`)).data.length, 1);
});
test("comments and SQL-like titles stay literal and input lengths are enforced", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject("Robert'); DROP TABLE users;--"),
    task = await f.makeTask(p.id);
  await f.req(`/api/tasks/${task.id}/comments`, {
    method: "POST",
    body: { body: "<script>alert(1)</script>" },
    status: 201,
  });
  assert.equal(
    (await f.req(`/api/tasks/${task.id}/comments`)).data[0].body,
    "<script>alert(1)</script>",
  );
  await f.req(`/api/tasks/${task.id}/comments`, {
    method: "POST",
    body: { body: "x".repeat(4001) },
    status: 400,
  });
  assert.equal((await f.req("/api/users")).data.length, 1);
});
test("binary upload, authenticated download and deletion work end to end", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject();
  const content = Buffer.from("A real project brief.\nこんにちは");
  const file = (
    await f.req(
      `/api/projects/${p.id}/files?name=${encodeURIComponent("Design brief.txt")}`,
      { method: "POST", raw: content, status: 201 },
    )
  ).data;
  const downloaded = await f.req(`/api/files/${file.id}/download`);
  assert.equal(downloaded.text, content.toString());
  assert.match(downloaded.res.headers.get("content-disposition"), /attachment/);
  assert.equal(
    downloaded.res.headers.get("content-type"),
    "application/octet-stream",
  );
  await f.req(`/api/files/${file.id}/download`, { as: null, status: 401 });
  await f.req(`/api/files/${file.id}`, { method: "DELETE" });
  assert.equal(readdirSync(join(f.dir, "uploads")).length, 0);
});
test("file deletion authorization and upload limits are enforced", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    { user, as } = await f.makeUser();
  await f.req(`/api/projects/${p.id}/members`, {
    method: "PUT",
    body: { user_ids: [user.id] },
  });
  const file = (
    await f.req(`/api/projects/${p.id}/files?name=brief.txt`, {
      method: "POST",
      raw: "brief",
      status: 201,
    })
  ).data;
  await f.req(`/api/files/${file.id}/download`, { as });
  await f.req(`/api/files/${file.id}`, { method: "DELETE", as, status: 403 });
  await f.req(`/api/projects/${p.id}/files?name=big.bin`, {
    method: "POST",
    raw: Buffer.alloc(10 * 1024 * 1024 + 1),
    status: 413,
  });
  await f.req(`/api/projects/${p.id}/files?name=empty.txt`, {
    method: "POST",
    raw: Buffer.alloc(0),
    status: 400,
  });
});
test("chat and stored records survive a server restart", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject();
  await f.makeTask(p.id);
  await f.req(`/api/projects/${p.id}/messages`, {
    method: "POST",
    body: { body: "This update should survive a restart." },
    status: 201,
  });
  await f.restart();
  assert.equal(
    (await f.req(`/api/projects/${p.id}/messages`)).data[0].body,
    "This update should survive a restart.",
  );
  assert.equal((await f.req(`/api/projects/${p.id}/tasks`)).data.length, 1);
});
test("project export/import is portable, validated and atomic", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject();
  await f.makeTask(p.id, { title: "Portable task", assignee_id: 1 });
  const out = await f.req(`/api/projects/${p.id}/export`);
  const parsed = JSON.parse(out.text);
  assert.equal(parsed.formatVersion, 1);
  assert.equal(parsed.tasks[0].assignee_id, undefined);
  const imported = (
    await f.req("/api/projects/import", {
      method: "POST",
      body: parsed,
      status: 201,
    })
  ).data;
  assert.notEqual(imported.id, p.id);
  assert.equal(
    (await f.req(`/api/projects/${imported.id}/tasks`)).data[0].assignee_id,
    null,
  );
  parsed.tasks.push({ title: "" });
  await f.req("/api/projects/import", {
    method: "POST",
    body: parsed,
    status: 400,
  });
  assert.equal((await f.req("/api/projects")).data.length, 2);
});
test("profile and password changes persist and revoke every session", async (t) => {
  const f = await fixture(t),
    other = f.client();
  await f.req("/api/auth/login", {
    method: "POST",
    body: { email: "owner@example.test", password: "A-strong-pass-2026" },
    as: other,
  });
  await f.req("/api/account", {
    method: "PATCH",
    body: { name: "New name", email: "new@example.test", color: "#aabbcc" },
  });
  assert.equal((await f.req("/api/auth/me")).data.user.name, "New name");
  await f.req("/api/account/password", {
    method: "POST",
    body: {
      current_password: "wrong-password",
      new_password: "A-different-password",
    },
    status: 400,
  });
  await f.req("/api/account/password", {
    method: "POST",
    body: {
      current_password: "A-strong-pass-2026",
      new_password: "A-different-password",
    },
  });
  await f.req("/api/auth/me", { status: 401 });
  await f.req("/api/auth/me", { as: other, status: 401 });
  await f.req("/api/auth/login", {
    method: "POST",
    body: { email: "new@example.test", password: "A-different-password" },
    as: f.client(),
  });
});
test("administration requires an admin and cannot remove the last active admin", async (t) => {
  const f = await fixture(t),
    { user, as } = await f.makeUser();
  await f.req("/api/users", {
    method: "POST",
    body: { name: "No permission" },
    as,
    status: 403,
  });
  await f.req("/api/users/1", {
    method: "PATCH",
    body: { role: "member" },
    status: 400,
  });
  await f.req("/api/users/1", {
    method: "PATCH",
    body: { active: 0 },
    status: 400,
  });
  await f.req(`/api/users/${user.id}`, {
    method: "PATCH",
    body: { active: 0 },
  });
  await f.req("/api/auth/me", { as, status: 401 });
});
test("admin password reset revokes sessions and activation restores login", async (t) => {
  const f = await fixture(t),
    { user, as } = await f.makeUser();
  await f.req(`/api/users/${user.id}/password`, {
    method: "POST",
    body: { password: "Reset-password-2026" },
  });
  await f.req("/api/auth/me", { as, status: 401 });
  await f.req("/api/auth/login", {
    method: "POST",
    body: { email: user.email, password: "Reset-password-2026" },
    as: f.client(),
  });
});
test("activity reads are user-specific and scoped to accessible projects", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    { user, as } = await f.makeUser();
  assert.equal((await f.req("/api/activity", { as })).data.length, 0);
  await f.req(`/api/projects/${p.id}/members`, {
    method: "PUT",
    body: { user_ids: [user.id] },
  });
  const a = (await f.req("/api/activity", { as })).data;
  assert.ok(a.length);
  await f.req("/api/activity/read", {
    method: "POST",
    body: { ids: a.map((x) => x.id) },
    as,
  });
  assert.ok(
    (await f.req("/api/activity", { as })).data.every((x) => x.is_read === 1),
  );
  assert.ok((await f.req("/api/activity")).data.some((x) => x.is_read === 0));
  await f.req(`/api/projects/${p.id}/members`, {
    method: "PUT",
    body: { user_ids: [] },
  });
  await f.req("/api/activity/read", {
    method: "POST",
    body: { ids: [a[0].id] },
    as,
    status: 404,
  });
});
test("deleting a project removes its database records and uploads", async (t) => {
  const f = await fixture(t),
    p = await f.makeProject(),
    task = await f.makeTask(p.id);
  await f.req(`/api/tasks/${task.id}/comments`, {
    method: "POST",
    body: { body: "Comment" },
    status: 201,
  });
  await f.req(`/api/projects/${p.id}/files?name=sample.txt`, {
    method: "POST",
    raw: "delete me",
    status: 201,
  });
  await f.req(`/api/projects/${p.id}/messages`, {
    method: "POST",
    body: { body: "message" },
    status: 201,
  });
  await f.req(`/api/projects/${p.id}`, { method: "DELETE" });
  for (const table of [
    "projects",
    "tasks",
    "comments",
    "messages",
    "files",
    "activity",
    "project_members",
  ])
    assert.equal(
      f.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,
      0,
      table,
    );
  assert.equal(readdirSync(join(f.dir, "uploads")).length, 0);
});
test("expired sessions are rejected", async (t) => {
  const f = await fixture(t);
  f.db.prepare("UPDATE sessions SET expires_at=0").run();
  await f.req("/api/projects", { status: 401 });
});
test("sample workspace has real records and disabled sample accounts", async (t) => {
  const f = await fixture(t, { seed: true });
  assert.equal((await f.req("/api/projects")).data.length, 5);
  const u = (await f.req("/api/users")).data;
  assert.equal(u.filter((x) => x.active).length, 1);
  assert.equal(u.length, 5);
  assert.ok((await f.req("/api/projects/1/tasks")).data.length >= 8);
  assert.ok(f.db.prepare("SELECT COUNT(*) n FROM tasks").get().n > 20);
});
test("built frontend and SPA fallback are served without exposing source or data", async (t) => {
  const f = await fixture(t);
  const home = await f.req("/", { as: null });
  assert.match(home.text, /Orbit/);
  assert.match(
    home.res.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  await f.req("/board", { as: null });
  await f.req("/server/schema.sql", { as: null, status: 404 });
  await f.req("/data/orbit.sqlite", { as: null, status: 404 });
  await f.req("/.env", { as: null, status: 404 });
});
test("unknown hosts and malformed JSON fail safely", async (t) => {
  const f = await fixture(t);
  const hostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(
      f.base + "/api/health",
      { headers: { host: "attacker.example" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    request.on("error", reject);
    request.end();
  });
  assert.equal(hostStatus, 403);
  await f.req("/api/projects", {
    method: "POST",
    raw: "{broken",
    headers: { "Content-Type": "application/json" },
    status: 400,
  });
  await f.req("/api/projects", { method: "POST", body: [], status: 400 });
});
