import subprocess

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.core import audit
from app.models.models import User
from app.schemas.schemas import CronJobCreate
from app.services import cron_service

router = APIRouter(prefix="/cron", tags=["cron"])


def _guard():
    try:
        subprocess.run(["crontab", "-l"], capture_output=True)
    except FileNotFoundError:
        raise HTTPException(503, "crontab not available on host")


@router.get("/jobs")
def list_jobs(_: User = Depends(get_current_user)):
    _guard()
    return cron_service.list_jobs()


@router.post("/jobs")
def add_job(body: CronJobCreate, user: User = Depends(get_current_user)):
    _guard()
    audit.log("cron.add", subject=user.username, label=body.label)
    return cron_service.add_job(body.schedule, body.command, body.label)


@router.delete("/jobs/{label}")
def remove_job(label: str, _: User = Depends(get_current_user)):
    _guard()
    return cron_service.remove_job(label)
