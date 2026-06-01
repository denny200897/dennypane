"""Reverse-proxy + TLS management.

Generates an nginx server block per domain that proxies to the site's container
upstream port, and (optionally) obtains a Let's Encrypt certificate via certbot.

On non-Linux dev machines the nginx/certbot binaries are usually absent; the
functions degrade gracefully and report what *would* happen so the UI still works.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

from app.models.models import Site

_DOMAIN_RE = re.compile(r"^[a-zA-Z0-9.-]{1,253}$")

NGINX_SITES_DIR = Path("/etc/nginx/conf.d")

SERVER_TEMPLATE = """# Managed by dennyPanel — do not edit by hand
server {{
    listen 80;
    server_name {domain};
{acme}
    location / {{
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""


def _have(binary: str) -> bool:
    return shutil.which(binary) is not None


def _conf_path(domain: str) -> Path:
    return NGINX_SITES_DIR / f"{domain}.conf"


def write_vhost(site: Site, enable_ssl: bool = False) -> dict:
    if site.upstream_port <= 0:
        raise ValueError("site has no upstream port to proxy to")
    # Defense in depth: never write an unvalidated domain into an nginx config.
    if not _DOMAIN_RE.match(site.domain):
        raise ValueError("invalid domain")
    acme = (
        "    location /.well-known/acme-challenge/ { root /var/www/certbot; }\n"
        if enable_ssl
        else ""
    )
    config = SERVER_TEMPLATE.format(domain=site.domain, port=site.upstream_port, acme=acme)

    if not _have("nginx"):
        return {
            "applied": False,
            "reason": "nginx not installed on host",
            "config": config,
        }
    NGINX_SITES_DIR.mkdir(parents=True, exist_ok=True)
    _conf_path(site.domain).write_text(config)
    reload_result = _reload_nginx()
    return {"applied": True, "config": config, "nginx_reload": reload_result}


def _reload_nginx() -> str:
    try:
        subprocess.run(["nginx", "-t"], check=True, capture_output=True)
        subprocess.run(["nginx", "-s", "reload"], check=True, capture_output=True)
        return "reloaded"
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        return f"reload failed: {exc}"


def issue_certificate(site: Site, email: str | None) -> dict:
    if not _have("certbot"):
        return {"issued": False, "reason": "certbot not installed on host"}
    cmd = [
        "certbot", "certonly", "--webroot", "-w", "/var/www/certbot",
        "-d", site.domain, "--non-interactive", "--agree-tos",
    ]
    cmd += ["-m", email] if email else ["--register-unsafely-without-email"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        ok = out.returncode == 0
        return {"issued": ok, "stdout": out.stdout[-2000:], "stderr": out.stderr[-2000:]}
    except subprocess.TimeoutExpired:
        return {"issued": False, "reason": "certbot timed out"}


def remove_vhost(domain: str) -> None:
    path = _conf_path(domain)
    if path.exists():
        path.unlink()
        _reload_nginx()
