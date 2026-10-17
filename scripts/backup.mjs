// Stop Orbit before running this script so the database and uploaded files match.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
const root = fileURLToPath(new URL("../", import.meta.url));
if (existsSync(resolve(root, ".env"))) loadEnvFile(resolve(root, ".env"));
const data = resolve(root, process.env.DATA_DIR || "data");
if (!existsSync(resolve(data, "orbit.sqlite"))) {
  console.error(
    "No database exists yet. Start the app and create your workspace first.",
  );
  process.exit(1);
}
const port = Number(process.env.PORT || 3000);
try {
  await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(1500),
  });
  console.error(
    "A server is running on this port. Stop Orbit with Ctrl+C before backing up.",
  );
  process.exit(1);
} catch (error) {
  if (error.name !== "TypeError" && error.name !== "TimeoutError") throw error;
}
const destination = resolve(
  root,
  "backups",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
mkdirSync(destination, { recursive: true });
cpSync(data, resolve(destination, "data"), {
  recursive: true,
  errorOnExist: true,
});
console.log(
  `Backup saved to ${destination}. Keep this directory private; it contains your database and uploads.`,
);
