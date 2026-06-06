from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_INSECURE_SECRET = "change-me-in-production-please-use-a-long-random-string"
DEFAULT_INSECURE_PASSWORD = "dennypanel"


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
    admin_password: str = DEFAULT_INSECURE_PASSWORD

    # Number of trusted reverse proxies in front of the app. When 0 (default),
    # the client's X-Forwarded-For header is IGNORED and the real socket peer is
    # used for rate-limiting, so a spoofed header can't bypass the login lockout.
    # Behind the bundled nginx/Caddy proxy, set DENNY_TRUSTED_PROXIES=1.
    trusted_proxies: int = 0

    # Allowed parent directory for FTP/SFTP account home dirs (defense in depth).
    ftp_home_root: str = "/home"

    database_url: str = f"sqlite:///{Path(__file__).resolve().parents[2] / 'dennypanel.db'}"

    # Where managed website/static files live on the host.
    # Defaults to a project-local, writable path for dev; set DENNY_SITES_ROOT
    # to /opt/dennypanel/sites (or similar) in production.
    sites_root: str = str(Path(__file__).resolve().parents[2] / "data" / "sites")

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # --- AI assistant (optional) ---
    # NewAPI / any OpenAI-compatible endpoint. The key is read ONLY here on the
    # server and is never sent to the browser; the frontend talks to our own
    # /api/assistant/chat proxy. Leave the key empty to disable the feature.
    assistant_api_key: str = ""
    assistant_base_url: str = ""  # e.g. https://your-newapi.example.com/v1
    assistant_model: str = "gpt-4o-mini"
    assistant_timeout_seconds: int = 60
    # Cap each request so a single chat can't run up an unbounded token bill.
    assistant_max_tokens: int = 1024

    @property
    def assistant_enabled(self) -> bool:
        return bool(self.assistant_api_key and self.assistant_base_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
