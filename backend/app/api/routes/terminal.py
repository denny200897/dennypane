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

from app.core.security import decode_access_token

router = APIRouter(tags=["terminal"])

try:
    import pty  # noqa: F401

    PTY_AVAILABLE = True
except ImportError:  # pragma: no cover - windows
    PTY_AVAILABLE = False


def _set_winsize(fd: int, rows: int, cols: int) -> None:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


@router.websocket("/terminal/ws")
async def terminal_ws(ws: WebSocket):
    token = ws.query_params.get("token", "")
    if not decode_access_token(token):
        await ws.close(code=4401)
        return
    if not PTY_AVAILABLE:
        await ws.accept()
        await ws.send_text("Terminal not supported on this host OS.\r\n")
        await ws.close()
        return

    import pty

    await ws.accept()
    shell = os.environ.get("SHELL", "/bin/bash")
    pid, fd = pty.fork()
    if pid == 0:  # child
        os.execvp(shell, [shell])
        return

    loop = asyncio.get_event_loop()

    async def pty_to_ws():
        try:
            while True:
                data = await loop.run_in_executor(None, os.read, fd, 1024)
                if not data:
                    break
                await ws.send_bytes(data)
        except (OSError, WebSocketDisconnect):
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
                except ValueError:
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
