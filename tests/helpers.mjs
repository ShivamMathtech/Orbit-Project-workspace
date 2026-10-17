import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
export const root = fileURLToPath(new URL("../", import.meta.url));
export async function fixture(
  t,
  { seed = false, password = "A-strong-pass-2026" } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "orbit-test-"));
  let app = createApp({ dataDir: dir, distDir: join(root, "dist") });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  let base = `http://127.0.0.1:${app.server.address().port}`;
  const client = () => ({ cookie: "", csrf: "" });
  const admin = client();
  async function req(
    path,
    { method = "GET", body, as = admin, headers = {}, raw, status = 200 } = {},
  ) {
    const h = { ...headers };
    if (as?.cookie) h.Cookie = as.cookie;
    if (method !== "GET" && as?.csrf && !("X-CSRF-Token" in h))
      h["X-CSRF-Token"] = as.csrf;
    if (body !== undefined) h["Content-Type"] = "application/json";
    const res = await fetch(base + path, {
      method,
      headers: h,
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      redirect: "manual",
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    assert.equal(
      res.status,
      status,
      `${method} ${path}: ${text.slice(0, 400)}`,
    );
    if (as && res.headers.get("set-cookie"))
      as.cookie = res.headers.get("set-cookie").split(";")[0];
    if (as && data?.data?.csrf) as.csrf = data.data.csrf;
    return { data: data?.data ?? data, res, text };
  }
  await req("/api/setup", {
    method: "POST",
    body: {
      name: "Shivam Singh",
      email: "owner@example.test",
      password,
      seedDemo: seed,
    },
    status: 201,
  });
  const makeUser = async (name = "Member", role = "member") => {
    const email = `${name.toLowerCase().replaceAll(" ", "")}-${Math.random().toString(36).slice(2)}@example.test`;
    const { data: user } = await req("/api/users", {
      method: "POST",
      body: { name, email, password: "Member-pass-2026", role },
      status: 201,
    });
    const as = client();
    await req("/api/auth/login", {
      method: "POST",
      body: { email, password: "Member-pass-2026" },
      as,
    });
    return { user, as };
  };
  const makeProject = async (title = "Launch project", as = admin) =>
    (
      await req("/api/projects", {
        method: "POST",
        body: { title, description: "Team launch" },
        status: 201,
        as,
      })
    ).data;
  const makeTask = async (pid, extra = {}, as = admin) =>
    (
      await req(`/api/projects/${pid}/tasks`, {
        method: "POST",
        body: { title: "Design the experience", ...extra },
        status: 201,
        as,
      })
    ).data;
  const f = {
    req,
    admin,
    client,
    makeUser,
    makeProject,
    makeTask,
    dir,
    get db() {
      return app.db;
    },
    get base() {
      return base;
    },
    restart: async () => {
      await app.close();
      app = createApp({ dataDir: dir, distDir: join(root, "dist") });
      await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
      base = `http://127.0.0.1:${app.server.address().port}`;
    },
  };
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return f;
}
