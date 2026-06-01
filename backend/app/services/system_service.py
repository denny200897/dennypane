"""Host system metrics via psutil."""
from __future__ import annotations

import platform
import time

import psutil

_BOOT = psutil.boot_time()


def overview() -> dict:
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    load1, load5, load15 = (0.0, 0.0, 0.0)
    try:
        load1, load5, load15 = psutil.getloadavg()
    except (AttributeError, OSError):
        pass
    per_core = psutil.cpu_percent(interval=0.2, percpu=True)
    return {
        "hostname": platform.node(),
        "platform": platform.platform(),
        "os": f"{platform.system()} {platform.release()}",
        "arch": platform.machine(),
        "python": platform.python_version(),
        "boot_time": int(_BOOT),
        "uptime_seconds": int(time.time() - _BOOT),
        "cpu": {
            "percent": round(sum(per_core) / len(per_core), 1) if per_core else 0.0,
            "cores": psutil.cpu_count(logical=True),
            "physical_cores": psutil.cpu_count(logical=False) or psutil.cpu_count(logical=True),
            "per_core": [round(p, 1) for p in per_core],
            "load_avg": [round(load1, 2), round(load5, 2), round(load15, 2)],
        },
        "memory": {
            "total": vm.total,
            "used": vm.used,
            "available": vm.available,
            "percent": vm.percent,
        },
        "swap": {
            "total": swap.total,
            "used": swap.used,
            "percent": swap.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent,
        },
        "network": {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv,
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
