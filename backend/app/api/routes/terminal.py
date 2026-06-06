"""In-browser interactive terminal over a websocket.

Spawns a PTY running the host shell and bridges bytes both ways. The token is
passed as a query parameter because browsers can't set headers on a WebSocket.
Available on POSIX hosts (uses the `pty` module).
"""
from __future__ import annotations

import asyncio
import fcntl
import os
import signal
import struct
import termios

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from urllib.parse import urlsplit

from app.core import audit
from app.core.config import settings
from app.core.security import decode_access_token

router = APIRouter(tags=["terminal"])


def _origin_allowed(ws: WebSocket) -> bool:
    """Reject cross-site WebSocket connections (CSWSH defense in depth).

    Allowed when: no Origin header (non-browser client), the Origin is same-host
    as the request (behind the bundled proxy), or it's in the CORS allowlist
    (covers the dev setup where the UI on :3000 talks to the API on :8000)."""
    origin = ws.headers.get("origin")
    if not origin:
        return True
    if origin in settings.cors_origins:
        return True
    host = ws.headers.get("host", "")
    return urlsplit(origin).netloc == host

try:
    import pty  # noqa: F401

    PTY_AVAILABLE = True
except ImportError:  # pragma: no cover - windows
    PTY_AVAILABLE = False


def _set_winsize(fd: int, rows: int, cols: int) -> None:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


def _ip_blocked(ws: WebSocket) -> bool:
    """True if the connecting IP has been flagged as suspicious. Blocking an IP
    therefore severs its terminal access too, not just the HTTP API."""
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.models.models import BlockedIP

    n = settings.trusted_proxies
    ip = None
    if n > 0:
        fwd = ws.headers.get("x-forwarded-for")
        if fwd:
            parts = [p.strip() for p in fwd.split(",") if p.strip()]
            if parts:
                ip = parts[-min(n, len(parts))]
    if ip is None:
        ip = ws.client.host if ws.client else "unknown"
    with SessionLocal() as db:
        return db.scalar(select(BlockedIP).where(BlockedIP.ip == ip)) is not None


def _resolve_shell() -> str:
    """Pick a shell that actually exists on the host.

    The previous code blindly used $SHELL or /bin/bash; on a slim image (the API
    often runs in a minimal container) bash isn't installed, so exec failed and
    the terminal showed nothing. Fall back through sensible candidates."""
    import shutil

    candidates = [os.environ.get("SHELL"), "/bin/bash", "/bin/sh", "/usr/bin/sh"]
    for cand in candidates:
        if cand and (os.path.isfile(cand) or shutil.which(cand)):
            return cand
    return "/bin/sh"


AUTH_PREFIX = "\x00auth:"


@router.websocket("/terminal/ws")
async def terminal_ws(ws: WebSocket):
    if not _origin_allowed(ws):
        await ws.close(code=4403)
        return
    await ws.accept()
    # The token arrives as the first message rather than a query parameter, so
    # it can't leak into reverse-proxy access logs or browser history.
    try:
        first = await asyncio.wait_for(ws.receive(), timeout=10)
    except (asyncio.TimeoutError, WebSocketDisconnect):
        await ws.close(code=4401)
        return
    auth_text = first.get("text") or ""
    token = auth_text[len(AUTH_PREFIX):] if auth_text.startswith(AUTH_PREFIX) else ""
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        await ws.close(code=4401)
        return
    # Honour token revocation the same way the HTTP API does: a token minted
    # before the user's last credential change (token_version bump) must NOT be
    # able to open a host shell, otherwise changing your password fails to cut
    # off an already-leaked session here.
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.models.models import User

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == payload["sub"]))
        if not user or payload.get("ver", 0) != user.token_version:
            await ws.close(code=4401)
            return
    if _ip_blocked(ws):
        await ws.close(code=4403)
        return
    audit.log("terminal.connect", subject=payload.get("sub"))
    if not PTY_AVAILABLE:
        await ws.send_text("Terminal not supported on this host OS.\r\n")
        await ws.close()
        return

    import pty
    shell = _resolve_shell()
    pid, fd = pty.fork()
    if pid == 0:  # child
        # A real terminal needs TERM set or curses apps (vim, top, less) break.
        os.environ.setdefault("TERM", "xterm-256color")
        try:
            # "-" arg name makes it a login shell so the user's profile loads.
            os.execvp(shell, [shell])
        except OSError:
            # exec failed (shell missing): tell the parent, then exit hard so we
            # don't run the parent's event-loop code in the forked child.
            os.write(2, f"failed to start shell: {shell}\r\n".encode())
            os._exit(127)
        os._exit(0)

    loop = asyncio.get_running_loop()

    async def pty_to_ws():
        try:
            while True:
                data = await loop.run_in_executor(None, os.read, fd, 4096)
                if not data:
                    break
                await ws.send_bytes(data)
        except (OSError, WebSocketDisconnect):
            pass
        finally:
            # Shell exited (EOF) — close the socket so the client shows "已斷線"
            # instead of hanging on a dead session.
            try:
                await ws.close()
            except RuntimeError:
                pass

    reader = asyncio.create_task(pty_to_ws())
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            text = msg.get("text")
            data = msg.get("bytes")
            if text and text.startswith("\x00resize:"):
                try:
                    _, rows, cols = text.split(":")
                    _set_winsize(fd, int(rows), int(cols))
                except (ValueError, OSError):
                    pass
            elif text is not None:
                os.write(fd, text.encode())
            elif data is not None:
                os.write(fd, data)
    except WebSocketDisconnect:
        pass
    finally:
        # Kill the child shell FIRST so any read() blocked on the PTY master
        # gets EOF and returns — otherwise that thread (and the server) can wedge
        # in an uninterruptible state. Then cancel the reader, close the fd, reap.
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        reader.cancel()
        try:
            os.close(fd)
        except OSError:
            pass
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass
