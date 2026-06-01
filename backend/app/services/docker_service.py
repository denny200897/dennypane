"""Thin wrapper around the Docker SDK used by the API routes."""
from __future__ import annotations

import docker
from docker.errors import DockerException, NotFound

_client: docker.DockerClient | None = None


class DockerUnavailable(RuntimeError):
    pass


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


def run_container(
    image: str,
    name: str | None = None,
    ports: dict | None = None,
    env: dict | None = None,
    volumes: dict | None = None,
    restart: str = "unless-stopped",
) -> dict:
    vol = {host: {"bind": cont, "mode": "rw"} for host, cont in (volumes or {}).items()}
    c = client().containers.run(
        image,
        name=name,
        detach=True,
        ports=ports or {},
        environment=env or {},
        volumes=vol,
        restart_policy={"Name": restart} if restart else None,
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
