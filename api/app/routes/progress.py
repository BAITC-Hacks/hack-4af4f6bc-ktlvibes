from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..checks import actor_id, required, task_for_owner
from ..db import get_session
from ..models import ProgressConfirmation, Proposal, Team
from ..schemas import ProgressRequest
from ..serializers import progress_json, team_json

router = APIRouter(prefix="/api/tasks")


@router.post("/{task_id}/progress", status_code=201)
def confirm_progress(task_id: int, body: ProgressRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task_for_owner(session, task_id, actor)
    note = required(body.note, "Описание прогресса")
    selected_team = session.exec(select(Team).where(Team.id == body.teamId).with_for_update()).first()
    if selected_team is None:
        raise HTTPException(404, "Команда не найдена")
    if session.exec(select(ProgressConfirmation).where(ProgressConfirmation.task_id == task_id, ProgressConfirmation.team_id == body.teamId)).first():
        raise HTTPException(409, "Прогресс этой команды уже подтверждён")
    selected = session.exec(select(Proposal).where(Proposal.task_id == task_id, Proposal.team_id == body.teamId, Proposal.status == "selected")).first()
    if selected is None:
        raise HTTPException(409, "Сначала выберите отклик команды")
    progress = ProgressConfirmation(task_id=task_id, team_id=body.teamId, note=note)
    selected_team.points += 10
    session.add(progress)
    session.add(selected_team)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Прогресс этой команды уже подтверждён")
    session.refresh(progress)
    return {"confirmation": progress_json(progress), "team": team_json(selected_team)}


@router.get("/{task_id}/progress")
def progress(task_id: int, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task_for_owner(session, task_id, actor)
    return [progress_json(item) for item in session.exec(select(ProgressConfirmation).where(ProgressConfirmation.task_id == task_id)).all()]
