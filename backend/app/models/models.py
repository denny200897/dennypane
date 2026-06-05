from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LoginEvent(Base):
    """A record of a login attempt, for the audit/security history page."""

    __tablename__ = "login_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), index=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    user_agent: Mapped[str] = mapped_column(String(512), default="")
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    # Short reason on failure: "bad_password", "bad_otp", "blocked", ...
    reason: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)


class BlockedIP(Base):
    """An IP an operator has flagged as suspicious. Blocked IPs can't log in and
    their existing tokens are rejected on the next request (i.e. forced logout)."""

    __tablename__ = "blocked_ips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ip: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    reason: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(default=True)
    totp_secret: Mapped[str] = mapped_column(String(64), default="")
    totp_enabled: Mapped[bool] = mapped_column(default=False)
    # Incremented on credential changes to invalidate previously-issued tokens.
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    domain: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(32))  # static | wordpress | ghost | proxy
    root_path: Mapped[str] = mapped_column(String(512), default="")
    container_id: Mapped[str] = mapped_column(String(128), default="")
    upstream_port: Mapped[int] = mapped_column(Integer, default=0)
    ssl_enabled: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(String(32), default="created")
    meta: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class FTPAccount(Base):
    __tablename__ = "ftp_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # NOTE: encrypt at rest in production.
    password: Mapped[str] = mapped_column(String(255))
    home_dir: Mapped[str] = mapped_column(String(512))
    protocol: Mapped[str] = mapped_column(String(8), default="sftp")  # ftp | sftp
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SSHHost(Base):
    __tablename__ = "ssh_hosts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    hostname: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(Integer, default=22)
    username: Mapped[str] = mapped_column(String(128))
    # NOTE: stored credentials should be encrypted at rest in production.
    password: Mapped[str] = mapped_column(String(255), default="")
    private_key: Mapped[str] = mapped_column(Text, default="")
    # Pinned host key (TOFU). Empty until the first successful connection.
    host_key: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
