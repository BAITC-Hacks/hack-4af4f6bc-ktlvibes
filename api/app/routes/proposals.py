from fastapi import APIRouter, Depends, HTTPException
from pydantic import HttpUrl, TypeAdapter, ValidationError
from sqlmodel import Session, select

from ..checks import actor_id, published_task, required, task_for_owner, team
from ..db import get_session
from ..models import ProgressConfirmation, Proposal, User
from ..schemas import ProposalRequest, StatusRequest
from ..serializers import proposal_json

router = APIRouter(prefix="/api")


@router.post("/tasks/{task_id}/proposals", status_code=201)
def create_proposal(task_id: int, body: ProposalRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    selected_team = team(session, actor)
    published_task(session, task_id)
    idea, plan, duration = (required(body.idea, "Идея"), required(body.plan, "План"), required(body.duration, "Срок"))
    url = body.prototypeUrl.strip()
    try:
        TypeAdapter(HttpUrl).validate_python(url)
    except ValidationError:
        raise HTTPException(400, "Укажите корректную HTTP(S)-ссылку на прототип")
    proposal = Proposal(task_id=task_id, team_id=actor, idea=idea, plan=plan, duration=duration, prototype_url=url)
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    return proposal_json(proposal, selected_team)


@router.get("/tasks/{task_id}/my-proposals")
def my_proposals(task_id: int, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    selected_team = team(session, actor)
    published_task(session, task_id)
    query = select(Proposal).where(Proposal.task_id == task_id, Proposal.team_id == actor).order_by(Proposal.created_at.desc())
    return [proposal_json(proposal, selected_team) for proposal in session.exec(query).all()]


@router.get("/tasks/{task_id}/proposals")
def proposals(task_id: int, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task_for_owner(session, task_id, actor)
    rows = session.exec(select(Proposal, User).join(User).where(Proposal.task_id == task_id).order_by(Proposal.created_at.desc())).all()
    return [proposal_json(proposal, team) for proposal, team in rows]


@router.patch("/proposals/{proposal_id}/status")
def set_status(proposal_id: int, body: StatusRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    proposal = session.get(Proposal, proposal_id)
    if proposal is None:
        raise HTTPException(404, "Отклик не найден")
    task_for_owner(session, proposal.task_id, actor)
    if session.exec(select(ProgressConfirmation).where(ProgressConfirmation.task_id == proposal.task_id, ProgressConfirmation.team_id == proposal.team_id)).first():
        raise HTTPException(409, "Прогресс уже подтверждён")
    proposal.status = body.status
    session.add(proposal)
    session.commit()
    return proposal_json(proposal, session.get(User, proposal.team_id))
