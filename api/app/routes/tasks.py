from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from ..ai import ask_questions
from ..checks import actor_id, business, required, task_for_owner
from ..db import get_session
from ..models import Task, now
from ..rating import get_level, score_task
from ..schemas import Card, CardRequest, DraftRequest, QuestionsRequest
from ..serializers import CARD_COLUMNS, task_json

router = APIRouter(prefix="/api/tasks")


@router.post("/drafts", status_code=201)
def create_draft(body: DraftRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    business(session, actor)
    task = Task(business_id=actor, initial_description=required(body.initialDescription, "Описание"), topic=body.topic.strip())
    session.add(task)
    session.commit()
    session.refresh(task)
    return task_json(task)


@router.get("/mine")
def my_tasks(actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    business(session, actor)
    return [task_json(task) for task in session.exec(select(Task).where(Task.business_id == actor).order_by(Task.created_at.desc())).all()]


@router.post("/{task_id}/questions")
def questions(task_id: int, body: QuestionsRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task_for_owner(session, task_id, actor)
    allowed = set(Card.model_fields)
    return ask_questions(body.initialDescription, {key: value for key, value in body.card.items() if key in allowed})


@router.post("/{task_id}/score-preview")
def score_preview(task_id: int, body: CardRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task_for_owner(session, task_id, actor)
    return score_task(body.card.model_dump())


@router.put("/{task_id}/draft")
def save_draft(task_id: int, body: CardRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task = task_for_owner(session, task_id, actor)
    if task.status != "draft":
        raise HTTPException(409, "Опубликованную задачу обновите через подтверждение карточки")
    card = body.card.model_dump()
    for key, value in card.items():
        setattr(task, CARD_COLUMNS.get(key, key), value.strip())
    task.updated_at = now()
    session.add(task)
    session.commit()
    session.refresh(task)
    return {"task": task_json(task), "rating": score_task(card)}


@router.put("/{task_id}/confirm")
def confirm(task_id: int, body: CardRequest, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task = task_for_owner(session, task_id, actor)
    card = body.card.model_dump()
    required(card["title"], "Название")
    required(card["topic"], "Тема")
    rating = score_task(card)
    for key, value in card.items():
        setattr(task, CARD_COLUMNS.get(key, key), value.strip())
    task.status = "published"
    task.score = rating["total"]
    task.confirmed_at = now()
    task.updated_at = task.confirmed_at
    session.add(task)
    session.commit()
    session.refresh(task)
    return task_json(task)


@router.get("")
def catalog(topic: str | None = None, level: str | None = None, session: Session = Depends(get_session)):
    if level and level not in {"черновик", "рабочая", "готовая", "приоритетная"}:
        raise HTTPException(400, "Неизвестный уровень")
    query = select(Task).where(Task.status == "published")
    if topic:
        query = query.where(func.lower(Task.topic) == topic.casefold())
    query = query.order_by(Task.score.desc(), Task.confirmed_at.desc(), Task.id.desc())
    tasks = session.exec(query).all()
    return [task_json(task) for task in tasks if level is None or get_level(task.score or 0) == level]


@router.get("/{task_id}")
def get_task(task_id: int, actor: int = Depends(actor_id), session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Задача не найдена")
    if task.status == "draft" and task.business_id != actor:
        raise HTTPException(404, "Задача не найдена")
    return task_json(task)
