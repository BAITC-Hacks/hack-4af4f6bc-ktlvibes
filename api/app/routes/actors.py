from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import Business, Team
from ..serializers import team_json

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/demo-actors")
def demo_actors(session: Session = Depends(get_session)):
    return {
        "businesses": [
            {"id": business.id, "name": business.name}
            for business in session.exec(select(Business).order_by(Business.id)).all()
        ],
        "teams": [team_json(team) for team in session.exec(select(Team).order_by(Team.id)).all()],
    }
