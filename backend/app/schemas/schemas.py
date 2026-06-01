import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
class CronJobCreate(BaseModel):
    schedule: str  # e.g. "0 3 * * *"
    command: str
    label: str = ""


# ---- Proxy / SSL ----
class ProxyApply(BaseModel):
    enable_ssl: bool = False
    email: str | None = None
