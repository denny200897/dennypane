"""Host system metrics via psutil."""
from __future__ import annotations

import platform
import time

import psutil

_BOOT = psutil.boot_time()


def overview() -> dict:
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    load1, load5, load15 = (0.0, 0.0, 0.0)
    try:
        load1, load5, load15 = psutil.getloadavg()
    except (AttributeError, OSError):
        pass
    return {
        "hostname": platform.node(),
        "platform": platform.platform(),
        "uptime_seconds": int(time.time() - _BOOT),
        "cpu": {
            "percent": psutil.cpu_percent(interval=0.2),
            "cores": psutil.cpu_count(logical=True),
            "load_avg": [round(load1, 2), round(load5, 2), round(load15, 2)],
        },
        "memory": {
            "total": vm.total,
            "used": vm.used,
            "available": vm.available,
            "percent": vm.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent,
        },
    }


def processes(limit: int = 20) -> list[dict]:
    procs = []
    for p in psutil.process_iter(["pid", "name", "username", "cpu_percent", "memory_percent"]):
        try:
            procs.append(p.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda x: x.get("cpu_percent") or 0, reverse=True)
    return procs[:limit]
