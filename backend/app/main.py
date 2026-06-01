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
    if "users" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("users")}
    additions = {
        "totp_secret": "VARCHAR(64) DEFAULT ''",
        "totp_enabled": "BOOLEAN DEFAULT 0",
    }
    with engine.begin() as conn:
        for col, ddl in additions.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {ddl}"))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    with SessionLocal() as db:
        if not db.scalar(select(User)):
            db.add(
                User(
                    username=settings.admin_username,
                    password_hash=hash_password(settings.admin_password),
                    is_admin=True,
                )
            )
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

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
