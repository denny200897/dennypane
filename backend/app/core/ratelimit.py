"""In-memory failed-login throttle (per client IP).

Lightweight and dependency-free. For multi-instance deployments swap this for a
shared store (e.g. Redis), but for a single-node panel it stops online brute
force effectively.
"""
from __future__ import annotations

import threading
import time

from app.core.config import settings

_lock = threading.Lock()
# ip -> (window_start_epoch, failed_count)
_attempts: dict[str, tuple[float, int]] = {}


def _now() -> float:
    return time.time()


def is_blocked(ip: str) -> int:
    """Return seconds remaining in lockout, or 0 if allowed."""
    with _lock:
        rec = _attempts.get(ip)
        if not rec:
            return 0
        start, count = rec
        elapsed = _now() - start
        if elapsed >= settings.login_window_seconds:
            _attempts.pop(ip, None)
            return 0
        if count >= settings.login_max_attempts:
            return int(settings.login_window_seconds - elapsed)
        return 0


def record_failure(ip: str) -> None:
    with _lock:
        start, count = _attempts.get(ip, (_now(), 0))
        if _now() - start >= settings.login_window_seconds:
            start, count = _now(), 0
        _attempts[ip] = (start, count + 1)


def reset(ip: str) -> None:
    with _lock:
        _attempts.pop(ip, None)
