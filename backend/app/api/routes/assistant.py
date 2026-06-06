from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.models import User
from app.schemas.schemas import ChatReply, ChatRequest
from app.services import assistant_service
from app.services.assistant_service import AssistantError

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/status")
def status_(_: User = Depends(get_current_user)):
    """Whether the assistant is configured (never exposes the key itself)."""
    return {"enabled": settings.assistant_enabled, "model": settings.assistant_model}


@router.post("/chat", response_model=ChatReply)
async def chat(req: ChatRequest, _: User = Depends(get_current_user)):
    if not settings.assistant_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI 助手尚未設定。")
    try:
        reply = await assistant_service.chat([m.model_dump() for m in req.messages])
    except AssistantError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    return ChatReply(reply=reply)
