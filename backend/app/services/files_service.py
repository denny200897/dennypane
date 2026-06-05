"""Sandboxed file manager rooted at SITES_ROOT.

All paths are resolved and checked to stay within the configured root so the
panel can't be used to read/write arbitrary host files.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings

ROOT = Path(settings.sites_root)


class PathError(ValueError):
    pass


def _resolve(rel: str) -> Path:
    try:
        ROOT.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise PathError(f"sites root not writable ({ROOT}): {exc}")
    target = (ROOT / rel.lstrip("/")).resolve()
    root = ROOT.resolve()
    if target != root and root not in target.parents:
        raise PathError("path escapes managed root")
    return target


def listdir(rel: str = "") -> dict:
    target = _resolve(rel)
    if not target.exists():
        raise PathError("not found")
    entries = []
    for p in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
        stat = p.stat()
        entries.append(
            {
                "name": p.name,
                "path": str(p.relative_to(ROOT.resolve())),
                "is_dir": p.is_dir(),
                "size": stat.st_size,
                "modified": int(stat.st_mtime),
            }
        )
    return {"path": str(target.relative_to(ROOT.resolve())) if target != ROOT.resolve() else "", "entries": entries}


def read_file(rel: str, max_bytes: int = 1_000_000) -> str:
    target = _resolve(rel)
    if not target.is_file():
        raise PathError("not a file")
    data = target.read_bytes()[:max_bytes]
    return data.decode("utf-8", errors="replace")


def write_file(rel: str, content: str) -> dict:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content.encode("utf-8")) > max_bytes:
        raise PathError(f"內容超過上限 {settings.max_upload_mb} MB")
    target = _resolve(rel)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return {"path": rel, "size": target.stat().st_size}


def mkdir(rel: str) -> dict:
    target = _resolve(rel)
    target.mkdir(parents=True, exist_ok=True)
    return {"path": rel}


def delete(rel: str) -> dict:
    target = _resolve(rel)
    if target == ROOT.resolve():
        raise PathError("refusing to delete root")
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()
    return {"deleted": rel}


def _safe_name(name: str | None) -> str:
    # Strip any directory components and null bytes; reject traversal entirely.
    base = Path(name or "upload.bin").name.replace("\x00", "").strip()
    if not base or base in (".", ".."):
        base = "upload.bin"
    return base


async def upload(rel_dir: str, file: UploadFile) -> dict:
    from app.core.config import settings

    target_dir = _resolve(rel_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    dest = _resolve(str(Path(rel_dir) / _safe_name(file.filename)))

    max_bytes = settings.max_upload_mb * 1024 * 1024
    written = 0
    with dest.open("wb") as fh:
        while chunk := await file.read(1024 * 1024):
            written += len(chunk)
            if written > max_bytes:
                fh.close()
                dest.unlink(missing_ok=True)
                raise PathError(f"檔案超過上限 {settings.max_upload_mb} MB")
            fh.write(chunk)
    return {"path": str(dest.relative_to(ROOT.resolve())), "size": dest.stat().st_size}
