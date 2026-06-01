"""SSH command execution against managed hosts via paramiko."""
from __future__ import annotations

import io

import paramiko

from app.models.models import SSHHost


def _connect(host: SSHHost) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs = {
        "hostname": host.hostname,
        "port": host.port,
        "username": host.username,
        "timeout": 15,
    }
    if host.private_key:
        kwargs["pkey"] = paramiko.RSAKey.from_private_key(io.StringIO(host.private_key))
    elif host.password:
        kwargs["password"] = host.password
    client.connect(**kwargs)
    return client


def run_command(host: SSHHost, command: str) -> dict:
    client = _connect(host)
    try:
        _, stdout, stderr = client.exec_command(command, timeout=60)
        exit_code = stdout.channel.recv_exit_status()
        return {
            "exit_code": exit_code,
            "stdout": stdout.read().decode("utf-8", errors="replace"),
            "stderr": stderr.read().decode("utf-8", errors="replace"),
        }
    finally:
        client.close()


def test_connection(host: SSHHost) -> dict:
    try:
        result = run_command(host, "echo dennypanel-ok")
        return {"ok": result["stdout"].strip() == "dennypanel-ok"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
