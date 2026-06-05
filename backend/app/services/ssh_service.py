"""SSH command execution against managed hosts via paramiko."""
from __future__ import annotations

import io

import paramiko
from paramiko.hostkeys import HostKeyEntry

from app.core import crypto
from app.models.models import SSHHost


class _RecordingPolicy(paramiko.MissingHostKeyPolicy):
    """Trust-on-first-use: accept an unknown key but remember it so the caller
    can pin it. On later connections the pinned key is pre-loaded, so paramiko
    raises BadHostKeyException on mismatch instead of reaching this policy."""

    def __init__(self) -> None:
        self.collected: str | None = None

    def missing_host_key(self, client, hostname, key) -> None:  # noqa: ANN001
        self.collected = f"{key.get_name()} {key.get_base64()}"


def _connect(host: SSHHost) -> tuple[paramiko.SSHClient, str | None]:
    client = paramiko.SSHClient()
    if host.host_key:
        entry = HostKeyEntry.from_line(f"{host.hostname} {host.host_key}")
        if entry:
            for name in entry.hostnames:
                client.get_host_keys().add(name, entry.key.get_name(), entry.key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
    policy = _RecordingPolicy()
    if not host.host_key:
        client.set_missing_host_key_policy(policy)

    kwargs = {
        "hostname": host.hostname,
        "port": host.port,
        "username": host.username,
        "timeout": 15,
    }
    private_key = crypto.decrypt(host.private_key)
    password = crypto.decrypt(host.password)
    if private_key:
        kwargs["pkey"] = paramiko.RSAKey.from_private_key(io.StringIO(private_key))
    elif password:
        kwargs["password"] = password
    client.connect(**kwargs)
    return client, policy.collected


def run_command(host: SSHHost, command: str, db=None) -> dict:  # noqa: ANN001
    client, new_key = _connect(host)
    # Pin the key the first time we successfully see it (TOFU).
    if new_key and not host.host_key and db is not None:
        host.host_key = new_key
        db.commit()
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


def test_connection(host: SSHHost, db=None) -> dict:  # noqa: ANN001
    try:
        result = run_command(host, "echo dennypanel-ok", db=db)
        return {"ok": result["stdout"].strip() == "dennypanel-ok"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
