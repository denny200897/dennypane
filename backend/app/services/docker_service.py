"""Thin wrapper around the Docker SDK used by the API routes."""
from __future__ import annotations

import os

import docker
from docker.errors import DockerException, NotFound

_client: docker.DockerClient | None = None

# Host paths that must never be bind-mounted into a container: doing so would
# let an authenticated user escalate to full host control (e.g. mounting the
# Docker socket, or / and chrooting). Anything at or under these is rejected.
_FORBIDDEN_MOUNT_PREFIXES = (
    "/", "/etc", "/root", "/boot", "/dev", "/proc", "/sys",
    "/var/run", "/run", "/var/lib/docker", "/home",
)


class DockerUnavailable(RuntimeError):
    pass


class UnsafeMount(ValueError):
    pass


def _check_host_path(host_path: str) -> None:
    # Check both the literal normalized path and the symlink-resolved path, so a
    # symlink (or platform quirk like /etc -> /private/etc) can't slip a
    # sensitive directory past the denylist.
    candidates = {
        os.path.normpath(os.path.abspath(host_path)),
        os.path.realpath(host_path),
    }
    for path in candidates:
        if path == "/":
            raise UnsafeMount("refusing to mount filesystem root")
        for prefix in _FORBIDDEN_MOUNT_PREFIXES:
            if prefix == "/":
                continue
            if path == prefix or path.startswith(prefix + os.sep):
                raise UnsafeMount(
                    f"refusing to mount sensitive host path: {host_path}"
                )


def client() -> docker.DockerClient:
    global _client
    if _client is None:
        try:
            _client = docker.from_env()
            _client.ping()
        except DockerException as exc:  # pragma: no cover - env dependent
            raise DockerUnavailable(str(exc)) from exc
    return _client


def _container_dict(c) -> dict:
    ports: dict[str, list] = {}
    try:
        ports = c.attrs.get("NetworkSettings", {}).get("Ports") or {}
    except Exception:
        pass
    return {
        "id": c.short_id,
        "name": c.name,
        "image": c.image.tags[0] if c.image.tags else c.image.short_id,
        "status": c.status,
        "state": c.attrs.get("State", {}).get("Status", c.status),
        "ports": ports,
        "created": c.attrs.get("Created", ""),
    }


def list_containers(all_: bool = True) -> list[dict]:
    return [_container_dict(c) for c in client().containers.list(all=all_)]


def container_action(container_id: str, action: str) -> dict:
    c = client().containers.get(container_id)
    if action == "start":
        c.start()
    elif action == "stop":
        c.stop()
    elif action == "restart":
        c.restart()
    elif action == "remove":
        c.remove(force=True)
        return {"id": container_id, "removed": True}
    else:
        raise ValueError(f"unknown action: {action}")
    c.reload()
    return _container_dict(c)


def container_logs(container_id: str, tail: int = 200) -> str:
    c = client().containers.get(container_id)
    return c.logs(tail=tail).decode("utf-8", errors="replace")


def ensure_network(name: str):
    """Return (creating if needed) a user-defined bridge network.

    Containers on the default `bridge` network can't resolve each other by name;
    only a user-defined network gives them DNS, which is what app stacks (e.g.
    WordPress -> its MariaDB) rely on."""
    cli = client()
    try:
        return cli.networks.get(name)
    except NotFound:
        return cli.networks.create(name, driver="bridge")


def remove_network(name: str) -> None:
    try:
        client().networks.get(name).remove()
    except (NotFound, DockerException):
        pass


def run_container(
    image: str,
    name: str | None = None,
    ports: dict | None = None,
    env: dict | None = None,
    volumes: dict | None = None,
    restart: str = "unless-stopped",
    network: str | None = None,
) -> dict:
    # A volume source starting with "/" is a host bind mount (denylist-checked);
    # anything else is treated as a Docker named volume, which Docker auto-creates
    # and which avoids host-permission headaches for stateful images like MariaDB.
    vol: dict = {}
    for src, cont in (volumes or {}).items():
        if src.startswith("/"):
            _check_host_path(src)
        vol[src] = {"bind": cont, "mode": "rw"}
    c = client().containers.run(
        image,
        name=name,
        detach=True,
        ports=ports or {},
        environment=env or {},
        volumes=vol,
        restart_policy={"Name": restart} if restart else None,
        network=network,
    )
    c.reload()
    return _container_dict(c)


def list_images() -> list[dict]:
    out = []
    for img in client().images.list():
        out.append(
            {
                "id": img.short_id.replace("sha256:", ""),
                "tags": img.tags,
                "size": img.attrs.get("Size", 0),
            }
        )
    return out


def pull_image(reference: str) -> dict:
    img = client().images.pull(reference)
    return {"id": img.short_id, "tags": img.tags}


def summary() -> dict:
    c = client()
    containers = c.containers.list(all=True)
    running = sum(1 for x in containers if x.status == "running")
    return {
        "containers_total": len(containers),
        "containers_running": running,
        "containers_stopped": len(containers) - running,
        "images": len(c.images.list()),
    }


def get_container(container_id: str):
    try:
        return client().containers.get(container_id)
    except NotFound:
        return None
