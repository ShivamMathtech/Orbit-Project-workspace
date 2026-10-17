import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
const root = fileURLToPath(new URL("../", import.meta.url));
if (existsSync(resolve(root, ".env"))) loadEnvFile(resolve(root, ".env"));
const { createApp } = await import("./app.mjs");
const port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535.");
const app = createApp({
  dataDir: resolve(root, process.env.DATA_DIR || "data"),
  distDir: resolve(root, "dist"),
  publicOrigin: process.env.PUBLIC_ORIGIN || "",
  secureCookies: process.env.SECURE_COOKIES === "true",
});
app.server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is in use. Change PORT in .env and restart.`
      : error.message,
  );
  process.exit(1);
});
app.server.listen(port, host, () =>
  console.log(
    `\n  ORBIT · Project workspace\n  Open ${process.env.PUBLIC_ORIGIN || `http://${host}:${port}`}\n  Keep this window open. Press Ctrl+C to stop.\n`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => app.close().then(() => process.exit(0)));
