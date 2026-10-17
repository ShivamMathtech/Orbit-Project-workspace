# Deployment

## Local machine

Use `START-WINDOWS.bat` or `node scripts/start.mjs`. The default `127.0.0.1` binding is accessible only from the same machine. Create the initial administrator before opening the service to other people.

## LAN

After local setup, set values in `.env` appropriate for your computer:

```dotenv
HOST=0.0.0.0
PORT=3000
DATA_DIR=data
PUBLIC_ORIGIN=http://192.168.1.50:3000
SECURE_COOKIES=false
```

Replace the example IP with the computer's real LAN IP and allow the port through its firewall if appropriate. Teammates use that exact origin. Accounts must be created in Team and assigned to projects. Unencrypted LAN HTTP should be limited to a trusted network; use HTTPS for remote access.

## HTTPS reverse proxy

Run the app on loopback behind a reverse proxy, preserve its Host header, and set `PUBLIC_ORIGIN` to the browser's HTTPS origin. Terminate TLS at the proxy and set `SECURE_COOKIES=true`. Configure a persistent data volume and regular stopped-server backups.

Example application configuration:

```dotenv
HOST=127.0.0.1
PORT=3000
PUBLIC_ORIGIN=https://projects.example.com
SECURE_COOKIES=true
DATA_DIR=/srv/orbit-data
```

Example Nginx location inside an existing TLS-enabled server block:

```nginx
location / {
    client_max_body_size 11m;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

The app does not trust `X-Forwarded-For` for rate limits. Behind a reverse proxy, sign-in requests share the proxy IP and may share the in-memory attempt limit. Add edge rate limiting and adapt trusted-proxy handling before a larger public deployment. Do not expose the Vite development server.

## Docker

`docker compose up --build -d` runs the Node runtime against the included `dist/` and persists `/app/data` in the named volume. The default host port is restricted to loopback. The app process runs as the container's `node` user.

Update the Compose environment and port mapping deliberately for LAN/remote access. Keep the volume; `docker compose down -v` deletes its data. Backup/restore Docker volumes using your container administration workflow while the app is stopped. The local backup helper targets the local project data directory, not a Docker named volume.

## Operational scope

Use one application server with a local persistent disk. SQLite files should not be shared across multiple application instances on a network filesystem. For a larger or public service, plan a proper multi-instance database, object storage, invitation/email flows, distributed throttling, monitoring, quotas, and security review according to your deployment needs.

Container startup, TLS/proxy configuration, and Windows GUI startup were not executed in the Linux authoring environment. The supplied application server and prebuilt startup were tested directly on Node 24.19.0.
