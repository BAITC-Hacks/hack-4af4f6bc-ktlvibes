from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import current_user
from ..db import get_session
from ..models import User
from ..serializers import team_json

router = APIRouter(prefix="/api/teams")


@router.get("")
def teams(user: User = Depends(current_user), session: Session = Depends(get_session)):
    query = select(User).where(User.role == "team")
    if user.role == "team":
        query = query.where(User.id == user.id)
    return [team_json(team) for team in session.exec(query.order_by(User.id)).all()]
