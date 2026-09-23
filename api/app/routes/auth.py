from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlmodel import Session, select

from ..auth import COOKIE_NAME, current_user, normalize_email, start_session, token_hash
from ..db import get_session
from ..models import User, UserSession
from ..passwords import verify_password
from ..schemas import LoginRequest
from ..serializers import user_json

router = APIRouter(prefix="/api/auth")


@router.post("/login")
def login(body: LoginRequest, response: Response, session: Session = Depends(get_session)):
    email = normalize_email(body.email)
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверная почта или пароль")
    start_session(user, session, response)
    return user_json(user)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_json(user)


@router.post("/logout", status_code=204)
def logout(response: Response, aisana_session: str | None = Cookie(default=None), session: Session = Depends(get_session)):
    if aisana_session:
        saved = session.get(UserSession, token_hash(aisana_session))
        if saved:
            session.delete(saved)
            session.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
