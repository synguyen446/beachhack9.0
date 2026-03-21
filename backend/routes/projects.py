from fastapi import APIRouter

from models.database import get_projects, get_chat_history, get_documents

router = APIRouter()


@router.get("/projects")
async def list_projects():
    return await get_projects()


@router.get("/projects/{project_id}/chat")
async def project_chat_history(project_id: int):
    return await get_chat_history(project_id, limit=100)


@router.get("/projects/{project_id}/documents")
async def project_documents(project_id: int):
    return await get_documents(project_id)
