from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('business', 'team')", name="users_role_check"),
        UniqueConstraint("role", "name", name="users_role_name_key"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    role: str = Field(index=True)
    name: str = Field(index=True)
    email: Optional[str] = Field(default=None, index=True, unique=True)
    password_hash: Optional[str] = None
    interests: str = ""
    skills: str = ""
    technologies: str = ""
    points: int = 0


class UserSession(SQLModel, table=True):
    token_hash: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    expires_at: int


class SeedState(SQLModel, table=True):
    key: str = Field(primary_key=True)


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="users.id", index=True)
    status: str = "draft"
    initial_description: str = ""
    topic: str = ""
    title: str = ""
    context: str = ""
    need: str = ""
    users: str = ""
    data_description: str = ""
    data_access: str = ""
    constraints: str = ""
    expected_result: str = ""
    success_metric: str = ""
    success_target: str = ""
    contact: str = ""
    interaction_format: str = ""
    score: Optional[int] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)


class Proposal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="task.id", index=True)
    team_id: int = Field(foreign_key="users.id", index=True)
    idea: str
    plan: str
    duration: str
    prototype_url: str
    status: str = "submitted"
    created_at: datetime = Field(default_factory=now)


class ProgressConfirmation(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("task_id", "team_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="task.id", index=True)
    team_id: int = Field(foreign_key="users.id", index=True)
    note: str
    points: int = 10
    confirmed_at: datetime = Field(default_factory=now)
