import hashlib
import os
import re
import secrets
import time

from fastapi import Cookie, Depends, HTTPException, Response
from sqlmodel import Session, select

from .db import get_session
from .models import User, UserSession

COOKIE_NAME = "aisana_session"
SESSION_SECONDS = 7 * 24 * 60 * 60


def normalize_email(value: str) -> str:
    email = value.strip().casefold()
    if len(email) > 320 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(400, "Укажите корректный адрес электронной почты")
    return email


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(user: User, session: Session, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    session.add(UserSession(token_hash=token_hash(token), user_id=user.id, expires_at=int(time.time()) + SESSION_SECONDS))
    session.commit()
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True,
        samesite="lax", secure=os.getenv("COOKIE_SECURE", "false").lower() == "true", path="/",
    )


def current_user(
    aisana_session: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not aisana_session:
        raise HTTPException(401, "Войдите в аккаунт")
    saved = session.get(UserSession, token_hash(aisana_session))
    if saved is None or saved.expires_at <= int(time.time()):
        raise HTTPException(401, "Сессия истекла. Войдите снова")
    user = session.get(User, saved.user_id)
    if user is None:
        raise HTTPException(401, "Войдите в аккаунт")
    return user


def remove_sessions(session: Session, user_id: int) -> None:
    for item in session.exec(select(UserSession).where(UserSession.user_id == user_id)).all():
        session.delete(item)
    session.commit()
