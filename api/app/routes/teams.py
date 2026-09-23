from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..checks import required
from ..db import get_session
from ..models import Team
from ..schemas import TeamRequest
from ..serializers import team_json

router = APIRouter(prefix="/api/teams")


@router.get("")
def teams(session: Session = Depends(get_session)):
    return [team_json(team) for team in session.exec(select(Team).order_by(Team.id)).all()]


@router.post("", status_code=201)
def create_team(body: TeamRequest, session: Session = Depends(get_session)):
    name = required(body.name, "Название команды")
    if session.exec(select(Team).where(Team.name == name)).first():
        raise HTTPException(409, "Команда с таким названием уже существует")
    result = Team(name=name, interests=body.interests.strip(), skills=body.skills.strip(), technologies=body.technologies.strip())
    session.add(result)
    session.commit()
    session.refresh(result)
    return team_json(result)
