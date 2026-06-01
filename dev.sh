#!/usr/bin/env bash
# Launch dennyPanel backend + frontend together for local development.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() { kill 0 2>/dev/null; }
trap cleanup EXIT INT TERM

echo "▶ starting backend on :8000"
(cd "$ROOT/backend" && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000) &

echo "▶ starting frontend on :3000"
(cd "$ROOT/frontend" && npm run dev) &

wait
