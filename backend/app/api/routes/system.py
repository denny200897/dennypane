from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.models import User
from app.services import system_service

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/overview")
def overview(_: User = Depends(get_current_user)):
    return system_service.overview()


@router.get("/processes")
def processes(limit: int = 20, _: User = Depends(get_current_user)):
    return system_service.processes(limit)
