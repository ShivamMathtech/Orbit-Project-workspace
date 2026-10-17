import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, resolve, extname, basename, sep } from "node:path";
import { openDatabase, now, safeUser, transaction } from "./db.mjs";
import {
  hashPassword,
  verifyPassword,
  createSession,
  authenticate,
  checkCsrf,
  digest,
  cookieToken,
  rateLimiter,
} from "./security.mjs";
import * as v from "./validation.mjs";
import { seedDemo } from "./seed.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
const MAX_UPLOAD = 10 * 1024 * 1024;
async function bytes(req, limit = 1024 * 1024) {
  if (Number(req.headers["content-length"]) > limit)
    v.fail(
      413,
      `Request too large. Limit: ${Math.round(limit / 1024 / 1024)} MB.`,
    );
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) v.fail(413, "Request is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    v.fail(415, "Expected application/json.");
  let value;
  try {
    value = JSON.parse((await bytes(req)).toString());
  } catch (error) {
    if (error.status) throw error;
    v.fail(400, "Invalid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    v.fail(400, "Expected a JSON object.");
  return value;
}
function send(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ data }));
}
function removeFile(path) {
  try {
    unlinkSync(path);
  } catch (e) {
    if (e.code !== "ENOENT")
      console.error("Could not remove upload:", e.message);
  }
}

export function createApp({
  dataDir,
  distDir,
  publicOrigin = "",
  secureCookies = false,
} = {}) {
  const db = openDatabase(dataDir),
    rate = rateLimiter();
  let setupRunning = false;
  const get = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  const requireAdmin = (user) => {
    if (user.role !== "admin")
      v.fail(403, "Only workspace administrators can do this.");
  };
  const project = (pid, user) => {
    const p = get("SELECT * FROM projects WHERE id=?", v.id(pid));
    if (
      !p ||
      (user.role !== "admin" &&
        !get(
          "SELECT 1 FROM project_members WHERE project_id=? AND user_id=?",
          p.id,
          user.id,
        ))
    )
      v.fail(404, "Project not found.");
    return p;
  };
  const manager = (p, user) => {
    if (user.role !== "admin" && p.owner_id !== user.id)
      v.fail(403, "Only the project owner or an administrator can do this.");
  };
  const task = (tid, user) => {
    const t = get("SELECT * FROM tasks WHERE id=?", v.id(tid));
    if (!t) v.fail(404, "Task not found.");
    project(t.project_id, user);
    return t;
  };
  const memberIds = (pid) =>
    all("SELECT user_id FROM project_members WHERE project_id=?", pid).map(
      (x) => x.user_id,
    );
  const checkAssignee = (pid, uid) => {
    if (
      uid &&
      !get(
        "SELECT 1 FROM project_members WHERE project_id=? AND user_id=?",
        pid,
        uid,
      )
    )
      v.fail(400, "The assignee must be a project member.");
  };
  const activity = (pid, uid, message) => {
    run(
      "INSERT INTO activity(project_id,actor_id,message,created_at) VALUES(?,?,?,?)",
      pid,
      uid,
      message,
      now(),
    );
    run("UPDATE projects SET updated_at=? WHERE id=?", now(), pid);
  };
  const taskView = (tid) =>
    get(
      `SELECT t.*,u.name AS assignee_name,u.color AS assignee_color,(SELECT COUNT(*) FROM comments c WHERE c.task_id=t.id) AS comment_count FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.id=?`,
      tid,
    );
  const projectView = (p) => ({
    ...p,
    members: all(
      "SELECT u.id,u.name,u.color,u.active FROM users u JOIN project_members m ON m.user_id=u.id WHERE m.project_id=?",
      p.id,
    ),
    ...get(
      "SELECT COUNT(*) AS task_count,COALESCE(SUM(status='done'),0) AS done_count FROM tasks WHERE project_id=?",
      p.id,
    ),
  });
  const insertProject = (input, user) => {
    const time = now();
    const pid = Number(
      run(
        "INSERT INTO projects(title,description,color,cover,status,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
        input.title,
        input.description,
        input.color,
        input.cover,
        input.status,
        user.id,
        time,
        time,
      ).lastInsertRowid,
    );
    run("INSERT INTO project_members VALUES(?,?)", pid, user.id);
    activity(pid, user.id, "created this project");
    return pid;
  };
  const insertTask = (pid, input, user) => {
    const time = now();
    return Number(
      run(
        "INSERT INTO tasks(project_id,title,description,status,priority,team,assignee_id,start_date,due_date,creator_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        pid,
        input.title,
        input.description,
        input.status,
        input.priority,
        input.team,
        input.assignee_id,
        input.start_date,
        input.due_date,
        user.id,
        time,
        time,
      ).lastInsertRowid,
    );
  };
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const localOrigins = [
        `http://127.0.0.1:${req.socket.localPort}`,
        `http://localhost:${req.socket.localPort}`,
      ];
      const origins = publicOrigin
        ? [...localOrigins, publicOrigin.replace(/\/$/, "")]
        : localOrigins;
      const allowedHosts = origins.map((o) => new URL(o).host);
      if (!allowedHosts.includes(req.headers.host))
        v.fail(
          403,
          "Unrecognized host. Configure PUBLIC_ORIGIN for this address.",
        );
      const url = new URL(req.url, "http://localhost"),
        path = url.pathname,
        method = req.method;
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
      if (
        mutating &&
        (req.headers["sec-fetch-site"] === "cross-site" ||
          (req.headers.origin && !origins.includes(req.headers.origin)))
      )
        v.fail(403, "Request origin is not allowed.");
      if (path === "/api/health" && method === "GET")
        return send(res, { status: "ok", version: "1.0.0" });
      if (path === "/api/setup" && method === "GET")
        return send(res, {
          required: get("SELECT COUNT(*) AS n FROM users").n === 0,
        });
      if (path === "/api/setup" && method === "POST") {
        rate("setup:" + req.socket.remoteAddress, 10);
        if (setupRunning || get("SELECT COUNT(*) AS n FROM users").n > 0)
          v.fail(409, "This workspace is already configured. Please sign in.");
        const b = await body(req);
        const name = v.text(b.name, "Name", 2, 80),
          email = v.email(b.email),
          password = v.password(b.password);
        setupRunning = true;
        try {
          const hash = await hashPassword(password);
          if (get("SELECT COUNT(*) AS n FROM users").n > 0)
            v.fail(409, "Workspace already configured.");
          const uid = Number(
            run(
              "INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,'admin',?)",
              name,
              email,
              hash,
              now(),
            ).lastInsertRowid,
          );
          const user = get("SELECT * FROM users WHERE id=?", uid);
          if (b.seedDemo === true) await seedDemo(db, user);
          return send(
            res,
            {
              user: safeUser(user),
              csrf: createSession(db, uid, res, secureCookies),
            },
            201,
          );
        } finally {
          setupRunning = false;
        }
      }
      if (path === "/api/auth/login" && method === "POST") {
        rate("login:" + req.socket.remoteAddress);
        const b = await body(req),
          email = v.email(b.email);
        v.text(b.password, "Password", 1, 128);
        const password = b.password;
        const user = get("SELECT * FROM users WHERE email=?", email);
        const valid = await verifyPassword(password, user?.password_hash);
        if (!valid || !user?.active)
          v.fail(401, "Email or password is incorrect.");
        return send(res, {
          user: safeUser(user),
          csrf: createSession(db, user.id, res, secureCookies),
        });
      }
      if (!path.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(method))
          v.fail(405, "Method not allowed.");
        let decoded;
        try {
          decoded = decodeURIComponent(path);
        } catch {
          v.fail(400, "Invalid path.");
        }
        if (decoded.split("/").some((segment) => segment.startsWith(".")))
          v.fail(404, "File not found.");
        let file = resolve(distDir, "." + decoded);
        if (!file.startsWith(resolve(distDir) + sep))
          file = join(distDir, "index.html");
        if (!existsSync(file) || !statSync(file).isFile()) {
          if (extname(decoded)) v.fail(404, "File not found.");
          file = join(distDir, "index.html");
        }
        if (!existsSync(file))
          v.fail(
            503,
            "Frontend not built. Run npm install, then npm run build.",
          );
        res.writeHead(200, {
          "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
          "Cache-Control": file.includes(`${sep}assets${sep}`)
            ? "public,max-age=31536000,immutable"
            : "no-cache",
        });
        return res.end(method === "HEAD" ? undefined : readFileSync(file));
      }
      const { user, session } = authenticate(db, req);
      if (mutating) checkCsrf(req, session);
      if (path === "/api/auth/me" && method === "GET")
        return send(res, { user: safeUser(user), csrf: session.csrf });
      if (path === "/api/auth/logout" && method === "POST") {
        run(
          "DELETE FROM sessions WHERE token_hash=?",
          digest(cookieToken(req)),
        );
        res.setHeader(
          "Set-Cookie",
          `orbit_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies ? "; Secure" : ""}`,
        );
        return send(res, { ok: true });
      }
      if (path === "/api/account" && method === "PATCH") {
        const b = await body(req),
          name = v.text(b.name, "Name", 2, 80),
          email = v.email(b.email),
          color = v.color(b.color);
        if (get("SELECT id FROM users WHERE email=? AND id<>?", email, user.id))
          v.fail(409, "That email address is already in use.");
        run(
          "UPDATE users SET name=?,email=?,color=? WHERE id=?",
          name,
          email,
          color,
          user.id,
        );
        return send(
          res,
          safeUser(get("SELECT * FROM users WHERE id=?", user.id)),
        );
      }
      if (path === "/api/account/password" && method === "POST") {
        rate("password:" + user.id, 10);
        const b = await body(req);
        v.password(b.new_password);
        v.text(b.current_password, "Current password", 1, 128);
        if (!(await verifyPassword(b.current_password, user.password_hash)))
          v.fail(400, "Current password is incorrect.");
        const hash = await hashPassword(b.new_password);
        transaction(db, () => {
          run("UPDATE users SET password_hash=? WHERE id=?", hash, user.id);
          run("DELETE FROM sessions WHERE user_id=?", user.id);
        });
        return send(res, { ok: true });
      }
      if (path === "/api/users" && method === "GET")
        return send(
          res,
          all("SELECT * FROM users ORDER BY active DESC,name").map(safeUser),
        );
      if (path === "/api/users" && method === "POST") {
        requireAdmin(user);
        const b = await body(req),
          name = v.text(b.name, "Name", 2, 80),
          email = v.email(b.email),
          pw = v.password(b.password),
          role = v.oneOf(b.role ?? "member", ["admin", "member"], "role");
        if (get("SELECT id FROM users WHERE email=?", email))
          v.fail(409, "That email address is already in use.");
        const hash = await hashPassword(pw);
        const uid = Number(
          run(
            "INSERT INTO users(name,email,password_hash,role,color,created_at) VALUES(?,?,?,?,?,?)",
            name,
            email,
            hash,
            role,
            v.color(b.color ?? "#9ad6ce"),
            now(),
          ).lastInsertRowid,
        );
        return send(
          res,
          safeUser(get("SELECT * FROM users WHERE id=?", uid)),
          201,
        );
      }
      let m;
      if ((m = path.match(/^\/api\/users\/(\d+)$/)) && method === "PATCH") {
        requireAdmin(user);
        const uid = v.id(m[1]),
          old = get("SELECT * FROM users WHERE id=?", uid);
        if (!old) v.fail(404, "Member not found.");
        const b = await body(req),
          role = v.oneOf(b.role ?? old.role, ["admin", "member"], "role"),
          active = b.active === undefined ? old.active : b.active;
        if (![0, 1].includes(active)) v.fail(400, "Invalid account state.");
        if (
          old.role === "admin" &&
          old.active === 1 &&
          (role !== "admin" || active === 0) &&
          get("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1")
            .n <= 1
        )
          v.fail(
            400,
            "The workspace must keep at least one active administrator.",
          );
        run("UPDATE users SET role=?,active=? WHERE id=?", role, active, uid);
        run("DELETE FROM sessions WHERE user_id=?", uid);
        return send(res, safeUser(get("SELECT * FROM users WHERE id=?", uid)));
      }
      if (
        (m = path.match(/^\/api\/users\/(\d+)\/password$/)) &&
        method === "POST"
      ) {
        requireAdmin(user);
        rate("reset:" + user.id, 20);
        const uid = v.id(m[1]);
        if (!get("SELECT id FROM users WHERE id=?", uid))
          v.fail(404, "Member not found.");
        const b = await body(req),
          hash = await hashPassword(v.password(b.password));
        transaction(db, () => {
          run("UPDATE users SET password_hash=? WHERE id=?", hash, uid);
          run("DELETE FROM sessions WHERE user_id=?", uid);
        });
        return send(res, { ok: true });
      }
      if (path === "/api/projects" && method === "GET") {
        const list =
          user.role === "admin"
            ? all("SELECT * FROM projects ORDER BY updated_at DESC,id DESC")
            : all(
                "SELECT p.* FROM projects p JOIN project_members m ON m.project_id=p.id WHERE m.user_id=? ORDER BY p.updated_at DESC,p.id DESC",
                user.id,
              );
        return send(res, list.map(projectView));
      }
      if (path === "/api/projects" && method === "POST") {
        const input = v.projectInput(await body(req));
        const pid = transaction(db, () => insertProject(input, user));
        return send(res, projectView(project(pid, user)), 201);
      }
      if (path === "/api/projects/import" && method === "POST") {
        const b = await body(req);
        if (
          b.formatVersion !== 1 ||
          !b.project ||
          !Array.isArray(b.tasks) ||
          b.tasks.length > 1000
        )
          v.fail(400, "Use an Orbit project export with at most 1,000 tasks.");
        const p = v.projectInput(b.project),
          tasks = b.tasks.map((t) => v.taskInput({ ...t, assignee_id: null }));
        const pid = transaction(db, () => {
          const pid = insertProject(p, user);
          tasks.forEach((t) => insertTask(pid, t, user));
          activity(pid, user.id, `imported ${tasks.length} tasks`);
          return pid;
        });
        return send(res, projectView(project(pid, user)), 201);
      }
      if ((m = path.match(/^\/api\/projects\/(\d+)$/))) {
        const p = project(m[1], user);
        if (method === "GET") return send(res, projectView(p));
        manager(p, user);
        if (method === "PATCH") {
          const input = v.projectInput({ ...p, ...(await body(req)) });
          transaction(db, () => {
            run(
              "UPDATE projects SET title=?,description=?,color=?,cover=?,status=?,updated_at=? WHERE id=?",
              input.title,
              input.description,
              input.color,
              input.cover,
              input.status,
              now(),
              p.id,
            );
            activity(p.id, user.id, "updated the project details");
          });
          return send(res, projectView(project(p.id, user)));
        }
        if (method === "DELETE") {
          const files = all(
            "SELECT stored_name FROM files WHERE project_id=?",
            p.id,
          );
          run("DELETE FROM projects WHERE id=?", p.id);
          files.forEach((f) =>
            removeFile(join(dataDir, "uploads", f.stored_name)),
          );
          return send(res, { ok: true });
        }
      }
      if (
        (m = path.match(/^\/api\/projects\/(\d+)\/export$/)) &&
        method === "GET"
      ) {
        const p = project(m[1], user),
          tasks = all(
            "SELECT title,description,status,priority,team,start_date,due_date FROM tasks WHERE project_id=? ORDER BY id",
            p.id,
          );
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="orbit-project-${p.id}.json"`,
          "Cache-Control": "no-store",
        });
        return res.end(
          JSON.stringify(
            {
              formatVersion: 1,
              exportedAt: now(),
              project: {
                title: p.title,
                description: p.description,
                color: p.color,
                cover: p.cover,
                status: p.status,
              },
              tasks,
            },
            null,
            2,
          ),
        );
      }
      if ((m = path.match(/^\/api\/projects\/(\d+)\/members$/))) {
        const p = project(m[1], user);
        if (method === "GET")
          return send(
            res,
            all(
              "SELECT u.* FROM users u JOIN project_members m ON m.user_id=u.id WHERE m.project_id=?",
              p.id,
            ).map(safeUser),
          );
        if (method === "PUT") {
          manager(p, user);
          const b = await body(req);
          if (!Array.isArray(b.user_ids) || b.user_ids.length > 200)
            v.fail(400, "Provide up to 200 member IDs.");
          const ids = [
            ...new Set([p.owner_id, ...b.user_ids.map((x) => v.id(x))]),
          ];
          if (ids.some((uid) => !get("SELECT id FROM users WHERE id=?", uid)))
            v.fail(400, "Member not found.");
          transaction(db, () => {
            run("DELETE FROM project_members WHERE project_id=?", p.id);
            ids.forEach((uid) =>
              run("INSERT INTO project_members VALUES(?,?)", p.id, uid),
            );
            const removed = all(
              "SELECT id,assignee_id FROM tasks WHERE project_id=? AND assignee_id IS NOT NULL",
              p.id,
            ).filter((t) => !ids.includes(t.assignee_id));
            removed.forEach((t) =>
              run(
                "UPDATE tasks SET assignee_id=NULL,version=version+1,updated_at=? WHERE id=?",
                now(),
                t.id,
              ),
            );
            activity(p.id, user.id, "updated the project team");
          });
          return send(res, projectView(project(p.id, user)));
        }
      }
      if ((m = path.match(/^\/api\/projects\/(\d+)\/tasks$/))) {
        const p = project(m[1], user);
        if (method === "GET")
          return send(
            res,
            all(
              "SELECT id FROM tasks WHERE project_id=? ORDER BY created_at,id",
              p.id,
            ).map((t) => taskView(t.id)),
          );
        if (method === "POST") {
          const input = v.taskInput(await body(req));
          checkAssignee(p.id, input.assignee_id);
          const tid = transaction(db, () => {
            const tid = insertTask(p.id, input, user);
            activity(p.id, user.id, `created “${input.title}”`);
            return tid;
          });
          return send(res, taskView(tid), 201);
        }
      }
      if ((m = path.match(/^\/api\/tasks\/(\d+)$/))) {
        const t = task(m[1], user);
        if (method === "GET") return send(res, taskView(t.id));
        if (method === "PATCH") {
          const b = await body(req);
          if (b.version !== t.version)
            v.fail(
              409,
              "This task changed in another session. Close it and reopen the latest version.",
            );
          const input = v.taskInput({ ...t, ...b });
          checkAssignee(t.project_id, input.assignee_id);
          transaction(db, () => {
            const changed = run(
              "UPDATE tasks SET title=?,description=?,status=?,priority=?,team=?,assignee_id=?,start_date=?,due_date=?,version=version+1,updated_at=? WHERE id=? AND version=?",
              input.title,
              input.description,
              input.status,
              input.priority,
              input.team,
              input.assignee_id,
              input.start_date,
              input.due_date,
              now(),
              t.id,
              b.version,
            );
            if (!changed.changes)
              v.fail(
                409,
                "This task changed in another session. Close it and reopen the latest version.",
              );
            activity(
              t.project_id,
              user.id,
              input.status !== t.status
                ? `moved “${input.title}” to ${input.status.replaceAll("_", " ")}`
                : `updated “${input.title}”`,
            );
          });
          return send(res, taskView(t.id));
        }
        if (method === "DELETE") {
          transaction(db, () => {
            run("DELETE FROM tasks WHERE id=?", t.id);
            activity(t.project_id, user.id, `deleted “${t.title}”`);
          });
          return send(res, { ok: true });
        }
      }
      if ((m = path.match(/^\/api\/tasks\/(\d+)\/comments$/))) {
        const t = task(m[1], user);
        if (method === "GET")
          return send(
            res,
            all(
              "SELECT c.*,u.name,u.color FROM comments c JOIN users u ON u.id=c.author_id WHERE task_id=? ORDER BY c.id",
              t.id,
            ),
          );
        if (method === "POST") {
          const b = await body(req),
            content = v.text(b.body, "Comment", 1, 4000);
          const cid = transaction(db, () => {
            const cid = Number(
              run(
                "INSERT INTO comments(task_id,author_id,body,created_at) VALUES(?,?,?,?)",
                t.id,
                user.id,
                content,
                now(),
              ).lastInsertRowid,
            );
            activity(t.project_id, user.id, `commented on “${t.title}”`);
            return cid;
          });
          return send(
            res,
            get(
              "SELECT c.*,u.name,u.color FROM comments c JOIN users u ON u.id=c.author_id WHERE c.id=?",
              cid,
            ),
            201,
          );
        }
      }
      if ((m = path.match(/^\/api\/projects\/(\d+)\/messages$/))) {
        const p = project(m[1], user);
        if (method === "GET")
          return send(
            res,
            all(
              "SELECT m.*,u.name,u.color FROM messages m JOIN users u ON u.id=m.author_id WHERE m.project_id=? ORDER BY m.id DESC LIMIT 200",
              p.id,
            ).reverse(),
          );
        if (method === "POST") {
          const b = await body(req),
            content = v.text(b.body, "Message", 1, 4000);
          const mid = Number(
            run(
              "INSERT INTO messages(project_id,author_id,body,created_at) VALUES(?,?,?,?)",
              p.id,
              user.id,
              content,
              now(),
            ).lastInsertRowid,
          );
          activity(p.id, user.id, "sent a message");
          return send(
            res,
            get(
              "SELECT m.*,u.name,u.color FROM messages m JOIN users u ON u.id=m.author_id WHERE m.id=?",
              mid,
            ),
            201,
          );
        }
      }
      if ((m = path.match(/^\/api\/projects\/(\d+)\/files$/))) {
        const p = project(m[1], user);
        if (method === "GET")
          return send(
            res,
            all(
              "SELECT f.id,f.project_id,f.uploader_id,f.name,f.size,f.created_at,u.name AS uploader_name FROM files f JOIN users u ON u.id=f.uploader_id WHERE f.project_id=? ORDER BY f.id DESC",
              p.id,
            ),
          );
        if (method === "POST") {
          const name = v
            .text(url.searchParams.get("name"), "Filename", 1, 180)
            .replace(/[\x00-\x1f\x7f\\/]/g, "_");
          const content = await bytes(req, MAX_UPLOAD);
          if (!content.length) v.fail(400, "The file is empty.");
          const storage = randomUUID();
          writeFileSync(join(dataDir, "uploads", storage), content, {
            flag: "wx",
          });
          try {
            const fid = transaction(db, () => {
              const fid = Number(
                run(
                  "INSERT INTO files(project_id,uploader_id,name,stored_name,size,created_at) VALUES(?,?,?,?,?,?)",
                  p.id,
                  user.id,
                  name,
                  storage,
                  content.length,
                  now(),
                ).lastInsertRowid,
              );
              activity(p.id, user.id, `uploaded “${name}”`);
              return fid;
            });
            return send(res, { id: fid, name, size: content.length }, 201);
          } catch (e) {
            removeFile(join(dataDir, "uploads", storage));
            throw e;
          }
        }
      }
      if ((m = path.match(/^\/api\/files\/(\d+)(\/download)?$/))) {
        const f = get("SELECT * FROM files WHERE id=?", v.id(m[1]));
        if (!f) v.fail(404, "File not found.");
        const p = project(f.project_id, user);
        if (method === "GET" && m[2]) {
          const location = join(dataDir, "uploads", f.stored_name);
          if (!existsSync(location))
            v.fail(404, "The file is missing from storage.");
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Length": f.size,
            "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(f.name).replace(/'/g, "%27")}`,
            "Cache-Control": "no-store",
          });
          return res.end(readFileSync(location));
        }
        if (method === "DELETE" && !m[2]) {
          if (
            user.role !== "admin" &&
            user.id !== f.uploader_id &&
            user.id !== p.owner_id
          )
            v.fail(
              403,
              "Only the uploader or project manager can delete this file.",
            );
          transaction(db, () => {
            run("DELETE FROM files WHERE id=?", f.id);
            activity(p.id, user.id, `removed “${f.name}”`);
          });
          removeFile(join(dataDir, "uploads", f.stored_name));
          return send(res, { ok: true });
        }
      }
      if (path === "/api/activity" && method === "GET") {
        const where =
          user.role === "admin"
            ? "1=1"
            : "EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=a.project_id AND pm.user_id=@uid)";
        const params = { uid: user.id };
        const query = url.searchParams.get("project");
        let clause = "";
        if (query) {
          project(query, user);
          clause = " AND a.project_id=@pid";
          params.pid = v.id(query);
        }
        return send(
          res,
          db
            .prepare(
              `SELECT a.*,u.name,u.color,p.title AS project_title,EXISTS(SELECT 1 FROM activity_reads ar WHERE ar.activity_id=a.id AND ar.user_id=@uid) AS is_read FROM activity a JOIN users u ON u.id=a.actor_id JOIN projects p ON p.id=a.project_id WHERE ${where}${clause} ORDER BY a.id DESC LIMIT 50`,
            )
            .all(params),
        );
      }
      if (path === "/api/activity/read" && method === "POST") {
        const b = await body(req);
        if (!Array.isArray(b.ids) || b.ids.length > 100)
          v.fail(400, "Provide up to 100 activity IDs.");
        transaction(db, () => {
          for (const aid of b.ids) {
            const a = get("SELECT * FROM activity WHERE id=?", v.id(aid));
            if (a) {
              project(a.project_id, user);
              run(
                "INSERT OR IGNORE INTO activity_reads VALUES(?,?)",
                a.id,
                user.id,
              );
            }
          }
        });
        return send(res, { ok: true });
      }
      v.fail(404, "API route not found.");
    } catch (error) {
      const status = error.status ?? 500;
      if (status === 500) console.error(error);
      if (!res.headersSent) {
        res.writeHead(status, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(
          JSON.stringify({
            error:
              status === 500
                ? "Something went wrong. Please try again."
                : error.message,
          }),
        );
      } else res.end();
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return {
    server,
    db,
    close: async () => {
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}
