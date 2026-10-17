import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { openDatabase, transaction } from "../server/db.mjs";
import { hashPassword } from "../server/security.mjs";
import { password as validatePassword } from "../server/validation.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
if (existsSync(resolve(root, ".env"))) loadEnvFile(resolve(root, ".env"));
if (!process.stdin.isTTY) {
  console.error("Run this recovery command in an interactive terminal.");
  process.exit(1);
}
const dataDir = resolve(root, process.env.DATA_DIR || "data");
if (!existsSync(resolve(dataDir, "orbit.sqlite"))) {
  console.error("No workspace database found. Start Orbit first.");
  process.exit(1);
}
try {
  await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/health`, {
    signal: AbortSignal.timeout(1500),
  });
  console.error("Stop the running server before resetting a password.");
  process.exit(1);
} catch (error) {
  if (!["TypeError", "TimeoutError"].includes(error.name)) throw error;
}
console.log(
  "Local account recovery. This resets an existing account password and ends its sessions.",
);
const prompt = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const email = (await prompt.question("Existing account email: "))
  .trim()
  .toLowerCase();
prompt.close();
const db = openDatabase(dataDir);
const user = db.prepare("SELECT id,name FROM users WHERE email=?").get(email);
if (!user) {
  db.close();
  console.error("Account not found. No changes made.");
  process.exit(1);
}
emitKeypressEvents(process.stdin);
async function hidden(label) {
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.off("keypress", key);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const key = (text, k) => {
      if (k.ctrl && k.name === "c") {
        finish();
        reject(new Error("Cancelled."));
      } else if (k.name === "return") {
        finish();
        resolve(value);
      } else if (k.name === "backspace") {
        value = value.slice(0, -1);
      } else if (!k.ctrl && !k.meta && text && !/[\x00-\x1f\x7f]/.test(text)) {
        value += text;
      }
    };
    process.stdin.on("keypress", key);
  });
}
try {
  const first = await hidden("New password (hidden, 10–128 characters): ");
  validatePassword(first);
  const second = await hidden("Repeat new password (hidden): ");
  if (first !== second)
    throw new Error("Passwords do not match. No changes made.");
  const hash = await hashPassword(first);
  transaction(db, () => {
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
      hash,
      user.id,
    );
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
  });
  console.log(
    `Password updated for ${user.name}. Roles and account state were not changed.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
