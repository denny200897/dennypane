from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Auth ----
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    is_admin: bool


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


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
