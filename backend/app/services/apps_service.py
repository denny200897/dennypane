"""One-click application deployments built on top of Docker.

Each deploy spins up a container and records a Site row. Networking is exposed
on a host port; a reverse proxy / domain mapping can be layered on top later.
"""
from __future__ import annotations

import html
import json
import secrets
import socket
from pathlib import Path

from app.core.config import settings
from app.models.models import Site
from app.services import docker_service as ds


def _free_port(start: int = 20000, end: int = 40000) -> int:
    for _ in range(100):
        port = secrets.randbelow(end - start) + start
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("no free port found")


def _slug(domain: str) -> str:
    return "denny-" + domain.replace(".", "-").replace("/", "-").lower()


def deploy_static(site: Site) -> Site:
    """Serve a directory of static files via nginx."""
    root = Path(settings.sites_root) / site.domain
    root.mkdir(parents=True, exist_ok=True)
    index = root / "index.html"
    if not index.exists():
        safe_domain = html.escape(site.domain)
        index.write_text(
            f"<!doctype html><html><head><title>{safe_domain}</title></head>"
            f"<body style='font-family:sans-serif'><h1>{safe_domain}</h1>"
            "<p>Served by dennyPanel.</p></body></html>"
        )
    port = _free_port()
    c = ds.run_container(
        image="nginx:alpine",
        name=_slug(site.domain),
        ports={"80/tcp": port},
        volumes={str(root): "/usr/share/nginx/html"},
    )
    site.root_path = str(root)
    site.container_id = c["id"]
    site.upstream_port = port
    site.status = "running"
    return site


def deploy_wordpress(site: Site, admin_email: str | None = None) -> Site:
    db_name = _slug(site.domain) + "-db"
    db_pass = secrets.token_urlsafe(16)
    ds.run_container(
        image="mariadb:11",
        name=db_name,
        env={
            "MARIADB_DATABASE": "wordpress",
            "MARIADB_USER": "wordpress",
            "MARIADB_PASSWORD": db_pass,
            "MARIADB_ROOT_PASSWORD": secrets.token_urlsafe(16),
        },
    )
    port = _free_port()
    data_dir = Path(settings.sites_root) / site.domain / "wp-content"
    data_dir.mkdir(parents=True, exist_ok=True)
    c = ds.run_container(
        image="wordpress:latest",
        name=_slug(site.domain),
        ports={"80/tcp": port},
        env={
            "WORDPRESS_DB_HOST": db_name,
            "WORDPRESS_DB_USER": "wordpress",
            "WORDPRESS_DB_PASSWORD": db_pass,
            "WORDPRESS_DB_NAME": "wordpress",
        },
        volumes={str(data_dir): "/var/www/html/wp-content"},
    )
    # Link app container to the db container's network alias.
    try:
        ds.client().networks.get("bridge").connect(db_name)
    except Exception:
        pass
    site.root_path = str(data_dir.parent)
    site.container_id = c["id"]
    site.upstream_port = port
    site.status = "running"
    site.meta = json.dumps({"db_container": db_name, "admin_email": admin_email})
    return site


def deploy_ghost(site: Site, admin_email: str | None = None) -> Site:
    port = _free_port()
    data_dir = Path(settings.sites_root) / site.domain / "content"
    data_dir.mkdir(parents=True, exist_ok=True)
    c = ds.run_container(
        image="ghost:5-alpine",
        name=_slug(site.domain),
        ports={"2368/tcp": port},
        env={
            "url": f"http://{site.domain}",
            "NODE_ENV": "production",
        },
        volumes={str(data_dir): "/var/lib/ghost/content"},
    )
    site.root_path = str(data_dir)
    site.container_id = c["id"]
    site.upstream_port = port
    site.status = "running"
    site.meta = json.dumps({"admin_email": admin_email})
    return site


DEPLOYERS = {
    "static": lambda site, email: deploy_static(site),
    "wordpress": deploy_wordpress,
    "ghost": deploy_ghost,
}


def deploy(site: Site, admin_email: str | None = None) -> Site:
    if site.kind not in DEPLOYERS:
        raise ValueError(f"unsupported site kind: {site.kind}")
    return DEPLOYERS[site.kind](site, admin_email)
