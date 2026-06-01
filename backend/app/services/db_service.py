"""Lightweight database manager.

Discovers MySQL/MariaDB and Postgres containers managed by Docker and lists their
databases by running the client inside each container (docker exec). No extra
driver dependencies required.
"""
from __future__ import annotations

from app.services import docker_service as ds

MYSQL_IMAGES = ("mysql", "mariadb")
PG_IMAGES = ("postgres",)


def _exec(container, cmd: list[str]) -> str:
    res = container.exec_run(cmd, demux=False)
    return res.output.decode("utf-8", errors="replace") if res.output else ""


def list_servers() -> list[dict]:
    servers = []
    for c in ds.client().containers.list():
        image = (c.image.tags[0] if c.image.tags else "").lower()
        env = {e.split("=", 1)[0]: e.split("=", 1)[1] for e in c.attrs["Config"].get("Env", []) if "=" in e}
        if any(m in image for m in MYSQL_IMAGES):
            engine = "mysql"
        elif any(m in image for m in PG_IMAGES):
            engine = "postgres"
        else:
            continue
        servers.append({"id": c.short_id, "name": c.name, "engine": engine, "image": image, "_env": env})
    return servers


def list_databases(container_id: str) -> dict:
    c = ds.client().containers.get(container_id)
    image = (c.image.tags[0] if c.image.tags else "").lower()
    env = {e.split("=", 1)[0]: e.split("=", 1)[1] for e in c.attrs["Config"].get("Env", []) if "=" in e}
    if any(m in image for m in MYSQL_IMAGES):
        pw = env.get("MARIADB_ROOT_PASSWORD") or env.get("MYSQL_ROOT_PASSWORD") or ""
        out = _exec(c, ["sh", "-c", f"mysql -uroot -p'{pw}' -e 'SHOW DATABASES;' -N 2>/dev/null"])
        dbs = [l for l in out.splitlines() if l and l not in ("information_schema", "performance_schema", "sys")]
        return {"engine": "mysql", "databases": dbs}
    if any(m in image for m in PG_IMAGES):
        user = env.get("POSTGRES_USER", "postgres")
        out = _exec(c, ["sh", "-c", f"psql -U {user} -t -c 'SELECT datname FROM pg_database WHERE datistemplate=false;'"])
        dbs = [l.strip() for l in out.splitlines() if l.strip()]
        return {"engine": "postgres", "databases": dbs}
    return {"engine": "unknown", "databases": []}
