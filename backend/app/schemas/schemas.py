import os
import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import settings

# Hostname / domain: letters, digits, dots and hyphens only. Blocks whitespace,
# slashes, quotes and newlines that could inject into nginx configs or HTML.
_DOMAIN_RE = re.compile(r"^(?=.{1,253}$)([a-zA-Z0-9](-?[a-zA-Z0-9])*)(\.[a-zA-Z0-9](-?[a-zA-Z0-9])*)*$")
# Unix usernames for FTP/SFTP accounts.
_UNAME_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")


# ---- Auth ----
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    is_admin: bool
    totp_enabled: bool


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class UsernameChange(BaseModel):
    current_password: str
    new_username: str = Field(min_length=3, max_length=64)


class TwoFASetupOut(BaseModel):
    secret: str
    otpauth_uri: str


class TwoFAVerify(BaseModel):
    code: str


class TwoFADisable(BaseModel):
    password: str


# ---- AI assistant ----
class ChatMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    # Cap the conversation so a single request can't balloon token usage.
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)


class ChatReply(BaseModel):
    reply: str


# ---- Login history / IP blocking ----
class LoginEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    ip: str
    user_agent: str
    success: bool
    reason: str
    created_at: datetime


class BlockedIPOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ip: str
    reason: str
    created_at: datetime


class BlockIPIn(BaseModel):
    ip: str
    reason: str = ""

    @field_validator("ip")
    @classmethod
    def _valid_ip(cls, v: str) -> str:
        import ipaddress

        v = v.strip()
        try:
            ipaddress.ip_address(v)
        except ValueError:
            raise ValueError("IP 位址格式不正確")
        return v


# ---- Docker ----
class ContainerAction(BaseModel):
    action: str  # start | stop | restart | remove


class RunContainer(BaseModel):
    image: str
    name: str | None = None
    ports: dict[str, int] = {}  # "80/tcp": 8080
    env: dict[str, str] = {}
    volumes: dict[str, str] = {}  # host_path: container_path
    restart: str = "unless-stopped"


# ---- Sites / Apps ----
class SiteCreate(BaseModel):
    domain: str
    kind: str  # static | wordpress | ghost | proxy
    upstream_port: int = 0
    admin_email: str | None = None

    @field_validator("domain")
    @classmethod
    def _valid_domain(cls, v: str) -> str:
        v = v.strip().lower()
        if not _DOMAIN_RE.match(v):
            raise ValueError("網域格式不正確（僅允許字母、數字、點與連字號）")
        return v

    @field_validator("kind")
    @classmethod
    def _valid_kind(cls, v: str) -> str:
        if v not in {"static", "wordpress", "ghost", "proxy"}:
            raise ValueError("不支援的網站類型")
        return v


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    domain: str
    kind: str
    root_path: str
    container_id: str
    upstream_port: int
    ssl_enabled: bool
    status: str
    created_at: datetime


# ---- SSH ----
class SSHHostCreate(BaseModel):
    name: str
    hostname: str
    port: int = 22
    username: str
    password: str = ""
    private_key: str = ""


class SSHHostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    hostname: str
    port: int
    username: str


class SSHCommand(BaseModel):
    command: str


# ---- Files ----
class FileWrite(BaseModel):
    path: str
    content: str


class PathBody(BaseModel):
    path: str


# ---- FTP ----
class FTPAccountCreate(BaseModel):
    username: str
    password: str = Field(min_length=4)
    home_dir: str
    protocol: str = "sftp"  # ftp | sftp

    @field_validator("username")
    @classmethod
    def _valid_username(cls, v: str) -> str:
        if not _UNAME_RE.match(v):
            raise ValueError("使用者名稱不合法（小寫字母開頭，僅限字母、數字、_、-）")
        return v

    @field_validator("home_dir")
    @classmethod
    def _valid_home_dir(cls, v: str) -> str:
        v = v.strip()
        # Must be an absolute, traversal-free path confined to the allowed root,
        # so an account can't be pointed at /etc, /root, etc.
        if not v.startswith("/") or ".." in v.split("/"):
            raise ValueError("家目錄必須為絕對路徑且不可包含 '..'")
        root = os.path.realpath(settings.ftp_home_root)
        resolved = os.path.realpath(v)
        if resolved != root and not resolved.startswith(root + os.sep):
            raise ValueError(f"家目錄必須位於 {settings.ftp_home_root} 之下")
        return v

    @field_validator("protocol")
    @classmethod
    def _valid_protocol(cls, v: str) -> str:
        if v not in {"ftp", "sftp"}:
            raise ValueError("協定僅支援 ftp 或 sftp")
        return v


class FTPAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    home_dir: str
    protocol: str
    status: str


# ---- Cron ----
# A 5-field cron schedule made of the characters crontab actually allows.
_CRON_RE = re.compile(r"^[\d*/,\-]+( +[\d*/,\-]+){4}$")


class CronJobCreate(BaseModel):
    schedule: str  # e.g. "0 3 * * *"
    command: str
    label: str = ""

    @field_validator("schedule")
    @classmethod
    def _valid_schedule(cls, v: str) -> str:
        v = v.strip()
        if not _CRON_RE.match(v):
            raise ValueError("排程格式不正確（需為 5 欄位的 cron 字串）")
        return v

    @field_validator("command", "label")
    @classmethod
    def _no_newlines(cls, v: str) -> str:
        # Block CR/LF so a single job can't inject extra crontab lines.
        if any(c in v for c in "\r\n"):
            raise ValueError("不可包含換行字元")
        return v


# ---- Proxy / SSL ----
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ProxyApply(BaseModel):
    enable_ssl: bool = False
    email: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        v = v.strip()
        # Passed to certbot -m; keep it a plain address (no flags/whitespace).
        if not _EMAIL_RE.match(v):
            raise ValueError("電子郵件格式不正確")
        return v
