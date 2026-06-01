"""Cron job management via the user crontab.

Jobs added through dennyPanel are tagged with a marker comment so they can be
listed and removed without disturbing hand-written entries.
"""
from __future__ import annotations

import subprocess

MARKER = "# dennypanel"


def _read() -> list[str]:
    out = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    if out.returncode != 0:
        return []
    return out.stdout.splitlines()


def _write(lines: list[str]) -> None:
    subprocess.run(["crontab", "-"], input="\n".join(lines) + "\n", text=True, check=True)


def list_jobs() -> list[dict]:
    jobs = []
    for line in _read():
        if MARKER in line:
            body = line.split(MARKER, 1)[0].strip()
            label = line.split(MARKER, 1)[1].strip()
            jobs.append({"schedule_and_cmd": body, "label": label})
    return jobs


def add_job(schedule: str, command: str, label: str = "") -> dict:
    lines = _read()
    lines.append(f"{schedule} {command} {MARKER} {label}".rstrip())
    _write(lines)
    return {"added": True, "label": label}


def remove_job(label: str) -> dict:
    lines = [l for l in _read() if not (MARKER in l and l.split(MARKER, 1)[1].strip() == label)]
    _write(lines)
    return {"removed": True, "label": label}
