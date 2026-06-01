from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core import ratelimit
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


def _client_ip(request: Request) -> str:
    # Trust the reverse proxy's forwarded client IP if present.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    otp: str = Form(""),
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    blocked = ratelimit.is_blocked(ip)
    if blocked:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"登入嘗試過於頻繁，請於 {blocked} 秒後再試",
        )
    user = db.scalar(select(User).where(User.username == form.username))
    if not user or not verify_password(form.password, user.password_hash):
        ratelimit.record_failure(ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "帳號或密碼錯誤")
    if user.totp_enabled:
        if not otp:
            # Signals the client to prompt for a 2FA code and resubmit.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, OTP_REQUIRED)
        if not totp_service.verify(user.totp_secret, otp):
            ratelimit.record_failure(ip)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "兩步驟驗證碼錯誤")
    ratelimit.reset(ip)
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
