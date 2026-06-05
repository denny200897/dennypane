"""Symmetric encryption for credentials stored at rest (SSH/FTP secrets).

The key is derived from DENNY_SECRET_KEY, so rotating the secret invalidates
stored ciphertext (decrypt then returns "" rather than leaking garbage). Values
are tagged with a version prefix so plaintext written by older builds is still
readable during migration.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

PREFIX = "enc:v1:"


def _fernet() -> Fernet:
    key = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    return PREFIX + _fernet().encrypt(plaintext.encode()).decode()


def decrypt(value: str) -> str:
    if not value or not value.startswith(PREFIX):
        # Backward-compat: legacy plaintext stored before encryption existed.
        return value
    try:
        return _fernet().decrypt(value[len(PREFIX):].encode()).decode()
    except InvalidToken:
        return ""
