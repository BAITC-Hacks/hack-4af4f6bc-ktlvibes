from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..checks import required
from ..auth import COOKIE_NAME, current_user, normalize_email, remove_sessions, start_session
from ..db import get_session
from ..models import ProgressConfirmation, Proposal, Task, User
from ..passwords import hash_password
from ..schemas import UserCreate, UserUpdate
from ..serializers import user_json

router = APIRouter(prefix="/api/users")


def has_activity(session: Session, user: User) -> bool:
    if user.role == "business":
        return session.exec(select(Task.id).where(Task.business_id == user.id).limit(1)).first() is not None
    return any((
        session.exec(select(Proposal.id).where(Proposal.team_id == user.id).limit(1)).first() is not None,
        session.exec(select(ProgressConfirmation.id).where(ProgressConfirmation.team_id == user.id).limit(1)).first() is not None,
    ))


def save_user(session: Session, user: User) -> dict:
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Почта или название для этой роли уже заняты")
    session.refresh(user)
    return user_json(user)


@router.get("")
def list_users(user: User = Depends(current_user)):
    return [user_json(user)]


@router.post("", status_code=201)
def create_user(body: UserCreate, session: Session = Depends(get_session)):
    user = User(
        role=body.role,
        name=required(body.name, "Имя"),
        email=normalize_email(body.email),
        password_hash=hash_password(body.password),
        interests=body.interests.strip(),
        skills=body.skills.strip(),
        technologies=body.technologies.strip(),
    )
    return save_user(session, user)


@router.get("/{user_id}")
def read_user(user_id: int, user: User = Depends(current_user)):
    if user_id != user.id:
        raise HTTPException(404, "Пользователь не найден")
    return user_json(user)


@router.patch("/{user_id}")
def update_user(user_id: int, body: UserUpdate, response: Response, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if user_id != user.id:
        raise HTTPException(404, "Пользователь не найден")
    changes = body.model_dump(exclude_unset=True)
    if changes.get("role") != user.role and "role" in changes and has_activity(session, user):
        raise HTTPException(409, "Нельзя изменить роль пользователя с задачами или откликами")
    changed_password = "password" in changes
    for field, value in changes.items():
        if value is None:
            raise HTTPException(400, f"Поле «{field}» не может быть пустым")
        if field == "password":
            user.password_hash = hash_password(value)
        elif field == "email":
            user.email = normalize_email(value)
        else:
            setattr(user, field, required(value, "Имя") if field == "name" else value.strip() if isinstance(value, str) and field != "role" else value)
    saved = save_user(session, user)
    if changed_password:
        remove_sessions(session, user.id)
        start_session(user, session, response)
    return saved


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, response: Response, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if user_id != user.id:
        raise HTTPException(404, "Пользователь не найден")
    if has_activity(session, user):
        raise HTTPException(409, "Нельзя удалить пользователя с задачами или откликами")
    remove_sessions(session, user.id)
    session.delete(user)
    session.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
