from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from services.chat import run_chat
from utils.sse import sse_frame

router = APIRouter()

@router.post("/chat")
async def chat(body):
    async def event_stream():
        async for event in run_chat(body.project_id, body.message):
            yield sse_frame(event)

    return StreamingResponse(event_stream(), media_type="text/event-stream")