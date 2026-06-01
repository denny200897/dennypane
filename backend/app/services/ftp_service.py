"""FTP/SFTP account management.

On Linux the panel can provision a real system user confined to a home dir
(usable for SFTP via OpenSSH, or FTP via a server like vsftpd). On non-Linux
hosts the account is recorded but provisioning is skipped, so the UI still works
for testing.
"""
from __future__ import annotations

import platform
import subprocess
from pathlib import Path

from app.models.models import FTPAccount

IS_LINUX = platform.system() == "Linux"


def provision(account: FTPAccount) -> dict:
    Path(account.home_dir).mkdir(parents=True, exist_ok=True)
    if not IS_LINUX:
        account.status = "recorded (non-linux host: not provisioned)"
        return {"provisioned": False, "reason": "host is not Linux"}
    try:
        subprocess.run(
            ["useradd", "-m", "-d", account.home_dir, "-s",
             "/usr/sbin/nologin" if account.protocol == "sftp" else "/bin/false",
             account.username],
            check=True, capture_output=True, text=True,
        )
        subprocess.run(
            ["chpasswd"], input=f"{account.username}:{account.password}\n",
            check=True, capture_output=True, text=True,
        )
        account.status = "active"
        return {"provisioned": True}
    except subprocess.CalledProcessError as exc:
        account.status = "error"
        return {"provisioned": False, "error": exc.stderr or str(exc)}


def deprovision(account: FTPAccount) -> dict:
    if not IS_LINUX:
        return {"removed": False, "reason": "host is not Linux"}
    try:
        subprocess.run(["userdel", "-r", account.username], capture_output=True, text=True)
        return {"removed": True}
    except Exception as exc:  # noqa: BLE001
        return {"removed": False, "error": str(exc)}
