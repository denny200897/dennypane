"""Resolve the real client IP, honouring trusted reverse proxies only."""
from __future__ import annotations

from fastapi import Request

from app.core.config import settings


def client_ip(request: Request) -> str:
    # Only trust X-Forwarded-For if we're knowingly behind N reverse proxies;
    # otherwise a client could spoof the header to dodge the login lockout or an
    # IP block. The real client is the Nth entry from the right of the
    # (proxy-appended) chain.
    n = settings.trusted_proxies
    if n > 0:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            parts = [p.strip() for p in fwd.split(",") if p.strip()]
            if parts:
                return parts[-min(n, len(parts))]
    return request.client.host if request.client else "unknown"
