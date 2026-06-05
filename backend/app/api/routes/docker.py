from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.core import audit
from app.models.models import User
from app.schemas.schemas import ContainerAction, RunContainer
from app.services import docker_service as ds

router = APIRouter(prefix="/docker", tags=["docker"])


def _guard():
    try:
        ds.client()
    except ds.DockerUnavailable as exc:
        raise HTTPException(503, f"Docker unavailable: {exc}")


@router.get("/summary")
def summary(_: User = Depends(get_current_user)):
    _guard()
    return ds.summary()


@router.get("/containers")
def containers(all: bool = True, _: User = Depends(get_current_user)):
    _guard()
    return ds.list_containers(all_=all)


@router.post("/containers/{container_id}/action")
def container_action(container_id: str, body: ContainerAction, user: User = Depends(get_current_user)):
    _guard()
    audit.log("docker.container_action", subject=user.username,
              container=container_id, op=body.action)
    try:
        return ds.container_action(container_id, body.action)
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@router.get("/containers/{container_id}/logs")
def container_logs(container_id: str, tail: int = 200, _: User = Depends(get_current_user)):
    _guard()
    return {"logs": ds.container_logs(container_id, tail)}


@router.post("/containers")
def run_container(body: RunContainer, user: User = Depends(get_current_user)):
    _guard()
    audit.log("docker.run_container", subject=user.username, image=body.image)
    try:
        return ds.run_container(
            image=body.image,
            name=body.name,
            ports={k: v for k, v in body.ports.items()},
            env=body.env,
            volumes=body.volumes,
            restart=body.restart,
        )
    except ds.UnsafeMount as exc:
        raise HTTPException(400, str(exc))


@router.get("/images")
def images(_: User = Depends(get_current_user)):
    _guard()
    return ds.list_images()


@router.post("/images/pull")
def pull_image(reference: str, _: User = Depends(get_current_user)):
    _guard()
    return ds.pull_image(reference)
