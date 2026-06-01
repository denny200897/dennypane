"""Time-based one-time password (TOTP) helpers for two-factor auth."""
from __future__ import annotations

import pyotp

from app.core.config import settings


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(username: str, secret: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=settings.app_name)


def verify(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    # valid_window=1 tolerates ±30s clock drift
    return pyotp.TOTP(secret).verify(code.strip().replace(" ", ""), valid_window=1)
