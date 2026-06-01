# dennyPanel

An open-source, self-hosted Linux server control panel — built from scratch, no paid tiers, every feature free.

Manage Docker containers, deploy websites (static, WordPress, Ghost) with one click,
monitor system resources, and run remote commands over SSH from a clean web UI.

```
┌──────────────┐      /api/*       ┌──────────────────┐
│  Next.js UI  │  ───────────────► │  FastAPI backend │
│  (port 3000) │   (rewrite proxy) │   (port 8000)    │
└──────────────┘                   └────────┬─────────┘
                                            │ docker SDK / psutil / paramiko
                                            ▼
                                   Host: Docker, system, SSH
```

## Features

- 🔐 JWT auth + **two-factor authentication (TOTP)** with QR-code setup
- ⚙️ Account settings — change username & password, enable/disable 2FA
- 📊 Live dashboard — CPU (+ per-core), memory, swap, disk, network rate, load,
  Docker summary, and a top-processes table
- 🐳 Docker — **create containers**, list / start / stop / restart / remove,
  view logs, browse images
- 🌐 One-click apps — static sites (nginx), **WordPress** (+ MariaDB), **Ghost** blogs
- 🔁 Reverse proxy + Let's Encrypt SSL per domain
- 🗂 Sandboxed file manager, 📁 FTP/SFTP accounts, ⏱ cron jobs
- ▶ In-browser interactive terminal (WebSocket PTY)
- ⌘ SSH host manager — store hosts and run remote commands
- 🌏 Traditional Chinese (繁體中文) UI
- 🗄️ SQLite storage (zero external dependencies to get started)

## Deploy to a Linux server (Docker Compose)

The bundled stack runs the backend (FastAPI), frontend (Next.js) and an nginx
reverse proxy that fronts both and forwards the terminal WebSocket.

```bash
git clone https://github.com/denny200897/dennypane.git dennypanel
cd dennypanel
cp .env.example .env
# edit .env — set DENNY_SECRET_KEY (openssl rand -hex 32) and the admin password
docker compose up -d --build
```

Then open `http://<server-ip>/` and log in. For HTTPS, point your own domain at
the server and put a TLS terminator (Caddy, Cloudflare, or nginx + certbot) in
front of port 80, or extend `deploy/nginx.conf`.

**Notes**
- The backend mounts `/var/run/docker.sock` so it can manage the host's Docker.
- DB and managed site files persist in the `denny_data` / `denny_sites` volumes.
- To show **host** (not container) CPU/processes, add `pid: host` to the backend
  service in `docker-compose.yml`.

## Quick start (local dev)

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
The first launch creates the admin user (default `admin` / `dennypanel` — change it!).
Docker management requires access to the Docker socket on the host.

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

## Configuration

Backend settings use the `DENNY_` env prefix (see `backend/app/core/config.py`):

| Variable | Default | Purpose |
|---|---|---|
| `DENNY_SECRET_KEY` | dev placeholder | JWT signing key — **set in production** |
| `DENNY_ADMIN_USERNAME` | `admin` | bootstrap admin |
| `DENNY_ADMIN_PASSWORD` | `dennypanel` | bootstrap admin password |
| `DENNY_SITES_ROOT` | `/opt/dennypanel/sites` | where site files live |
| `DENNY_DATABASE_URL` | local sqlite | swap for Postgres in prod |

## Roadmap

- [ ] Reverse proxy + automatic Let's Encrypt SSL per domain
- [ ] File manager (browse / upload / edit)
- [ ] FTP / SFTP account management
- [ ] In-browser interactive terminal (websocket PTY)
- [ ] Scheduled backups + cron management
- [ ] Database manager (MySQL / Postgres)
- [ ] Multi-user roles & audit log

## Security

Hardening built in for internet-facing deployments:

- **Auth tokens** — JWT signed HS256 with the algorithm pinned on decode (no
  `alg:none`/RS256 confusion); `exp`/`iat`/`nbf`/`iss` enforced. The server
  **refuses to start** with the default or a <32-char `DENNY_SECRET_KEY`
  (override with `DENNY_ALLOW_INSECURE_SECRET=true` for local dev only).
- **Brute-force protection** — per-IP failed-login throttle
  (`DENNY_LOGIN_MAX_ATTEMPTS` / `DENNY_LOGIN_WINDOW_SECONDS`).
- **2FA** — optional TOTP two-factor auth.
- **SQL injection** — all queries go through SQLAlchemy ORM (parameterized);
  no string-built SQL from user input.
- **XSS** — React auto-escapes all rendered values; no `dangerouslySetInnerHTML`;
  generated site HTML is `html.escape`d.
- **Injection via domains** — domain/username inputs are strictly validated
  (regex) before being written into nginx configs or system commands.
- **Uploads** — filenames reduced to a safe basename, path traversal blocked,
  size-capped (`DENNY_MAX_UPLOAD_MB`).
- **Headers** — `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy` from both the API and nginx;
  `server_tokens off`.
- **Reduced surface** — interactive API docs are **off** by default
  (`DENNY_ENABLE_DOCS=true` to re-enable).

Still recommended: serve over **HTTPS**, change the admin password on first
login, and restrict network access to the panel. SSH/FTP credentials are stored
in SQLite — encrypt them at rest (or use key auth) for high-security setups.

## License

MIT — yours to use, modify, and ship.
