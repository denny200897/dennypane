from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core import audit, ratelimit
from app.core.netutil import client_ip
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.models import BlockedIP, LoginEvent, User
from app.schemas.schemas import (
    BlockIPIn,
    BlockedIPOut,
    LoginEventOut,
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

# Pre-computed hash so login does the same bcrypt work whether or not the
# username exists, removing the timing oracle for username enumeration.
_DUMMY_HASH = hash_password("dennypanel-timing-equalizer")


def _record_login(
    db: Session, *, username: str, ip: str, user_agent: str, success: bool, reason: str = ""
) -> None:
    db.add(
        LoginEvent(
            username=username[:64],
            ip=ip,
            user_agent=(user_agent or "")[:512],
            success=success,
            reason=reason,
        )
    )
    db.commit()


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    otp: str = Form(""),
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    ua = request.headers.get("user-agent", "")
    # Rate-limit FIRST so a flood of requests (from any IP, blocked or not) can't
    # drive unbounded login_event inserts and fill the disk. Once an IP trips the
    # limiter it short-circuits here before touching the DB.
    cooldown = ratelimit.is_blocked(ip)
    if cooldown:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"登入嘗試過於頻繁，請於 {cooldown} 秒後再試",
        )
    if db.scalar(select(BlockedIP).where(BlockedIP.ip == ip)):
        # Count blocked hits as failures so repeated probing gets throttled too.
        ratelimit.record_failure(ip)
        _record_login(db, username=form.username, ip=ip, user_agent=ua, success=False, reason="blocked")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "您的 IP 位址已被封鎖")
    user = db.scalar(select(User).where(User.username == form.username))
    password_ok = (
        verify_password(form.password, user.password_hash)
        if user
        else verify_password(form.password, _DUMMY_HASH)  # equalize timing
    )
    if not user or not password_ok:
        ratelimit.record_failure(ip)
        _record_login(db, username=form.username, ip=ip, user_agent=ua, success=False, reason="bad_password")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "帳號或密碼錯誤")
    if user.totp_enabled:
        if not otp:
            # Signals the client to prompt for a 2FA code and resubmit.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, OTP_REQUIRED)
        if not totp_service.verify(user.totp_secret, otp):
            ratelimit.record_failure(ip)
            _record_login(db, username=user.username, ip=ip, user_agent=ua, success=False, reason="bad_otp")
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "兩步驟驗證碼錯誤")
    ratelimit.reset(ip)
    _record_login(db, username=user.username, ip=ip, user_agent=ua, success=True)
    audit.log("auth.login", subject=user.username, ip=ip)
    return Token(access_token=create_access_token(user.username, user.token_version))


@router.get("/login-history", response_model=list[LoginEventOut])
def login_history(
    limit: int = 100,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    return list(
        db.scalars(select(LoginEvent).order_by(LoginEvent.created_at.desc()).limit(limit))
    )


@router.get("/blocked-ips", response_model=list[BlockedIPOut])
def list_blocked_ips(
    _: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return list(db.scalars(select(BlockedIP).order_by(BlockedIP.created_at.desc())))


@router.post("/blocked-ips", response_model=BlockedIPOut)
def block_ip(
    body: BlockIPIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Guard against self-lockout: blocking your own IP would reject your very
    # next request (including the unblock call) and brick the panel.
    if body.ip == client_ip(request):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "無法封鎖您目前使用的 IP 位址")
    existing = db.scalar(select(BlockedIP).where(BlockedIP.ip == body.ip))
    if existing:
        return existing
    entry = BlockedIP(ip=body.ip, reason=body.reason)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    audit.log("auth.block_ip", subject=user.username, ip=body.ip, reason=body.reason)
    return entry


@router.delete("/blocked-ips/{block_id}")
def unblock_ip(
    block_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.get(BlockedIP, block_id)
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "找不到此封鎖紀錄")
    audit.log("auth.unblock_ip", subject=user.username, ip=entry.ip)
    db.delete(entry)
    db.commit()
    return {"ok": True}


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
    user.token_version += 1  # revoke all existing tokens
    db.commit()
    audit.log("auth.password_change", subject=user.username)
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
    user.token_version += 1  # revoke tokens minted under the old username
    db.commit()
    audit.log("auth.username_change", subject=new)
    # Username is the token subject, so issue a fresh token.
    return Token(access_token=create_access_token(new, user.token_version))


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
    audit.log("auth.2fa_disable", subject=user.username)
    return {"ok": True}
