import { scrypt, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { fail } from "./validation.mjs";
const derive = promisify(scrypt);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [salt, hex] = (
    stored ?? "00000000000000000000000000000000:" + "00".repeat(64)
  ).split(":");
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function createSession(db, userId, res, secure = false) {
  const token = randomBytes(32).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db.prepare(
    "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)",
  ).run(digest(token), userId, csrf, Date.now() + 7 * 24 * 60 * 60 * 1000);
  res.setHeader(
    "Set-Cookie",
    `orbit_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? "; Secure" : ""}`,
  );
  return csrf;
}
export function cookieToken(req) {
  return (
    (req.headers.cookie ?? "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("orbit_session="))
      ?.slice(14) ?? ""
  );
}
export function authenticate(db, req) {
  const token = cookieToken(req);
  if (!/^[a-f\d]{64}$/.test(token)) fail(401, "Please sign in.");
  const session = db
    .prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?")
    .get(digest(token), Date.now());
  const user =
    session &&
    db
      .prepare("SELECT * FROM users WHERE id=? AND active=1")
      .get(session.user_id);
  if (!user) fail(401, "Your session has expired. Please sign in again.");
  return { user, session };
}
export function checkCsrf(req, session) {
  if (req.headers["x-csrf-token"] !== session.csrf)
    fail(
      403,
      "Session security token is missing or invalid. Refresh and try again.",
    );
}
export function rateLimiter() {
  const entries = new Map();
  return (key, limit = 15, window = 15 * 60 * 1000) => {
    const current = Date.now();
    if (entries.size > 10000)
      for (const [k, v] of entries) if (v.reset < current) entries.delete(k);
    const old = entries.get(key),
      entry =
        old && old.reset > current
          ? old
          : { count: 0, reset: current + window };
    entry.count++;
    entries.set(key, entry);
    if (entry.count > limit)
      fail(429, "Too many attempts. Please wait 15 minutes and try again.");
  };
}
