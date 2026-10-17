import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as later } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
const major = Number(process.versions.node.split(".")[0]);
if (major !== 24) {
  console.error(
    "Orbit requires Node.js 24.x. Install Node.js 24 from https://nodejs.org, reopen this terminal, and run again.",
  );
  process.exit(1);
}
const root = fileURLToPath(new URL("../", import.meta.url));
if (!existsSync(resolve(root, "dist/index.html"))) {
  console.error(
    "The prebuilt frontend is missing. Run npm ci, then npm run build.",
  );
  process.exit(1);
}
if (existsSync(resolve(root, ".env"))) loadEnvFile(resolve(root, ".env"));
await import("../server/index.mjs");
if (process.argv.includes("--open")) {
  await later(700);
  const url =
    process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const command =
    process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => console.log(`Open ${url} in your browser.`));
  child.unref();
}
