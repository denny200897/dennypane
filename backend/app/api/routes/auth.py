from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.models import User
from app.schemas.schemas import (
    PasswordChange,
    Token,
    TwoFADisable,
    TwoFASetupOut,
    TwoFAVerify,
    UserOut,
    UsernameChange,
)
from app.services import totp_service

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_REQUIRED = "OTP_REQUIRED"


@router.post("/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    otp: str = Form(""),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.username == form.username))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "帳號或密碼錯誤")
    if user.totp_enabled:
        if not otp:
            # Signals the client to prompt for a 2FA code and resubmit.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, OTP_REQUIRED)
        if not totp_service.verify(user.totp_secret, otp):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "兩步驟驗證碼錯誤")
    return Token(access_token=create_access_token(user.username))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/password")
def change_password(
    body: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "目前的密碼不正確")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.post("/username", response_model=Token)
def change_username(
    body: UsernameChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "目前的密碼不正確")
    new = body.new_username.strip()
    if db.scalar(select(User).where(User.username == new, User.id != user.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "此使用者名稱已被使用")
    user.username = new
    db.commit()
    # Username is the token subject, so issue a fresh token.
    return Token(access_token=create_access_token(new))


@router.post("/2fa/setup", response_model=TwoFASetupOut)
def setup_2fa(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "兩步驟驗證已啟用")
    secret = totp_service.new_secret()
    user.totp_secret = secret  # stored but not active until verified+enabled
    db.commit()
    return TwoFASetupOut(secret=secret, otpauth_uri=totp_service.provisioning_uri(user.username, secret))


@router.post("/2fa/enable")
def enable_2fa(
    body: TwoFAVerify,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.totp_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "請先設定兩步驟驗證")
    if not totp_service.verify(user.totp_secret, body.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "驗證碼錯誤，請再試一次")
    user.totp_enabled = True
    db.commit()
    return {"ok": True}


@router.post("/2fa/disable")
def disable_2fa(
    body: TwoFADisable,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "密碼不正確")
    user.totp_enabled = False
    user.totp_secret = ""
    db.commit()
    return {"ok": True}
