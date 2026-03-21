from fastapi import FastAPI
<<<<<<< HEAD

app = FastAPI()

@app.get("/")
def home():
    return {"Hello":"World"}
=======
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.generate import router as generate_router
from backend.routes.chat import router as chat_router
from backend.routes.projects import router as projects_router
from backend.models.database import init_db

app = FastAPI(title="DocBot API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(generate_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(projects_router, prefix="/api")


@app.on_event("startup")
async def startup():
    await init_db()
>>>>>>> 3e2eceb8ea6fa2e898210db0b17a93b577123894
