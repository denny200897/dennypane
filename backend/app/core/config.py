from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_INSECURE_SECRET = "change-me-in-production-please-use-a-long-random-string"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DENNY_", env_file=".env", extra="ignore")

    app_name: str = "dennyPanel"
    secret_key: str = DEFAULT_INSECURE_SECRET
    access_token_expire_minutes: int = 60 * 24
    algorithm: str = "HS256"

    # Set true to permit running with the insecure default secret (dev only).
    allow_insecure_secret: bool = False
    # Expose FastAPI's interactive docs. Off by default for internet exposure.
    enable_docs: bool = False

    # Upload + login-throttle hardening
    max_upload_mb: int = 100
    login_max_attempts: int = 10
    login_window_seconds: int = 300

    # First-run admin bootstrap (only used if no users exist yet)
    admin_username: str = "admin"
    admin_password: str = "dennypanel"

    database_url: str = f"sqlite:///{Path(__file__).resolve().parents[2] / 'dennypanel.db'}"

    # Where managed website/static files live on the host.
    # Defaults to a project-local, writable path for dev; set DENNY_SITES_ROOT
    # to /opt/dennypanel/sites (or similar) in production.
    sites_root: str = str(Path(__file__).resolve().parents[2] / "data" / "sites")

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
