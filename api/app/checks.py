from fastapi import Header, HTTPException
from sqlmodel import Session

from .models import Business, Task, Team


def actor_id(x_demo_actor_id: int = Header(...)) -> int:
    return x_demo_actor_id


def business(session: Session, actor: int) -> Business:
    result = session.get(Business, actor)
    if result is None:
        raise HTTPException(404, "Бизнес не найден")
    return result


def team(session: Session, actor: int) -> Team:
    result = session.get(Team, actor)
    if result is None:
        raise HTTPException(404, "Команда не найдена")
    return result


def task_for_owner(session: Session, task_id: int, actor: int) -> Task:
    business(session, actor)
    task = session.get(Task, task_id)
    if task is None or task.business_id != actor:
        raise HTTPException(404, "Задача не найдена")
    return task


def published_task(session: Session, task_id: int) -> Task:
    task = session.get(Task, task_id)
    if task is None or task.status != "published":
        raise HTTPException(404, "Опубликованная задача не найдена")
    return task


def required(value: str, label: str) -> str:
    value = value.strip()
    if not value:
        raise HTTPException(400, f"Поле «{label}» обязательно")
    return value
