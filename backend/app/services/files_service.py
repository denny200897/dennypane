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


async def upload(rel_dir: str, file: UploadFile) -> dict:
    target_dir = _resolve(rel_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    dest = _resolve(str(Path(rel_dir) / (file.filename or "upload.bin")))
    with dest.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)
    return {"path": str(dest.relative_to(ROOT.resolve())), "size": dest.stat().st_size}
