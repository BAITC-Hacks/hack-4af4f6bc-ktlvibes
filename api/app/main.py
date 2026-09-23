from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session

from .db import create_schema, engine
from .routes import actors, progress, proposals, tasks, teams


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_schema()
    from seed import seed

    with Session(engine) as session:
        seed(session)
    yield


app = FastAPI(title="AI Sana API", lifespan=lifespan)
app.include_router(actors.router)
app.include_router(tasks.router)
app.include_router(proposals.router)
app.include_router(progress.router)
app.include_router(teams.router)
