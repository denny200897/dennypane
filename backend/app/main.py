from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text

from app.api.routes import (
    auth,
    cron,
    databases,
    docker,
    files,
    ftp,
    sites,
    ssh,
    system,
    terminal,
)
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import models  # noqa: F401  (register models on Base)
from app.models.models import User


def _ensure_columns() -> None:
    """Tiny additive migration: add new columns to existing tables (SQLite)."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    per_table = {
        "users": {
            "totp_secret": "VARCHAR(64) DEFAULT ''",
            "totp_enabled": "BOOLEAN DEFAULT 0",
            # Bumped on password/username change so old JWTs stop validating.
            "token_version": "INTEGER DEFAULT 0",
        },
        "ssh_hosts": {
            # Trust-on-first-use host key pin: "<keytype> <base64>".
            "host_key": "TEXT DEFAULT ''",
        },
    }
    with engine.begin() as conn:
        for table, additions in per_table.items():
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for col, ddl in additions.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))


def init_db() -> None:
    from app.core.config import DEFAULT_INSECURE_PASSWORD

    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    with SessionLocal() as db:
        if not db.scalar(select(User)):
            # Refuse to bootstrap the first admin with the insecure default
            # password — that would leave a publicly-known credential that grants
            # full host control through the panel.
            if (
                settings.admin_password == DEFAULT_INSECURE_PASSWORD
                and not settings.allow_insecure_secret
            ):
                raise RuntimeError(
                    "Refusing to create the bootstrap admin with the default "
                    "password. Set DENNY_ADMIN_PASSWORD to a strong value, or set "
                    "DENNY_ALLOW_INSECURE_SECRET=true for local dev only."
                )
            db.add(
                User(
                    username=settings.admin_username,
                    password_hash=hash_password(settings.admin_password),
                    is_admin=True,
                )
            )
            db.commit()


def _check_secret() -> None:
    from app.core.config import DEFAULT_INSECURE_SECRET

    if settings.secret_key == DEFAULT_INSECURE_SECRET and not settings.allow_insecure_secret:
        raise RuntimeError(
            "Refusing to start with the default DENNY_SECRET_KEY. "
            "Set a strong secret (openssl rand -hex 32), or set "
            "DENNY_ALLOW_INSECURE_SECRET=true for local dev only."
        )
    if len(settings.secret_key) < 32 and not settings.allow_insecure_secret:
        raise RuntimeError("DENNY_SECRET_KEY is too short; use at least 32 characters.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_secret()
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    # Interactive docs / OpenAPI off by default to reduce attack surface.
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # API only ever returns JSON; lock the document down so a stolen response
    # body can't be coerced into executing script.
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api"
for r in (
    auth.router,
    system.router,
    docker.router,
    sites.router,
    ssh.router,
    files.router,
    ftp.router,
    cron.router,
    databases.router,
    terminal.router,
):
    app.include_router(r, prefix=api_prefix)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name, "version": "0.1.0"}
