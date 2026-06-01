from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.models.models import User
from app.services import db_service
from app.services import docker_service as ds

router = APIRouter(prefix="/databases", tags=["databases"])


def _guard():
    try:
        ds.client()
    except ds.DockerUnavailable as exc:
        raise HTTPException(503, f"Docker unavailable: {exc}")


@router.get("/servers")
def servers(_: User = Depends(get_current_user)):
    _guard()
    return [{k: v for k, v in s.items() if k != "_env"} for s in db_service.list_servers()]


@router.get("/servers/{container_id}/databases")
def databases(container_id: str, _: User = Depends(get_current_user)):
    _guard()
    return db_service.list_databases(container_id)
