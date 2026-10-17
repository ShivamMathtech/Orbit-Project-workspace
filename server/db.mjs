import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(join(dataDir, "uploads"), { recursive: true });
  const db = new DatabaseSync(join(dataDir, "orbit.sqlite"), { timeout: 5000 });
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version < 1) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
      db.exec("PRAGMA user_version=1; COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export const now = () => new Date().toISOString();
export const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  color: user.color,
  active: user.active,
  created_at: user.created_at,
});
