"""Lightweight audit logging for high-risk actions.

Emits a structured line to the `dennypanel.audit` logger so operators can wire it
into their normal log pipeline. Intentionally dependency-free.
"""
from __future__ import annotations

import logging

_logger = logging.getLogger("dennypanel.audit")


def log(action: str, *, subject: str | None = None, **fields: object) -> None:
    parts = [f"action={action}", f"user={subject or '?'}"]
    parts += [f"{k}={v}" for k, v in fields.items()]
    _logger.info(" ".join(parts))
