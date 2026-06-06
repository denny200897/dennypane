"""AI assistant backend proxy.

Talks to a NewAPI / OpenAI-compatible chat-completions endpoint. The API key is
read from server-side settings only and never leaves the backend — the browser
calls our authenticated /api/assistant/chat route, which in turn calls the LLM.

A read-only snapshot of the current server status is gathered here (not supplied
by the client) and injected as a system prompt, so the model can answer
questions about the host without us trusting any client-provided context.
"""
from __future__ import annotations

import json

import httpx

from app.core.config import settings
from app.services import docker_service, system_service

# Hard caps to keep a chat request bounded regardless of what the client sends.
_MAX_MESSAGES = 30
_MAX_CONTENT_CHARS = 8000


class AssistantError(RuntimeError):
    """Raised for any assistant failure; message is safe to show the user."""


def _bytes_to_gib(n: int) -> float:
    return round(n / (1024 ** 3), 2)


def _server_context() -> str:
    """Build a compact, read-only status snapshot for the system prompt."""
    parts: dict = {}
    try:
        ov = system_service.overview()
        parts["host"] = {
            "hostname": ov["hostname"],
            "os": ov["os"],
            "arch": ov["arch"],
            "uptime_seconds": ov["uptime_seconds"],
            "cpu_percent": ov["cpu"]["percent"],
            "cpu_cores": ov["cpu"]["cores"],
            "load_avg": ov["cpu"]["load_avg"],
            "memory_percent": ov["memory"]["percent"],
            "memory_total_gib": _bytes_to_gib(ov["memory"]["total"]),
            "memory_used_gib": _bytes_to_gib(ov["memory"]["used"]),
            "disk_percent": ov["disk"]["percent"],
            "disk_total_gib": _bytes_to_gib(ov["disk"]["total"]),
            "disk_free_gib": _bytes_to_gib(ov["disk"]["free"]),
        }
    except Exception:  # noqa: BLE001 - status is best-effort context
        parts["host"] = {"error": "無法取得主機指標"}

    try:
        parts["docker"] = docker_service.summary()
    except Exception:  # noqa: BLE001 - Docker may be unavailable
        parts["docker"] = {"error": "無法連線 Docker"}

    try:
        procs = system_service.processes(limit=5)
        parts["top_processes"] = [
            {"name": p.get("name"), "cpu": p.get("cpu_percent"), "mem": p.get("memory_percent")}
            for p in procs
        ]
    except Exception:  # noqa: BLE001
        pass

    return json.dumps(parts, ensure_ascii=False)


def _system_prompt() -> str:
    return (
        "你是 dennyPanel 伺服器面板的 AI 助手。請用繁體中文、簡潔、口語化地回答。"
        "你只能根據下面這份即時伺服器狀態快照回答關於主機/容器的問題，不要編造數字。"
        "你無法執行任何指令或變更系統，只能提供說明與建議。\n\n"
        f"目前伺服器狀態 (JSON):\n{_server_context()}"
    )


def _sanitize_messages(messages: list[dict]) -> list[dict]:
    """Keep only well-formed user/assistant turns, trimmed and length-capped."""
    cleaned: list[dict] = []
    for m in messages[-_MAX_MESSAGES:]:
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        cleaned.append({"role": role, "content": content[:_MAX_CONTENT_CHARS]})
    return cleaned


async def chat(messages: list[dict]) -> str:
    if not settings.assistant_enabled:
        raise AssistantError("AI 助手尚未設定（缺少 API 金鑰或 base URL）。")

    convo = _sanitize_messages(messages)
    if not convo:
        raise AssistantError("沒有有效的訊息內容。")

    payload = {
        "model": settings.assistant_model,
        "messages": [{"role": "system", "content": _system_prompt()}, *convo],
        "max_tokens": settings.assistant_max_tokens,
        "temperature": 0.4,
    }
    url = settings.assistant_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.assistant_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.assistant_timeout_seconds) as http:
            resp = await http.post(url, json=payload, headers=headers)
    except httpx.TimeoutException:
        raise AssistantError("AI 服務回應逾時，請稍後再試。")
    except httpx.HTTPError:
        # Never surface the raw exception — it can leak the upstream URL/headers.
        raise AssistantError("無法連線 AI 服務。")

    if resp.status_code >= 400:
        # Log upstream detail server-side only; tell the client a generic message
        # so the API key / endpoint internals never reach the browser.
        print(f"[assistant] upstream {resp.status_code}: {resp.text[:500]}")
        raise AssistantError("AI 服務回傳錯誤，請檢查模型設定或令牌額度。")

    try:
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise AssistantError("AI 服務回傳了非預期的格式。")

    if not isinstance(reply, str) or not reply.strip():
        raise AssistantError("AI 服務沒有回傳內容。")
    return reply.strip()
