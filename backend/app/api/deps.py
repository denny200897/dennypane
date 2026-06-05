from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.netutil import client_ip
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.models import BlockedIP, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    # A blocked (suspicious) IP is rejected before its token is even checked, so
    # flagging an IP immediately invalidates any session already open from it.
    ip = client_ip(request)
    if db.scalar(select(BlockedIP).where(BlockedIP.ip == ip)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "您的 IP 位址已被封鎖")
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.scalar(select(User).where(User.username == payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    # Reject tokens issued before the user's last credential change.
    if payload.get("ver", 0) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has been revoked")
    return user
