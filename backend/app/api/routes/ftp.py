from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core import audit, crypto
from app.db.session import get_db
from app.models.models import FTPAccount, User
from app.schemas.schemas import FTPAccountCreate, FTPAccountOut
from app.services import ftp_service

router = APIRouter(prefix="/ftp", tags=["ftp"])


@router.get("/accounts", response_model=list[FTPAccountOut])
def list_accounts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(FTPAccount).order_by(FTPAccount.username)))


@router.post("/accounts", response_model=FTPAccountOut)
def create_account(body: FTPAccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.scalar(select(FTPAccount).where(FTPAccount.username == body.username)):
        raise HTTPException(409, "Username already exists")
    account = FTPAccount(**body.model_dump())
    # Provision with the plaintext password, then store it encrypted at rest.
    ftp_service.provision(account)
    account.password = crypto.encrypt(account.password)
    db.add(account)
    db.commit()
    db.refresh(account)
    audit.log("ftp.create", subject=user.username, account=account.username)
    return account


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    account = db.get(FTPAccount, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    ftp_service.deprovision(account)
    db.delete(account)
    db.commit()
    return {"ok": True}
