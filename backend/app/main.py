from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.config import BASE_DIR


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    (BASE_DIR / "data").mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Dienstplaner API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
