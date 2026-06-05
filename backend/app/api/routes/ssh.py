from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core import audit, crypto
from app.db.session import get_db
from app.models.models import SSHHost, User
from app.schemas.schemas import SSHCommand, SSHHostCreate, SSHHostOut
from app.services import ssh_service

router = APIRouter(prefix="/ssh", tags=["ssh"])


@router.get("/hosts", response_model=list[SSHHostOut])
def list_hosts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(SSHHost).order_by(SSHHost.name)))


@router.post("/hosts", response_model=SSHHostOut)
def create_host(body: SSHHostCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    data = body.model_dump()
    # Encrypt secrets at rest; they are never returned by SSHHostOut.
    data["password"] = crypto.encrypt(data.get("password", ""))
    data["private_key"] = crypto.encrypt(data.get("private_key", ""))
    host = SSHHost(**data)
    db.add(host)
    db.commit()
    db.refresh(host)
    return host


@router.delete("/hosts/{host_id}")
def delete_host(host_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    host = db.get(SSHHost, host_id)
    if not host:
        raise HTTPException(404, "Host not found")
    db.delete(host)
    db.commit()
    return {"ok": True}


@router.post("/hosts/{host_id}/test")
def test_host(host_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    host = db.get(SSHHost, host_id)
    if not host:
        raise HTTPException(404, "Host not found")
    return ssh_service.test_connection(host, db=db)


@router.post("/hosts/{host_id}/exec")
def exec_command(
    host_id: int,
    body: SSHCommand,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    host = db.get(SSHHost, host_id)
    if not host:
        raise HTTPException(404, "Host not found")
    audit.log("ssh.exec", subject=user.username, host=host.hostname)
    try:
        return ssh_service.run_command(host, body.command, db=db)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"SSH error: {exc}")
