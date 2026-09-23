from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def now() -> datetime:
    return datetime.now(timezone.utc)


class Business(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)


class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    interests: str = ""
    skills: str = ""
    technologies: str = ""
    points: int = 0


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
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
    team_id: int = Field(foreign_key="team.id", index=True)
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
    team_id: int = Field(foreign_key="team.id", index=True)
    note: str
    points: int = 10
    confirmed_at: datetime = Field(default_factory=now)
